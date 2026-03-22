import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Используем service role — это server-side, RLS не нужен
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const invoice_id = searchParams.get('invoice_id');

  if (!invoice_id) {
    return new Response('Invalid link.', { status: 400 });
  }

  // Меняем статус на payment_reported
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'payment_reported' })
    .eq('id', invoice_id)
    .in('status', ['pending', 'notified']); // не перезаписываем paid/cancelled

  if (error) {
    return new Response('Something went wrong.', { status: 500 });
  }

  // Простая страница подтверждения
  return new Response(
    `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment reported</title>
  <style>
    body {
      margin: 0;
      background: #0a0a0a;
      color: #e5e5e5;
      font-family: monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 12px;
    }
    h1 { font-size: 18px; margin: 0; color: #fff; }
    p  { font-size: 13px; color: #555; margin: 0; }
  </style>
</head>
<body>
  <h1>✓ Got it, thanks.</h1>
  <p>We've notified the sender that your payment is on the way.</p>
</body>
</html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}
