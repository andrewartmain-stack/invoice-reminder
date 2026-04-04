import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { buildReminderEmail, buildTemplateEmail } from '@/lib/build-email';
import { resolveDesign } from '@/types/email-design';

const resend = new Resend(process.env.RESEND_API_KEY);

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function getSubject(dayOffset: number, invoiceNumber?: string) {
  const inv = invoiceNumber ? ` #${invoiceNumber}` : '';
  if (dayOffset === 0) return `Invoice${inv} — payment due today`;
  if (dayOffset <= 3) return `Friendly reminder — invoice${inv} overdue`;
  if (dayOffset <= 7) return `Follow-up — invoice${inv} still unpaid`;
  return `Final notice — invoice${inv} requires immediate attention`;
}

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
    email_design,
    use_plain_text,
  } = body;

  const formattedAmount = `${currency ?? ''} ${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`.trim();
  const formattedDate = due_date
    ? new Date(due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const vars = {
    client_name: client_name ?? '',
    invoice_number: invoice_number ?? '',
    amount: formattedAmount,
    due_date: formattedDate,
    sender_name: sender_name ?? '',
  };

  const subject = template_subject
    ? substituteVars(template_subject, vars)
    : getSubject(day_offset, invoice_number);

  const design = resolveDesign(email_design);
  const fromName = sender_name || design.brand_name;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'onboarding@resend.dev';
  const filename = invoice_file_url
    ? decodeURIComponent(invoice_file_url.split('/').pop() || 'invoice')
    : null;

  // Plain text mode: send as simple text email (no HTML wrapper)
  if (use_plain_text && template_body) {
    const plainText = substituteVars(template_body, vars);
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: client_email,
      replyTo: freelancer_email,
      subject,
      text: plainText,
      attachments: invoice_file_url && filename ? [{ filename, path: invoice_file_url }] : [],
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id });
  }

  const html = template_body
    ? buildTemplateEmail({
        bodyText: substituteVars(template_body, vars),
        invoice_number, formattedAmount, formattedDate,
        stripe_payment_link, invoice_id, freelancer_email,
        rawDesign: email_design,
      })
    : buildReminderEmail({
        client_name, formattedAmount, formattedDate, invoice_number,
        day_offset, stripe_payment_link, invoice_id,
        freelancer_email, sender_name, rawDesign: email_design,
      });

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to: client_email,
    replyTo: freelancer_email,
    subject,
    html,
    attachments: invoice_file_url && filename ? [{ filename, path: invoice_file_url }] : [],
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
