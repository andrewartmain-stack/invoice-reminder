'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Paperclip, Calendar, Hash, Clock, Inbox, Zap, Bell, MessageSquare, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate, isOverdue } from '@/lib/format'
import { INVOICE_STATUS_CONFIG } from '@/constants/invoice'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { SectionCard } from '@/components/SectionCard'
import { notifyPaymentPaid, notifyThankYouSent, notifyReminderSent } from '@/lib/notify'
import type { Invoice } from '@/types/invoice'
import type { ReminderLog } from '@/types/reminder-log'
import type { EmailTemplate } from '@/types/email-template'

type TemplateRef = Pick<EmailTemplate, 'name' | 'day_offset'>

function logTypeIcon(dayOffset: number, status: string) {
  if (status !== 'sent') return { Icon: XCircle, color: 'text-red-400', bg: 'bg-red-50', label: 'Failed' }
  if (dayOffset >= 9999) return { Icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Thank you' }
  if (dayOffset >= 1000) return { Icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Follow-up' }
  return { Icon: Bell, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Reminder' }
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-black/6 last:border-b-0">
      <span className="text-[12px] font-semibold text-black/35 uppercase tracking-wider w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-[14px] text-foreground flex-1">{children}</span>
    </div>
  )
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const supabase = createClient()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [templates, setTemplates] = useState<TemplateRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('paynudge:refresh', handler)
    return () => window.removeEventListener('paynudge:refresh', handler)
  }, [])

  async function fetchData() {
    const [{ data: inv }, { data: logData }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('reminder_logs').select('*').eq('invoice_id', id).order('sent_at', { ascending: true }),
    ])
    setInvoice(inv)
    setLogs(logData || [])

    if (inv?.reminder_preset && inv.reminder_preset.startsWith('[')) {
      try {
        const ids: string[] = JSON.parse(inv.reminder_preset)
        if (ids.length > 0) {
          const { data: tplData } = await supabase
            .from('email_templates')
            .select('name, day_offset')
            .in('id', ids)
          setTemplates(tplData || [])
        }
      } catch {
        setTemplates([])
      }
    } else {
      setTemplates([])
    }

    setLoading(false)
  }

  async function updateStatus(status: string) {
    await supabase.from('invoices').update({ status }).eq('id', id)
    fetchData()
  }

  async function markAsPaid() {
    if (!invoice) return
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    notifyPaymentPaid(invoice.client_name, invoice.invoice_number)
    // Send thank you email (best-effort, non-blocking)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
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
            client_name: invoice.client_name,
            client_email: invoice.client_email,
            amount: invoice.amount,
            currency: invoice.currency,
            invoice_number: invoice.invoice_number,
            freelancer_email: profile.email,
            sender_name: profile.sender_name,
            template_subject: template?.subject,
            template_body: template?.body,
            email_design: profile.email_design,
          }),
        }).then(async r => {
          if (r.ok) {
            notifyThankYouSent(invoice!.client_name, invoice!.invoice_number)
            await supabase.from('reminder_logs').insert({
              invoice_id: id,
              day_offset: 9999,
              email_subject: template?.subject
                ? template.subject.replace(/\{\{invoice_number\}\}/g, invoice!.invoice_number ?? '')
                : `Thank you — ${invoice!.client_name}`,
              status: 'sent',
              client_name: invoice!.client_name,
            })
            fetchData()
          }
        })
      }
    }
    fetchData()
  }

  async function deleteInvoice() {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    router.push('/invoices')
  }

  const BackLink = (
    <Link href="/invoices" className="flex items-center gap-1.5 text-[14px] text-black/45 hover:text-black no-underline transition-colors font-medium">
      <ArrowLeft size={14} strokeWidth={2} />
      Invoices
    </Link>
  )

  if (loading) return (
    <div className="min-h-screen bg-background font-[Inter,sans-serif]">
      <header className="flex items-center px-8 h-16">{BackLink}</header>
      <LoadingSpinner />
    </div>
  )

  if (!invoice) return (
    <div className="min-h-screen bg-background font-[Inter,sans-serif]">
      <header className="flex items-center px-8 h-16">{BackLink}</header>
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">Invoice not found.</div>
    </div>
  )

  const cfg = INVOICE_STATUS_CONFIG[invoice.status] ?? INVOICE_STATUS_CONFIG.pending
  const overdue = isOverdue(invoice.status, invoice.due_date)
  const filename = invoice.invoice_file_url
    ? invoice.invoice_file_url.split('/').pop() || 'Attached file'
    : null

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade rounded-l-2xl">

      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-8 pb-5">
        {BackLink}
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
          <span className={cn('text-[13px] font-semibold', cfg.text)}>{cfg.label}</span>
        </div>
      </header>

      <div className="px-8 pb-20 flex flex-col gap-6">

        {/* Hero */}
        <div className={cn('flex items-center justify-between gap-6 px-8 py-7 rounded-2xl anim-slide-up', cfg.bg)}>
          <div className="flex items-center gap-5">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-bold text-card-foreground tracking-tight m-0 leading-none">{invoice.client_name}</h1>
                {invoice.invoice_number && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-black/35 font-medium">
                    <Hash size={10} strokeWidth={2.5} />{invoice.invoice_number}
                  </span>
                )}
              </div>
              <p className="text-[14px] text-black/45 mt-1.5 m-0">{invoice.client_email}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-semibold text-black/35 uppercase tracking-wider mb-1.5">Amount due</div>
            <div className="text-[2rem] font-bold text-card-foreground tracking-tight tabular-nums">
              {invoice.currency} {Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className={cn('text-[13px] font-medium mt-1.5', overdue ? 'text-red-500' : 'text-black/40')}>
              Due {formatDate(invoice.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}
              {overdue && ' · Overdue'}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_360px] gap-6 items-start">

          {/* Left: Details + Log */}
          <div className="flex flex-col gap-5 anim-slide-up anim-d1">

            <SectionCard title="Invoice details">
              <div className="px-6">
                <MetaRow label="Due date">
                  <span className={cn('flex items-center gap-2', overdue && 'text-red-500 font-semibold')}>
                    <Calendar size={13} strokeWidth={1.8} className={overdue ? 'text-red-400' : 'text-black/25'} />
                    {formatDate(invoice.due_date, { month: 'long', day: 'numeric', year: 'numeric' })}
                    {overdue && <span className="text-red-400 font-medium">· Overdue</span>}
                  </span>
                </MetaRow>
                {invoice.invoice_number && (
                  <MetaRow label="Invoice #">
                    <span className="flex items-center gap-1.5">
                      <Hash size={13} strokeWidth={1.8} className="text-black/25" />
                      {invoice.invoice_number}
                    </span>
                  </MetaRow>
                )}
                <MetaRow label="Created">
                  <span className="flex items-center gap-2">
                    <Clock size={13} strokeWidth={1.8} className="text-black/25" />
                    {formatDate(invoice.created_at)}
                  </span>
                </MetaRow>
                <MetaRow label="Schedule">
                  {templates.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {templates
                        .slice()
                        .sort((a, b) => a.day_offset - b.day_offset)
                        .map((t, i) => (
                          <span key={i} className="inline-flex items-center text-[12px] font-medium px-2.5 py-1 rounded-lg bg-black/5 text-black/60">
                            {t.day_offset === 0 ? 'Day 0' : `Day +${t.day_offset}`} · {t.name}
                          </span>
                        ))}
                    </span>
                  ) : (
                    <span className="capitalize text-black/55">{invoice.reminder_preset}</span>
                  )}
                </MetaRow>
                {invoice.stripe_payment_link && (
                  <MetaRow label="Payment link">
                    <a href={invoice.stripe_payment_link} target="_blank" rel="noreferrer" className="text-black font-medium hover:underline no-underline flex items-center gap-1">
                      Open payment link <span className="text-black/35">↗</span>
                    </a>
                  </MetaRow>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Reminder history"
              badge={logs.length > 0 ? (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-black/6 text-black/40">{logs.length}</span>
              ) : undefined}
            >
              <div className="px-6 py-5">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 py-8 text-center">
                    <Inbox size={28} strokeWidth={1.5} className="text-black/20" />
                    <p className="text-[14px] text-black/35 m-0">No reminders sent yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {logs.map((log, i) => {
                      const { Icon, color, bg, label } = logTypeIcon(log.day_offset, log.status)
                      return (
                        <div key={log.id} className="flex items-start gap-3 pb-5 last:pb-0">
                          <div className="flex flex-col items-center shrink-0">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', bg)}>
                              <Icon size={14} strokeWidth={1.8} className={color} />
                            </div>
                            {i < logs.length - 1 && <div className="w-px flex-1 min-h-5 bg-black/8 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', color)}>{label}</span>
                            </div>
                            <p className="text-[13px] font-medium text-foreground m-0 mb-0.5 leading-snug">
                              {log.email_subject || `Email day +${log.day_offset}`}
                            </p>
                            <p className="text-[11px] text-black/35 m-0">
                              {formatDate(log.sent_at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Right: Actions + Attachment + Danger */}
          <div className="flex flex-col gap-4 anim-slide-up anim-d2">

            {/* Actions */}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <SectionCard title="Actions">
                <div className="p-5 flex flex-col gap-2.5">
                  {invoice.status === 'payment_reported' ? (
                    <>
                      <Button size="lg" className="w-full active:scale-[0.98]" onClick={markAsPaid}>
                        ✓ Confirm payment received
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="w-full active:scale-[0.98]"
                        onClick={async () => {
                          const res = await fetch('/api/resume-reminders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ invoice_id: invoice.id }),
                          })
                          if (res.ok) notifyReminderSent('Reminder resumed', [invoice.client_name])
                          fetchData()
                        }}
                      >
                        ✗ Not received — resume reminders
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="lg" className="w-full active:scale-[0.98]" onClick={markAsPaid}>
                        Mark as paid
                      </Button>
                      <Button size="lg" variant="secondary" className="w-full active:scale-[0.98]" onClick={() => updateStatus('cancelled')}>
                        Cancel reminders
                      </Button>
                    </>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Attached file */}
            {invoice.invoice_file_url && (
              <SectionCard title="Attachment">
                <div className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                    <Paperclip size={16} strokeWidth={1.8} className="text-black/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-card-foreground m-0 truncate">{filename}</p>
                    <p className="text-[12px] text-black/40 m-0 mt-0.5">Invoice file</p>
                  </div>
                  <a
                    href={invoice.invoice_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-semibold text-black hover:underline no-underline shrink-0"
                  >
                    View ↗
                  </a>
                </div>
              </SectionCard>
            )}

            {/* Reminder preset */}
            {templates.length === 0 && invoice.reminder_preset && (
              <SectionCard title="Reminder preset" titleIcon={Zap}>
                <div className="p-5">
                  <span className="text-[14px] capitalize text-black/60">{invoice.reminder_preset}</span>
                </div>
              </SectionCard>
            )}

            {/* Delete */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-red-100 bg-red-50/50">
              <div>
                <p className="text-[13px] font-semibold text-red-600 m-0 mb-0.5">Delete invoice</p>
                <p className="text-[12px] text-red-400 m-0">This cannot be undone.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={deleteInvoice} className="shrink-0 active:scale-95">Delete</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
