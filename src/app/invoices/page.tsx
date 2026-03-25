'use client'

import { useEffect, useState, useMemo } from 'react'
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
import dynamic from 'next/dynamic'

const LineChart = dynamic(() => import('@/components/LineChart').then(m => m.LineChart), { ssr: false })

import {
  Plus, Calendar, Hash, Trash2,
  Wallet, FileStack, Check, X, FileText, ChevronRight,
} from 'lucide-react'

const _cache: { invoices: Invoice[]; clients: Map<string, ClientOption> } = {
  invoices: [],
  clients: new Map(),
}

function buildChartData(invoices: Invoice[]) {
  const map: Record<string, { invoiced: number; collected: number }> = {}
  for (const inv of invoices) {
    const d = new Date(inv.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map[key]) map[key] = { invoiced: 0, collected: 0 }
    map[key].invoiced += Number(inv.amount)
    if (inv.status === 'paid') map[key].collected += Number(inv.amount)
  }
  const sorted = Object.keys(map).sort()
  const labels = sorted.map(k => {
    const [y, m] = k.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  })
  return {
    labels,
    series: [
      { label: 'Invoiced', data: sorted.map(k => map[k].invoiced), color: '#1a1a1a' },
      { label: 'Collected', data: sorted.map(k => map[k].collected), color: '#10b981' },
    ],
  }
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Invoice[]>(_cache.invoices)
  const [clients, setClients] = useState<Map<string, ClientOption>>(_cache.clients)
  const [loading, setLoading] = useState(_cache.invoices.length === 0)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: invData }, { data: clientData }] = await Promise.all([
      supabase.from('invoices').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name, email, avatar_url'),
    ])
    const inv = invData || []
    const map = new Map<string, ClientOption>()
    for (const c of (clientData || [])) map.set(c.email.toLowerCase(), c)
    _cache.invoices = inv
    _cache.clients = map
    setInvoices(inv)
    setClients(map)
    setLoading(false)
  }

  async function markAsPaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    fetchAll()
  }

  async function markAsNotReceived(id: string) {
    await fetch('/api/resume-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id }),
    })
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
  const totalUnpaid = invoices
    .filter(i => !['paid', 'cancelled'].includes(i.status))
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const unpaidCount = invoices.filter(i => !['paid', 'cancelled'].includes(i.status)).length

  const chartData = useMemo(() => buildChartData(invoices), [invoices])

  const tabs = [
    { id: 'all' as const, label: 'All', count: invoices.length },
    { id: 'pending' as const, label: 'Unpaid', count: invoices.filter(i => UNPAID_STATUSES.includes(i.status)).length },
    { id: 'paid' as const, label: 'Paid', count: paidCount },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade">

      <PageHeader
        icon={FileText}
        title="Invoices"
        action={
          <Button asChild className="active:scale-[0.98]">
            <Link href="/invoices/new">
              <Plus size={14} strokeWidth={2.5} />
              New invoice
            </Link>
          </Button>
        }
      />

      {/* Stats cards */}
      <div className="flex gap-4 px-8 pb-5">
        <StatsCard icon={FileStack} label="Unpaid" value={unpaidCount} sub="invoices pending" color="yellow" className="anim-slide-up anim-d1" />
        <StatsCard icon={Wallet} label="Outstanding" value={formatAmount(totalUnpaid, '$')} sub="to be collected" color="blue" className="anim-slide-up anim-d2" />
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

      {/* Chart */}
      {/* <div className="mx-8 mb-6 p-6 bg-white rounded-2xl border border-black/[0.07] anim-slide-up anim-d3">
        {!loading && chartData.labels.length > 0 ? (
          <LineChart series={chartData.series} labels={chartData.labels} currencySymbol="$" />
        ) : (
          <div className="flex flex-col gap-2 h-50 items-center justify-center">
            <span className="text-[13px] text-black/30">No invoice data yet</span>
            <span className="text-[12px] text-black/20">Chart will appear once you create invoices</span>
          </div>
        )}
      </div> */}

      {/* Invoice list */}
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
        ) : (
          <div>
            {/* Column headers */}
            <div className="flex items-center px-3 pb-2.5 border-b border-border/50">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Client</span>
              </div>
              <div className="w-[145px] shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Due date</span>
              </div>
              <div className="w-[120px] shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Status</span>
              </div>
              <div className="w-[170px] shrink-0 text-right pr-12">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Amount</span>
              </div>
              <div className="w-[160px] shrink-0" />
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
                  {/* Client */}
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

                  {/* Due date */}
                  <div className="w-[145px] shrink-0 py-4 flex items-center gap-1.5">
                    <Calendar size={13} strokeWidth={1.8} className={cn('shrink-0', overdue ? 'text-red-400' : 'text-black/20')} />
                    <span className={cn('text-[14px]', overdue ? 'text-red-500 font-semibold' : due.urgent ? 'text-black/70 font-medium' : 'text-black/55')}>
                      {due.text}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-[120px] shrink-0 py-4">
                    <StatusBadge status={inv.status} overdue={overdue} />
                  </div>

                  {/* Amount */}
                  <div className="w-[170px] shrink-0 py-4 text-right pr-12">
                    <span className="text-[15px] font-bold text-card-foreground tabular-nums">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="w-[160px] shrink-0 py-4 flex items-center justify-end gap-1">
                    {isPaymentReported ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => markAsPaid(inv.id)}
                          className="h-7 px-2.5 text-[12px] whitespace-nowrap active:scale-95"
                        >
                          <Check size={10} strokeWidth={2.5} />
                          Confirm paid
                        </Button>
                        <Button
                          size="sm"
                          variant="warning"
                          onClick={() => markAsNotReceived(inv.id)}
                          className="h-7 px-2.5 text-[12px] whitespace-nowrap active:scale-95"
                        >
                          <X size={10} strokeWidth={2.5} />
                          Dispute
                        </Button>
                      </>
                    ) : (
                      <>
                        {!['paid', 'cancelled'].includes(inv.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsPaid(inv.id)}
                            className="h-7 px-2.5 text-[12px] opacity-0 group-hover:opacity-100 whitespace-nowrap transition-all active:scale-95"
                          >
                            Mark paid
                          </Button>
                        )}
                        <Button asChild variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 h-7 px-2.5 text-[12px] text-black/55 bg-black/5 hover:bg-black/10 hover:text-black gap-0.5">
                          <Link href={`/invoices/${inv.id}`}>
                            View <ChevronRight size={11} strokeWidth={2} className="shrink-0" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteInvoice(inv.id)}
                          className="opacity-0 group-hover:opacity-100 shrink-0 active:scale-90 text-black/30 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
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
