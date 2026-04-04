'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatDue, formatAmount, isOverdue } from '@/lib/format'
import { INVOICE_STATUS_CONFIG, UNPAID_STATUSES } from '@/constants/invoice'
import type { Invoice } from '@/types/invoice'
import type { ClientOption } from '@/types/client'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { StatsCard } from '@/components/StatsCard'
import { Tabs } from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import {
  Plus, Calendar, Hash, Trash2,
  Wallet, FileStack, Check, X, FileText, ChevronRight,
  LayoutList, LayoutGrid, Bell,
} from 'lucide-react'
import { notifyPaymentPaid, notifyThankYouSent, notifyReminderSent } from '@/lib/notify'

const _cache: { invoices: Invoice[]; clients: Map<string, ClientOption> } = {
  invoices: [],
  clients: new Map(),
}

const PRESET_SCHEDULE: Record<string, number[]> = {
  gentle: [0, 3],
  standard: [0, 3, 7],
  firm: [0, 3, 7, 14],
}

function getScheduledDays(preset: string, tmplMap: Map<string, number>): number[] {
  if (preset?.startsWith('[')) {
    try {
      const ids: string[] = JSON.parse(preset)
      const days = ids.map(id => tmplMap.get(id)).filter((d): d is number => d !== undefined)
      if (days.length > 0) return days.sort((a, b) => a - b)
    } catch { /* fall through */ }
  }
  return PRESET_SCHEDULE[preset] || PRESET_SCHEDULE.standard
}

