// @ts-nocheck
// supabase/functions/send-reminders/index.ts
// Запускается каждый день через cron
// Находит инвойсы которым нужно отправить напоминание и вызывает /api/send-reminder

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const APP_URL = Deno.env.get('APP_URL')!; // твой домен на Vercel

// Расписание по пресетам: сколько дней после due_date отправлять
const PRESET_DAYS: Record<string, number[]> = {
  gentle: [0, 3],
  standard: [0, 3, 7],
  firm: [0, 3, 7, 14],
};

Deno.serve(async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Берём все активные инвойсы
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(
        `
        id, user_id, client_name, client_email,
        amount, currency, invoice_number, due_date,
        stripe_payment_link, reminder_preset, status
      `,
      )
      .in('status', ['pending', 'notified']);

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sent = 0;
    const results = [];

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // Дней прошло с due_date (отрицательное = ещё не наступило)
      const dayOffset = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const scheduledDays =
        PRESET_DAYS[invoice.reminder_preset] || PRESET_DAYS.standard;

      // Нужно ли сегодня отправлять?
      if (!scheduledDays.includes(dayOffset)) continue;

      // Уже отправляли сегодня этот offset?
      const { data: existingLog } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('invoice_id', invoice.id)
        .eq('day_offset', dayOffset)
        .single();

      if (existingLog) continue; // уже отправлено

      // Получаем email фрилансера из auth.users
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(invoice.user_id);

      if (!user?.email) continue;

      // Вызываем /api/send-reminder
      const res = await fetch(`${APP_URL}/api/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': Deno.env.get('CRON_SECRET')!,
        },
        body: JSON.stringify({
          client_name: invoice.client_name,
          client_email: invoice.client_email,
          amount: invoice.amount,
          currency: invoice.currency,
          invoice_number: invoice.invoice_number,
          due_date: invoice.due_date,
          stripe_payment_link: invoice.stripe_payment_link,
          invoice_id: invoice.id,
          day_offset: dayOffset,
          freelancer_email: user.email,
        }),
      });

      const emailStatus = res.ok ? 'sent' : 'failed';

      // Логируем отправку
      await supabase.from('reminder_logs').insert({
        invoice_id: invoice.id,
        day_offset: dayOffset,
        email_subject: getSubject(dayOffset, invoice.invoice_number),
        status: emailStatus,
      });

      // Обновляем статус инвойса на notified
      if (res.ok && invoice.status === 'pending') {
        await supabase
          .from('invoices')
          .update({ status: 'notified' })
          .eq('id', invoice.id);
      }

      sent++;
      results.push({
        invoice_id: invoice.id,
        day_offset: dayOffset,
        status: emailStatus,
      });
    }

    return new Response(JSON.stringify({ sent, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});

function getSubject(dayOffset: number, invoiceNumber?: string) {
  const inv = invoiceNumber ? ` #${invoiceNumber}` : '';
  if (dayOffset === 0) return `Invoice${inv} — payment due today`;
  if (dayOffset <= 3) return `Friendly reminder — invoice${inv} overdue`;
  if (dayOffset <= 7) return `Follow-up — invoice${inv} still unpaid`;
  return `Final notice — invoice${inv} requires immediate attention`;
}
