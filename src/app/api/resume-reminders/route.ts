import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { invoice_id } = await req.json();

  // Берём инвойс
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, profiles(email)')
    .eq('id', invoice_id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Берём email фрилансера
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', invoice.user_id)
    .single();

  // Считаем сколько дней просрочено
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  const dayOffset = Math.floor(
    (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formattedAmount = `${invoice.currency} ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formattedDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const inv = invoice.invoice_number ? ` #${invoice.invoice_number}` : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`;

  // Обновляем статус на notified
  await supabase
    .from('invoices')
    .update({ status: 'notified' })
    .eq('id', invoice_id);

  // Отправляем письмо клиенту
  const { data, error: emailError } = await resend.emails.send({
    from: 'PayNudge <onboarding@resend.dev>',
    to: invoice.client_email,
    replyTo: profile?.email,
    subject: `Follow-up — invoice${inv} payment not confirmed`,
    html: `
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
                    ${
                      invoice.invoice_number
                        ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice</td>
                        <td align="right" style="color:#111;font-size:13px;">#${invoice.invoice_number}</td>
                      </tr>
                    </table>`
                        : ''
                    }
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

              ${
                invoice.stripe_payment_link
                  ? `
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
              </table>`
                  : ''
              }

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
                <a href="mailto:${profile?.email}" style="color:#888;">${profile?.email}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });

  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 500 });
  }

  // Логируем
  await supabase.from('reminder_logs').insert({
    invoice_id,
    day_offset: dayOffset,
    email_subject: `Follow-up — invoice${inv} payment not confirmed`,
    status: 'sent',
  });

  return NextResponse.json({ success: true });
}
