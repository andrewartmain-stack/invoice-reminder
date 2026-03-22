import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();

  const {
    freelancer_email,
    client_name,
    amount,
    currency,
    invoice_number,
    invoice_id,
    days_since_report,
  } = body;

  const formattedAmount = `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const inv = invoice_number ? ` #${invoice_number}` : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { data, error } = await resend.emails.send({
    from: 'PayNudge <onboarding@resend.dev>',
    to: freelancer_email,
    subject: `${client_name} reported payment ${days_since_report} days ago — confirm?`,
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
              <p style="margin:0 0 8px;color:#111;font-size:15px;font-weight:600;">
                ${client_name} reported sending payment ${days_since_report} days ago.
              </p>
              <p style="margin:0 0 28px;color:#444;font-size:14px;line-height:1.6;">
                Invoice${inv} for <strong>${formattedAmount}</strong> is still marked as unconfirmed.
                Please check your bank account and confirm if you've received the payment.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/invoices/${invoice_id}"
                      style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;
                             padding:14px 32px;border-radius:6px;font-size:13px;font-weight:600;">
                      Review &amp; confirm payment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#bbb;font-size:11px;text-align:center;">
                If payment hasn't arrived, you can resume reminders from the invoice page.
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

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
