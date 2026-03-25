import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();

  const {
    client_name,
    client_email,
    amount,
    currency,
    invoice_number,
    due_date,
    stripe_payment_link,
    invoice_id,
    day_offset,
    freelancer_email,
    sender_name,
    invoice_file_url,
    template_subject,
    template_body,
  } = body;

  const formattedAmount = `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formattedDate = new Date(due_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const vars = {
    client_name,
    invoice_number: invoice_number || '',
    amount: formattedAmount,
    due_date: formattedDate,
  };

  // Use custom template if provided, otherwise fall back to built-in logic
  const subject = template_subject
    ? substituteVars(template_subject, vars)
    : getSubject(day_offset, invoice_number);

  const html = template_body
    ? buildEmailFromTemplate(substituteVars(template_body, vars), {
        stripe_payment_link, invoice_id, freelancer_email,
      })
    : buildEmail({
        client_name, amount, currency, invoice_number,
        due_date, stripe_payment_link, invoice_id, day_offset, freelancer_email,
      });

  const filename = invoice_file_url
    ? decodeURIComponent(invoice_file_url.split('/').pop() || 'invoice')
    : null;

  const { data, error } = await resend.emails.send({
    from: sender_name
      ? `${sender_name} via PayNudge <${process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'onboarding@resend.dev'}>`
      : process.env.RESEND_FROM_EMAIL || 'PayNudge <onboarding@resend.dev>',
    to: client_email,
    replyTo: freelancer_email,
    subject,
    html,
    attachments: invoice_file_url && filename ? [{ filename, path: invoice_file_url }] : [],
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}

// ─── Variable substitution ────────────────────────────────
function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── Email from custom template body ─────────────────────
function buildEmailFromTemplate(
  bodyText: string,
  { stripe_payment_link, invoice_id, freelancer_email }: {
    stripe_payment_link?: string;
    invoice_id: string;
    freelancer_email: string;
  }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`;
  const htmlBody = bodyText
    .split('\n')
    .map(line =>
      line.trim() === ''
        ? '<br/>'
        : `<p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.6;">${line}</p>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#0a0a0a;padding:24px 32px;">
        <span style="color:#fff;font-size:16px;font-weight:600;letter-spacing:-0.5px;">paynudge</span>
      </td></tr>
      <tr><td style="padding:32px;">
        ${htmlBody}
        ${stripe_payment_link ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 16px;">
          <tr><td align="center">
            <a href="${stripe_payment_link}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:13px;font-weight:600;">Pay now</a>
          </td></tr>
        </table>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          <tr><td align="center">
            <a href="${reportUrl}" style="color:#888;font-size:12px;text-decoration:underline;">I've already sent the payment</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
        <p style="margin:0;color:#bbb;font-size:11px;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:${freelancer_email}" style="color:#888;">${freelancer_email}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`.trim();
}

// ─── Fallback subject (old preset-based invoices) ─────────
function getSubject(dayOffset: number, invoiceNumber?: string) {
  const inv = invoiceNumber ? ` #${invoiceNumber}` : '';
  if (dayOffset === 0) return `Invoice${inv} — payment due today`;
  if (dayOffset <= 3) return `Friendly reminder — invoice${inv} overdue`;
  if (dayOffset <= 7) return `Follow-up — invoice${inv} still unpaid`;
  return `Final notice — invoice${inv} requires immediate attention`;
}

// ─── Fallback built-in email (old preset-based invoices) ──
function buildEmail({
  client_name, amount, currency, invoice_number, due_date,
  stripe_payment_link, invoice_id, day_offset, freelancer_email,
}: {
  client_name: string; amount: number; currency: string;
  invoice_number?: string; due_date: string; stripe_payment_link?: string;
  invoice_id: string; day_offset: number; freelancer_email: string;
}) {
  const formattedAmount = `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const formattedDate = new Date(due_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const tone =
    day_offset === 0
      ? 'This is a friendly reminder that your payment is due today.'
      : day_offset <= 3
        ? 'I wanted to follow up on the invoice below, which is now past due.'
        : day_offset <= 7
          ? "I'm reaching out again regarding the outstanding invoice. Could you please arrange payment at your earliest convenience?"
          : 'This is a final notice regarding the unpaid invoice. Please arrange payment immediately to avoid further action.';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#0a0a0a;padding:24px 32px;"><span style="color:#fff;font-size:16px;font-weight:600;letter-spacing:-0.5px;">paynudge</span></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;color:#111;font-size:15px;">Hi ${client_name},</p>
        <p style="margin:0 0 28px;color:#444;font-size:14px;line-height:1.6;">${tone}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;margin-bottom:28px;">
          <tr><td style="padding:20px 24px;">
            ${invoice_number ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice</td><td align="right" style="color:#111;font-size:13px;">#${invoice_number}</td></tr></table>` : ''}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Due date</td><td align="right" style="color:#111;font-size:13px;">${formattedDate}</td></tr></table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;padding-top:12px;margin-top:4px;"><tr><td style="color:#111;font-size:13px;font-weight:600;">Amount due</td><td align="right" style="color:#111;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${formattedAmount}</td></tr></table>
          </td></tr>
        </table>
        ${stripe_payment_link ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td align="center"><a href="${stripe_payment_link}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:13px;font-weight:600;">Pay now</a></td></tr></table>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${reportUrl}" style="color:#888;font-size:12px;text-decoration:underline;">I've already sent the payment</a></td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
        <p style="margin:0;color:#bbb;font-size:11px;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:${freelancer_email}" style="color:#888;">${freelancer_email}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`.trim();
}
