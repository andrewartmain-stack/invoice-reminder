import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    client_name,
    client_email,
    subject,
    body_text,
    freelancer_email,
    sender_name,
  } = body;

  if (!client_email || !subject) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const vars = { client_name: client_name ?? '' };
  const resolvedSubject = substituteVars(subject, vars);
  const resolvedBody = substituteVars(body_text || '', vars);

  const fromName = sender_name || 'PayNudge';
  const fromAddress = process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1] || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to: client_email,
    replyTo: freelancer_email,
    subject: resolvedSubject,
    text: resolvedBody,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}