function fmtRelative(d: Date): string {
  const diff = Math.round((d.getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff < 0) return `${Math.abs(diff)}d ago`
  return `in ${diff}d`
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>(_cache.invoices)
  const [clients, setClients] = useState<Map<string, ClientOption>>(_cache.clients)
  const [loading, setLoading] = useState(_cache.invoices.length === 0)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  const [reminderInfo, setReminderInfo] = useState<Map<string, { lastSentAt: Date | null; nextDate: Date | null }>>(new Map())

  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener('paynudge:refresh', handler)
    return () => window.removeEventListener('paynudge:refresh', handler)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('invoice-view-mode') as 'list' | 'card' | null
    if (saved) setViewMode(saved)
    fetchAll()
  }, [])

  function setView(mode: 'list' | 'card') {
    setViewMode(mode)
    localStorage.setItem('invoice-view-mode', mode)
  }

  async function fetchAll() {
    const [{ data: invData }, { data: clientData }, { data: tmplData }] = await Promise.all([
      supabase.from('invoices').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name, email, avatar_url'),
      supabase.from('email_templates').select('id, day_offset'),
    ])
    const inv = invData || []
    const map = new Map<string, ClientOption>()
    for (const c of (clientData || [])) map.set(c.email.toLowerCase(), c)

    // Build template id→day_offset map for preset resolution
    const tmplMap = new Map<string, number>()
    for (const t of (tmplData || [])) tmplMap.set(t.id, t.day_offset)

    // Fetch reminder logs for active invoices
    const activeIds = inv.filter(i => !['paid', 'cancelled'].includes(i.status)).map(i => i.id)
    let logs: Array<{ invoice_id: string; day_offset: number; sent_at: string }> = []
    if (activeIds.length > 0) {
      const { data: logsData } = await supabase
        .from('reminder_logs')
        .select('invoice_id, day_offset, sent_at')
        .in('invoice_id', activeIds)
        .lt('day_offset', 1000)
      logs = logsData || []
    }

    // Compute last-sent / next-scheduled per invoice
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const infoMap = new Map<string, { lastSentAt: Date | null; nextDate: Date | null }>()
    for (const invoice of inv.filter(i => !['paid', 'cancelled'].includes(i.status))) {
      const iLogs = logs.filter(l => l.invoice_id === invoice.id)
      const sorted = iLogs.slice().sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      const lastSentAt = sorted[0] ? new Date(sorted[0].sent_at) : null
      const sentDays = new Set(iLogs.map(l => l.day_offset))

      const dueDate = new Date(invoice.due_date); dueDate.setHours(0, 0, 0, 0)
      const currentOffset = Math.floor((today.getTime() - dueDate.getTime()) / 86400000)
      const scheduled = getScheduledDays(invoice.reminder_preset, tmplMap)
      const nextDay = scheduled.find(d => d >= currentOffset && !sentDays.has(d))
      const nextDate = nextDay !== undefined
        ? new Date(dueDate.getTime() + nextDay * 86400000)
        : null

      infoMap.set(invoice.id, { lastSentAt, nextDate })
    }

    _cache.invoices = inv
    _cache.clients = map
    setInvoices(inv)
    setClients(map)
    setReminderInfo(infoMap)
    setLoading(false)
  }

  async function sendThankYou(inv: Invoice) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('email, sender_name, email_design, default_template_ids').eq('id', user.id).single()
    const defaultIds = profile?.default_template_ids as { rejection?: string | null; thank_you?: string | null } | null
    const tyTemplateId = defaultIds?.thank_you
    let template = null
    if (tyTemplateId) {
      const { data } = await supabase.from('email_templates').select('*').eq('id', tyTemplateId).single()
      template = data
    } else {
      const { data } = await supabase.from('email_templates').select('*').eq('type', 'thank_you').eq('user_id', user.id).limit(1)
      template = data?.[0] ?? null
    }
    if (profile?.email) {
      fetch('/api/send-thankyou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: inv.client_name,
          client_email: inv.client_email,
          amount: inv.amount,
          currency: inv.currency,
          invoice_number: inv.invoice_number,
          freelancer_email: profile.email,
          sender_name: profile.sender_name,
          template_subject: template?.subject,
          template_body: template?.body,
          email_design: profile.email_design,
        }),
      }).then(async r => {
        if (r.ok) {
          notifyThankYouSent(inv.client_name, inv.invoice_number)
          await supabase.from('reminder_logs').insert({
            invoice_id: inv.id,
            day_offset: 9999,
            email_subject: template?.subject ?? `Thank you — ${inv.client_name}`,
            status: 'sent',
            client_name: inv.client_name,
          })
        }
      })
    }
  }

  async function markAsPaid(inv: Invoice) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    notifyPaymentPaid(inv.client_name, inv.invoice_number)
    sendThankYou(inv)
    fetchAll()
  }

  async function markAsNotReceived(id: string) {
    const res = await fetch('/api/resume-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id }),
    })
    if (res.ok) {
      const inv = invoices.find(i => i.id === id)
      if (inv) notifyReminderSent('Reminder resumed', [inv.client_name])
    }
    fetchAll()
  }

  async function deleteInvoice(id: string) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    fetchAll()
  }

  const filtered = invoices.filter(inv => {
    if (filter === 'pending') return UNPAID_STATUSES.includes(inv.status)
    if (filter === 'paid') return inv.status === 'paid'
    return true
  })

  const overdueCount = invoices.filter(i => isOverdue(i.status, i.due_date)).length
  const unpaidInvoices = invoices.filter(i => !['paid', 'cancelled'].includes(i.status))
  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const primaryCurrency = unpaidInvoices[0]?.currency ?? invoices[0]?.currency ?? 'USD'
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const unpaidCount = invoices.filter(i => !['paid', 'cancelled'].includes(i.status)).length

  const tabs = [
    { id: 'all' as const, label: 'All', count: invoices.length },
    { id: 'pending' as const, label: 'Unpaid', count: invoices.filter(i => UNPAID_STATUSES.includes(i.status)).length },
    { id: 'paid' as const, label: 'Paid', count: paidCount },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade rounded-l-2xl">

      <PageHeader
        icon={FileText}
        title="Invoices"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg bg-black/5 p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-white shadow-sm text-black/70' : 'text-black/35 hover:text-black/55')}
              >
                <LayoutList size={14} strokeWidth={2} />
              </button>
              <button
                onClick={() => setView('card')}
                className={cn('p-1.5 rounded-md transition-colors', viewMode === 'card' ? 'bg-white shadow-sm text-black/70' : 'text-black/35 hover:text-black/55')}
              >
                <LayoutGrid size={14} strokeWidth={2} />
              </button>
            </div>
            <Button asChild variant="accent" className="active:scale-[0.98]">
              <Link href="/invoices/new">
                <Plus size={14} strokeWidth={2.5} />
                New invoice
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex gap-4 px-8 pb-5">
        <StatsCard icon={FileStack} label="Unpaid" value={unpaidCount} sub="invoices pending" color="yellow" className="anim-slide-up anim-d1" />
        <StatsCard icon={Wallet} label="Outstanding" value={formatAmount(totalUnpaid, primaryCurrency)} sub="to be collected" color="blue" className="anim-slide-up anim-d2" />
        <StatsCard
          icon={FileStack}
          label="Overdue"
          value={overdueCount}
          sub={overdueCount > 0 ? 'needs attention' : 'all on track'}
          color={overdueCount > 0 ? 'red' : 'neutral'}
          className="anim-slide-up anim-d3"
        />
        <StatsCard icon={FileStack} label="Paid" value={paidCount} sub="invoices completed" color="green" className="anim-slide-up anim-d4" />
      </div>

      {/* Invoice list / cards */}
      <div className="px-8 pb-20 anim-slide-up anim-d4">
        <Tabs tabs={tabs} active={filter} onChange={setFilter} className="mb-5" />

        {loading ? (
          <LoadingSpinner text="Loading invoices…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice to start sending automatic payment reminders."
            action={
              <Button asChild className="mt-2">
                <Link href="/invoices/new">
                  <Plus size={14} strokeWidth={2.5} />
                  Create invoice
                </Link>
              </Button>
            }
          />
        ) : viewMode === 'list' ? (
          /* ── List view ── */
          <div>
            <div className="flex items-center px-3 pb-2.5 border-b border-border/50">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Client</span>
              </div>
              <div className="w-[130px] shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Due date</span>
              </div>
              <div className="w-[110px] shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Status</span>
              </div>
              <div className="w-[155px] shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Reminders</span>
              </div>
              <div className="w-[130px] shrink-0 text-right pr-4">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Amount</span>
              </div>
              <div className="w-[220px] shrink-0" />
            </div>

            {filtered.map((inv, idx) => {
              const overdue = isOverdue(inv.status, inv.due_date)
              const due = formatDue(inv.due_date)
              const clientRecord = clients.get(inv.client_email.toLowerCase())
              const isPaymentReported = inv.status === 'payment_reported'
              const isLast = idx === filtered.length - 1

              return (
                <div
                  key={inv.id}
                  className={cn(
                    'group flex items-center px-3 transition-colors duration-150',
                    !isLast && 'border-b border-border/40',
                    isPaymentReported ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.04]'
                      : overdue ? 'bg-red-500/[0.015] hover:bg-red-500/[0.03]'
                        : 'hover:bg-black/[0.015]',
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 py-4 pr-4">
                    <Avatar name={inv.client_name} avatarUrl={clientRecord?.avatar_url} size={34} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[15px] font-semibold text-card-foreground truncate leading-snug">{inv.client_name}</span>
                        {inv.invoice_number && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-black/30 font-medium shrink-0">
                            <Hash size={9} strokeWidth={2.5} />{inv.invoice_number}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-black/40 truncate mt-0.5">{inv.client_email}</div>
                    </div>
                  </div>

                  <div className="w-[130px] shrink-0 py-4 flex items-center gap-1.5">
                    <Calendar size={13} strokeWidth={1.8} className={cn('shrink-0', overdue ? 'text-red-400' : 'text-black/20')} />
                    <span className={cn('text-[13px]', overdue ? 'text-red-500 font-semibold' : due.urgent ? 'text-black/70 font-medium' : 'text-black/55')}>
                      {due.text}
                    </span>
                  </div>

                  <div className="w-[110px] shrink-0 py-4">
                    <StatusBadge status={inv.status} overdue={overdue} />
                  </div>

                  <div className="w-[155px] shrink-0 py-4">
                    {(() => {
                      const info = reminderInfo.get(inv.id)
                      if (!info) return <span className="text-[12px] text-black/25">—</span>
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] text-black/40">
                            Last: <span className="text-black/60">{info.lastSentAt ? fmtRelative(info.lastSentAt) : 'none'}</span>
                          </span>
                          <span className="text-[12px] text-black/40">
                            Next: <span className={info.nextDate ? 'text-black/60' : 'text-black/25'}>{info.nextDate ? fmtRelative(info.nextDate) : '—'}</span>
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="w-[130px] shrink-0 py-4 text-right pr-4">
                    <span className="text-[15px] font-bold text-card-foreground tabular-nums">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </span>
                  </div>

                  <div className="w-[220px] shrink-0 py-4 flex items-center justify-end gap-1">
                    {isPaymentReported ? (
                      <>
                        <Button size="sm" onClick={() => markAsPaid(inv)} className="h-7 px-2.5 text-[12px] whitespace-nowrap active:scale-95">
                          <Check size={10} strokeWidth={2.5} />
                          Confirm paid
                        </Button>
                        <Button size="sm" variant="warning" onClick={() => markAsNotReceived(inv.id)} className="h-7 px-2.5 text-[12px] whitespace-nowrap active:scale-95">
                          <X size={10} strokeWidth={2.5} />
                          Dispute
                        </Button>
                      </>
                    ) : (
                      <>
                        {!['paid', 'cancelled'].includes(inv.status) && (
                          <Button size="sm" variant="ghost" onClick={() => markAsPaid(inv)} className="h-7 px-2.5 text-[12px] opacity-0 group-hover:opacity-100 whitespace-nowrap transition-all active:scale-95">
                            Mark paid
                          </Button>
                        )}
                        <Button asChild variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 h-7 px-2.5 text-[12px] text-black/55 bg-black/5 hover:bg-black/10 hover:text-black gap-0.5">
                          <Link href={`/invoices/${inv.id}`}>
                            View <ChevronRight size={11} strokeWidth={2} className="shrink-0" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteInvoice(inv.id)} className="opacity-0 group-hover:opacity-100 shrink-0 active:scale-90 text-black/30 hover:text-red-500 hover:bg-red-50">
                          <Trash2 size={13} strokeWidth={1.8} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Card view ── */
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(inv => {
              const overdue = isOverdue(inv.status, inv.due_date)
              const due = formatDue(inv.due_date)
              const clientRecord = clients.get(inv.client_email.toLowerCase())
              const isPaymentReported = inv.status === 'payment_reported'
              const cfg = INVOICE_STATUS_CONFIG[inv.status]

              return (
                <div
                  key={inv.id}
                  className={cn(
                    'group bg-card rounded-xl border shadow-[var(--shadow-card)] p-5 flex flex-col gap-3 hover:shadow-[var(--shadow-md)] transition-all',
                    isPaymentReported ? 'border-amber-200 bg-amber-50/30'
                      : overdue ? 'border-red-100 bg-red-50/20'
                        : 'border-border/60',
                  )}
                >
                  {/* Header: status + amount */}
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={inv.status} overdue={overdue} />
                    <span className="text-[17px] font-bold text-card-foreground tabular-nums shrink-0">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </span>
                  </div>

                  {/* Client info */}
                  <div className="flex items-center gap-2.5">
                    <Avatar name={inv.client_name} avatarUrl={clientRecord?.avatar_url} size={32} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-card-foreground truncate leading-snug">{inv.client_name}</div>
                      {inv.invoice_number && (
                        <div className="flex items-center gap-0.5 text-[11px] text-black/35">
                          <Hash size={9} strokeWidth={2.5} />{inv.invoice_number}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} strokeWidth={1.8} className={cn('shrink-0', overdue ? 'text-red-400' : 'text-black/25')} />
                    <span className={cn('text-[13px]', overdue ? 'text-red-500 font-semibold' : due.urgent ? 'text-black/70 font-medium' : 'text-black/50')}>
                      {due.text}
                    </span>
                  </div>

                  {/* Reminder info */}
                  {reminderInfo.has(inv.id) && (
                    <div className="flex items-center gap-3 pt-1">
                      <Bell size={11} strokeWidth={1.8} className="text-black/25 shrink-0" />
                      <div className="flex gap-3">
                        <span className="text-[11px] text-black/40">
                          Last: <span className="text-black/55">{reminderInfo.get(inv.id)!.lastSentAt ? fmtRelative(reminderInfo.get(inv.id)!.lastSentAt!) : 'none'}</span>
                        </span>
                        <span className="text-[11px] text-black/40">
                          Next: <span className={reminderInfo.get(inv.id)!.nextDate ? 'text-black/55' : 'text-black/25'}>
                            {reminderInfo.get(inv.id)!.nextDate ? fmtRelative(reminderInfo.get(inv.id)!.nextDate!) : '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-border/40 mt-auto">
                    {isPaymentReported ? (
                      <>
                        <Button size="sm" onClick={() => markAsPaid(inv)} className="flex-1 h-7 text-[12px] active:scale-95">
                          <Check size={10} strokeWidth={2.5} />
                          Confirm paid
                        </Button>
                        <Button size="sm" variant="warning" onClick={() => markAsNotReceived(inv.id)} className="h-7 px-2.5 text-[12px] active:scale-95">
                          <X size={10} strokeWidth={2.5} />
                        </Button>
                      </>
                    ) : (
                      <>
                        {!['paid', 'cancelled'].includes(inv.status) && (
                          <Button size="sm" variant="ghost" onClick={() => markAsPaid(inv)} className="h-7 px-2.5 text-[12px] text-black/50 hover:text-black/80 whitespace-nowrap active:scale-95">
                            Mark paid
                          </Button>
                        )}
                        <Button asChild variant="secondary" size="sm" className="ml-auto h-7 px-2.5 text-[12px] text-black/55 bg-black/5 hover:bg-black/10 hover:text-black gap-0.5">
                          <Link href={`/invoices/${inv.id}`}>
                            View <ChevronRight size={11} strokeWidth={2} />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteInvoice(inv.id)} className="h-7 w-7 text-black/30 hover:text-red-500 hover:bg-red-50">
                          <Trash2 size={12} strokeWidth={1.8} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
