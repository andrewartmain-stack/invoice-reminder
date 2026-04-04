import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { buildTemplateEmail } from '@/lib/build-email';
import { resolveDesign } from '@/types/email-design';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function POST(req: Request) {
  const { invoice_id } = await req.json();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoice_id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, sender_name, email_design, default_template_ids')
    .eq('id', invoice.user_id)
    .single();

  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  const dayOffset = Math.floor(
    (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formattedAmount = `${invoice.currency} ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formattedDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const inv = invoice.invoice_number ? ` #${invoice.invoice_number}` : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`;

  // Look up the rejection template if configured
  const defaultIds = profile?.default_template_ids as { rejection?: string | null } | null;
  const rejectionTemplateId = defaultIds?.rejection;

  let emailSubject: string;
  let emailHtml: string;

  if (rejectionTemplateId) {
    const { data: tmpl } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('id', rejectionTemplateId)
      .single();

    if (tmpl) {
      const vars = {
        client_name: invoice.client_name ?? '',
        invoice_number: invoice.invoice_number ?? '',
        amount: formattedAmount,
        due_date: formattedDate,
        sender_name: profile?.sender_name ?? '',
      };
      emailSubject = substituteVars(tmpl.subject, vars);
      emailHtml = buildTemplateEmail({
        bodyText: substituteVars(tmpl.body, vars),
        invoice_number: invoice.invoice_number,
        formattedAmount,
        formattedDate,
        stripe_payment_link: invoice.stripe_payment_link,
        invoice_id,
        freelancer_email: profile?.email ?? '',
        rawDesign: profile?.email_design ?? null,
      });
    } else {
      // Template not found — fall back
      rejectionTemplateId && console.warn(`Rejection template ${rejectionTemplateId} not found, using built-in`);
      emailSubject = `Follow-up — invoice${inv} payment not confirmed`;
      emailHtml = builtInEmail(invoice, formattedAmount, formattedDate, profile?.email, reportUrl);
    }
  } else {
    emailSubject = `Follow-up — invoice${inv} payment not confirmed`;
    emailHtml = builtInEmail(invoice, formattedAmount, formattedDate, profile?.email, reportUrl);
  }

  const design = resolveDesign(profile?.email_design ?? null);
  const fromName = profile?.sender_name || design.brand_name;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'onboarding@resend.dev';

  // Update status to notified
  await supabase.from('invoices').update({ status: 'notified' }).eq('id', invoice_id);

  const { error: emailError } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to: invoice.client_email,
    replyTo: profile?.email,
    subject: emailSubject,
    html: emailHtml,
  });

  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 500 });
  }

  await supabase.from('reminder_logs').insert({
    invoice_id,
    day_offset: dayOffset,
    email_subject: emailSubject,
    status: 'sent',
    client_name: invoice.client_name,
  });

  return NextResponse.json({ success: true });
}

function builtInEmail(
  invoice: Record<string, unknown>,
  formattedAmount: string,
  formattedDate: string,
  freelancerEmail: string | undefined,
  reportUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:monospace,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#0a0a0a;padding:24px 32px;">
              <span style="color:#ffffff;font-size:16px;font-weight:600;">paynudge</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#111;font-size:15px;">Hi ${invoice.client_name},</p>
              <p style="margin:0 0 28px;color:#444;font-size:14px;line-height:1.6;">
                We have not been able to confirm receipt of your payment for the invoice below.
                Could you please check if the payment was sent successfully?
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    ${invoice.invoice_number ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice</td>
                        <td align="right" style="color:#111;font-size:13px;">#${invoice.invoice_number}</td>
                      </tr>
                    </table>` : ''}
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Due date</td>
                        <td align="right" style="color:#111;font-size:13px;">${formattedDate}</td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0"
                      style="border-top:1px solid #e5e5e5;padding-top:12px;margin-top:4px;">
                      <tr>
                        <td style="color:#111;font-size:13px;font-weight:600;">Amount due</td>
                        <td align="right" style="color:#111;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${formattedAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${invoice.stripe_payment_link ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <a href="${invoice.stripe_payment_link}"
                      style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;
                             padding:14px 32px;border-radius:6px;font-size:13px;font-weight:600;">
                      Pay now
                    </a>
                  </td>
                </tr>
              </table>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reportUrl}" style="color:#888;font-size:12px;text-decoration:underline;">
                      I've already sent the payment
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;color:#bbb;font-size:11px;">
                If you have questions, reply to this email or contact
                <a href="mailto:${freelancerEmail}" style="color:#888;">${freelancerEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
