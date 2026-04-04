import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { buildThankYouEmail, buildThankYouFromTemplate } from '@/lib/build-email';
import { resolveDesign } from '@/types/email-design';

const resend = new Resend(process.env.RESEND_API_KEY);

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    client_name,
    client_email,
    amount,
    currency,
    invoice_number,
    freelancer_email,
    sender_name,
    template_subject,
    template_body,
    email_design,
  } = body;

  const formattedAmount = `${currency ?? ''} ${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`.trim();
  const inv = invoice_number ? ` #${invoice_number}` : '';

  const vars = {
    client_name: client_name ?? '',
    invoice_number: invoice_number ?? '',
    amount: formattedAmount,
    sender_name: sender_name ?? '',
  };

  const subject = template_subject
    ? substituteVars(template_subject, vars)
    : `Thank you for your payment${inv}`;

  const html = template_body
    ? buildThankYouFromTemplate({ bodyText: substituteVars(template_body, vars), rawDesign: email_design })
    : buildThankYouEmail({ client_name, inv, formattedAmount, sender_name, rawDesign: email_design });

  const design = resolveDesign(email_design);
  const fromName = sender_name || design.brand_name;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to: client_email,
    replyTo: freelancer_email,
    subject,
    html,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
