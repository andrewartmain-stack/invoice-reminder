'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyReminderSent, notifyPaymentReported } from '@/lib/notify'

export function refreshUI() {
  window.dispatchEvent(new CustomEvent('paynudge:refresh'))
}

export default function NotificationListener() {
  const supabase = createClient()
  // Dedup: prevent double-notification if both broadcast and postgres_changes fire
  const notifiedIds = useRef(new Set<string>())

  function dedupeNotify(invoiceId: string, clientName: string, invoiceNumber?: string) {
    if (notifiedIds.current.has(invoiceId)) return
    notifiedIds.current.add(invoiceId)
    setTimeout(() => notifiedIds.current.delete(invoiceId), 5000)
    notifyPaymentReported(clientName, invoiceNumber)
  }

  useEffect(() => {
    let reminderChannel: ReturnType<typeof supabase.channel> | null = null
    let broadcastChannel: ReturnType<typeof supabase.channel> | null = null
    let invoiceChannel: ReturnType<typeof supabase.channel> | null = null

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // ── Payment reported (via server broadcast — fires on every click) ──
      broadcastChannel = supabase
        .channel('payment-events')
        .on('broadcast', { event: 'payment_reported' }, (payload) => {
          const p = payload.payload as { user_id?: string; client_name?: string; invoice_number?: string; invoice_id?: string }
          if (p.user_id === user.id) {
            const key = p.invoice_id || `${p.client_name}:${p.invoice_number}`
            dedupeNotify(key, p.client_name || 'Client', p.invoice_number)
            refreshUI()
          }
        })
        .subscribe()

      // ── Invoice status change — also triggers notification as fallback if broadcast missed ──
      invoiceChannel = supabase
        .channel('invoice-status-changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'invoices' },
          (payload) => {
            const row = payload.new as Record<string, unknown>
            if (row.user_id === user.id && row.status === 'payment_reported') {
              dedupeNotify(
                row.id as string,
                (row.client_name as string) || 'Client',
                row.invoice_number as string | undefined,
              )
              refreshUI()
            }
          },
        )
        .subscribe()

      // ── Automated reminder sent by cron (via Realtime postgres_changes) ──
      reminderChannel = supabase
        .channel('notif-reminders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reminder_logs', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Record<string, unknown>
            const clients = Array.isArray(row.client_names)
              ? (row.client_names as string[])
              : [String(row.client_name || 'Client')]
            notifyReminderSent(String(row.email_subject || 'Email sent'), clients)
            refreshUI()
          },
        )
        .subscribe()
    }

    setup()

    return () => {
      if (reminderChannel) supabase.removeChannel(reminderChannel)
      if (broadcastChannel) supabase.removeChannel(broadcastChannel)
      if (invoiceChannel) supabase.removeChannel(invoiceChannel)
    }
  }, [])

  return null
}
