// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const APP_URL = Deno.env.get('APP_URL')!;

// Fallback preset schedules for old invoices
const PRESET_DAYS: Record<string, number[]> = {
  gentle: [0, 3],
  standard: [0, 3, 7],
  firm: [0, 3, 7, 14],
};

// Returns { scheduledDays, templateByDay } for an invoice.
// If reminder_preset is a JSON array of template IDs, look them up.
// Otherwise fall back to the old preset names.
async function resolveSchedule(reminderPreset: string) {
  if (reminderPreset?.startsWith('[')) {
    try {
      const templateIds: string[] = JSON.parse(reminderPreset);
      const { data: templates } = await supabase
        .from('email_templates')
        .select('id, day_offset, subject, body')
        .in('id', templateIds);

      if (templates && templates.length > 0) {
        const scheduledDays = templates.map((t) => t.day_offset);
        const templateByDay: Record<number, { subject: string; body: string }> = {};
        for (const t of templates) {
          templateByDay[t.day_offset] = { subject: t.subject, body: t.body };
        }
        return { scheduledDays, templateByDay };
      }
    } catch {
      // fall through to preset fallback
    }
  }

  const scheduledDays = PRESET_DAYS[reminderPreset] || PRESET_DAYS.standard;
  return { scheduledDays, templateByDay: {} };
}

Deno.serve(async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(
        `
        id, user_id, client_name, client_email,
        amount, currency, invoice_number, due_date,
        stripe_payment_link, reminder_preset, status, updated_at, invoice_file_url
      `,
      )
      .in('status', ['pending', 'notified', 'payment_reported']);

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sent = 0;
    const results = [];

    for (const invoice of invoices) {
      // CASE 1: client reminders
      if (invoice.status === 'pending' || invoice.status === 'notified') {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);

        const dayOffset = Math.floor(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        const { scheduledDays, templateByDay } = await resolveSchedule(invoice.reminder_preset);
        if (!scheduledDays.includes(dayOffset)) continue;

        const { data: existingLog } = await supabase
          .from('reminder_logs')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('day_offset', dayOffset)
          .single();

        if (existingLog) continue;

        const { data: profile } = await supabase
          .from('profiles')
          .select('email, sender_name, email_design')
          .eq('id', invoice.user_id)
          .single();

        if (!profile?.email) continue;

        // Use custom template if available for this day, otherwise fall back to built-in logic
        const template = templateByDay[dayOffset];

        const res = await fetch(`${APP_URL}/api/send-reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            freelancer_email: profile.email,
            sender_name: profile.sender_name,
            invoice_file_url: invoice.invoice_file_url,
            template_subject: template?.subject,
            template_body: template?.body,
            email_design: profile.email_design,
          }),
        });

        const emailStatus = res.ok ? 'sent' : 'failed';
        const emailSubject = template?.subject || getSubject(dayOffset, invoice.invoice_number);

        await supabase.from('reminder_logs').insert({
          invoice_id: invoice.id,
          day_offset: dayOffset,
          email_subject: emailSubject,
          status: emailStatus,
          client_name: invoice.client_name,
        });

        if (res.ok && invoice.status === 'pending') {
          await supabase
            .from('invoices')
            .update({ status: 'notified' })
            .eq('id', invoice.id);
        }

        sent++;
        results.push({
          invoice_id: invoice.id,
          type: 'client',
          day_offset: dayOffset,
          status: emailStatus,
        });
        continue;
      }

      // CASE 2: freelancer follow-up when client reported payment but not confirmed
      if (invoice.status === 'payment_reported') {
        const reportedAt = new Date(invoice.updated_at);
        reportedAt.setHours(0, 0, 0, 0);

        const daysSinceReport = Math.floor(
          (today.getTime() - reportedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Look up user's custom follow_up templates; fall back to [2, 5] if none
        const { data: followupTemplates } = await supabase
          .from('email_templates')
          .select('id, day_offset, subject, body')
          .eq('user_id', invoice.user_id)
          .eq('type', 'follow_up');

        const followupDays = followupTemplates && followupTemplates.length > 0
          ? followupTemplates.map((t) => t.day_offset)
          : [2, 5];

        if (!followupDays.includes(daysSinceReport)) continue;

        const followupTemplate = followupTemplates?.find((t) => t.day_offset === daysSinceReport);

        const { data: existingFollowup } = await supabase
          .from('reminder_logs')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('day_offset', 1000 + daysSinceReport)
          .single();

        if (existingFollowup) continue;

        const { data: profile } = await supabase
          .from('profiles')
          .select('email, sender_name, email_design')
          .eq('id', invoice.user_id)
          .single();

        if (!profile?.email) continue;

        const res = await fetch(`${APP_URL}/api/send-followup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freelancer_email: profile.email,
            client_name: invoice.client_name,
            amount: invoice.amount,
            currency: invoice.currency,
            invoice_number: invoice.invoice_number,
            invoice_id: invoice.id,
            days_since_report: daysSinceReport,
            sender_name: profile.sender_name,
            template_subject: followupTemplate?.subject,
            template_body: followupTemplate?.body,
            email_design: profile.email_design,
          }),
        });

        const emailStatus = res.ok ? 'sent' : 'failed';

        await supabase.from('reminder_logs').insert({
          invoice_id: invoice.id,
          day_offset: 1000 + daysSinceReport,
          email_subject: `Follow-up: ${invoice.client_name} reported payment ${daysSinceReport} days ago`,
          status: emailStatus,
          client_name: invoice.client_name,
        });

        sent++;
        results.push({
          invoice_id: invoice.id,
          type: 'freelancer_followup',
          days_since_report: daysSinceReport,
          status: emailStatus,
        });
      }
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
