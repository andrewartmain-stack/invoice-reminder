'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Pencil, Trash2, Plus, Camera, Mail, Phone,
  LayoutList, LayoutGrid, Send, X, Check, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getInitials, formatAmount } from '@/lib/format'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import { notifyMessageSent } from '@/lib/notify'
import type { Client } from '@/types/client'
import type { Invoice } from '@/types/invoice'
import type { EmailTemplate } from '@/types/email-template'
import type { Profile } from '@/types/profile'
import { TEMPLATE_TYPE_CONFIG } from '@/constants/email-templates'

type FormState = { name: string; email: string; company: string; phone: string }
const EMPTY_FORM: FormState = { name: '', email: '', company: '', phone: '' }

type DebtInfo = { total: number; currency: string; maxOverdueDays: number; invoiceCount: number }

function fmtRelative(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clientLastReminder, setClientLastReminder] = useState<Map<string, Date>>(new Map())
  const [loading, setLoading] = useState(true)

  // Edit/create panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')

  // Search & filter
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'debt' | 'overdue'>('all')

  // Multi-select & manual send
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sending, setSending] = useState(false)

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')

  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener('paynudge:refresh', handler)
    return () => window.removeEventListener('paynudge:refresh', handler)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('client-view-mode') as 'list' | 'card' | null
    if (saved) setViewMode(saved)
    fetchAll()
  }, [])

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: clientData }, { data: invData }, { data: profileData }, { data: templateData }] = await Promise.all([
      supabase.from('clients').select('*').order('name', { ascending: true }),
      supabase.from('invoices').select('id, client_email, client_name, amount, currency, due_date, status, invoice_number, stripe_payment_link, invoice_file_url, reminder_preset, created_at').in('status', ['pending', 'notified', 'payment_reported']),
      user ? supabase.from('profiles').select('id, email, full_name, sender_name, plan, email_design').eq('id', user.id).single() : Promise.resolve({ data: null }),
      supabase.from('email_templates').select('*').order('day_offset', { ascending: true }),
    ])
    setClients(clientData || [])
    setInvoices(invData || [])
    setProfile(profileData)
    setTemplates(templateData || [])
    if (templateData && templateData.length > 0) setSelectedTemplateId(id => id || templateData[0].id)

    // Build per-client last reminder date from reminder_logs
    const activeInvIds = (invData || []).map((i: { id: string }) => i.id)
    const emailById = new Map((invData || []).map((i: { id: string; client_email: string }) => [i.id, i.client_email.toLowerCase()]))
    if (activeInvIds.length > 0) {
      const { data: logData } = await supabase
        .from('reminder_logs')
        .select('invoice_id, sent_at')
        .in('invoice_id', activeInvIds)
        .lt('day_offset', 1000)
      const lastMap = new Map<string, Date>()
      for (const log of logData || []) {
        const email = emailById.get(log.invoice_id)
        if (!email) continue
        const d = new Date(log.sent_at)
        const existing = lastMap.get(email)
        if (!existing || d > existing) lastMap.set(email, d)
      }
      setClientLastReminder(lastMap)
    } else {
      setClientLastReminder(new Map())
    }

    setLoading(false)
  }

  // Compute per-client debt
  const clientDebt = useMemo(() => {
    const map = new Map<string, DebtInfo>()
    for (const inv of invoices) {
      const email = inv.client_email.toLowerCase()
      if (!map.has(email)) map.set(email, { total: 0, currency: inv.currency, maxOverdueDays: 0, invoiceCount: 0 })
      const entry = map.get(email)!
      entry.total += Number(inv.amount)
      entry.invoiceCount++
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
      if (daysOverdue > entry.maxOverdueDays) entry.maxOverdueDays = daysOverdue
    }
    return map
  }, [invoices])

  function setView(mode: 'list' | 'card') {
    setViewMode(mode)
    localStorage.setItem('client-view-mode', mode)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openNew() {
    setEditingId(null); setForm(EMPTY_FORM)
    setAvatarFile(null); setAvatarPreview(null); setCurrentAvatarUrl(null)
    setError(''); setPanelOpen(true)
  }

  function openEdit(client: Client) {
    setEditingId(client.id)
    setForm({ name: client.name, email: client.email, company: client.company || '', phone: client.phone || '' })
    setAvatarFile(null); setAvatarPreview(null)
    setCurrentAvatarUrl(client.avatar_url || null)
    setError(''); setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false); setEditingId(null); setForm(EMPTY_FORM)
    setAvatarFile(null); setAvatarPreview(null); setCurrentAvatarUrl(null); setError('')
  }

  function setField(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(file: File, clientId: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `clients/${clientId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { console.error('Avatar upload failed:', uploadError.message); return null }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(), email: form.email.trim(),
      company: form.company.trim() || null, phone: form.phone.trim() || null,
    }
    let clientId = editingId
    if (editingId) {
      const { error: err } = await supabase.from('clients').update(payload).eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error: err } = await supabase
        .from('clients').insert({ ...payload, user_id: user?.id }).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      clientId = inserted.id
    }
    if (avatarFile && clientId) {
      const url = await uploadAvatar(avatarFile, clientId)
      if (url) await supabase.from('clients').update({ avatar_url: url }).eq('id', clientId)
    }
    setSaving(false); closePanel(); fetchAll()
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client?')) return
    await supabase.from('clients').delete().eq('id', id)
    fetchAll()
  }

  function openCompose() {
    const template = templates.find(t => t.id === selectedTemplateId)
    setComposeSubject(template?.subject ?? '')
    setComposeBody(template?.body ?? '')
    setComposeOpen(true)
  }

  async function handleManualSend() {
    if (!profile?.email || !composeSubject.trim()) return
    setSending(true)
    const sentClients: string[] = []

    try {
      const selectedClients = clients.filter(c => selected.has(c.id))
      const selectedEmails = new Set(selectedClients.map(c => c.email.toLowerCase()))

      // Clients with active invoices — send with invoice context
      const invoicesByEmail = new Map<string, Invoice>()
      for (const inv of invoices) {
        if (selectedEmails.has(inv.client_email.toLowerCase()) && ['pending', 'notified'].includes(inv.status)) {
          if (!invoicesByEmail.has(inv.client_email.toLowerCase())) {
            invoicesByEmail.set(inv.client_email.toLowerCase(), inv)
          }
        }
      }

      for (const [, inv] of invoicesByEmail) {
        try {
          const res = await fetch('/api/send-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_name: inv.client_name,
              client_email: inv.client_email,
              amount: inv.amount,
              currency: inv.currency,
              invoice_number: inv.invoice_number,
              due_date: inv.due_date,
              stripe_payment_link: inv.stripe_payment_link,
              invoice_id: inv.id,
              day_offset: 0,
              freelancer_email: profile.email,
              sender_name: profile.sender_name,
              invoice_file_url: inv.invoice_file_url,
              template_subject: composeSubject,
              template_body: composeBody,
              use_plain_text: true,
            }),
          })
          if (res.ok) sentClients.push(inv.client_name || inv.client_email)
        } catch { /* continue */ }
      }

      // Clients without active invoices — send plain custom email
      const noInvoiceClients = selectedClients.filter(c => !invoicesByEmail.has(c.email.toLowerCase()))
      for (const client of noInvoiceClients) {
        try {
          const res = await fetch('/api/send-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_name: client.name,
              client_email: client.email,
              subject: composeSubject,
              body_text: composeBody,
              freelancer_email: profile.email,
              sender_name: profile.sender_name,
            }),
          })
          if (res.ok) sentClients.push(client.name || client.email)
        } catch { /* continue */ }
      }

      if (sentClients.length > 0) {
        notifyMessageSent(sentClients)
        setSelected(new Set())
        setComposeOpen(false)
      }
    } catch (err) {
      console.error('handleManualSend error:', err)
    } finally {
      setSending(false)
    }
  }

  const displayAvatar = avatarPreview || currentAvatarUrl
  const formInitials = getInitials(form.name.trim(), '?')

  const filteredClients = clients.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
    const debt = clientDebt.get(c.email.toLowerCase())
    const matchesFilter =
      filter === 'all' ? true :
        filter === 'debt' ? !!debt :
          (debt?.maxOverdueDays ?? 0) > 0
    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade rounded-l-2xl">

      <PageHeader
        icon={Users}
        title="Clients"
        action={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-black/50">{selected.size} selected</span>
                {templates.length > 0 && (
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="h-8 border border-black/12 rounded-lg px-2.5 text-[13px] text-black/70 bg-white outline-none focus:border-black/30 cursor-pointer max-w-[200px]"
                  >
                    <option value="">— blank message —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <Button
                  size="sm"
                  onClick={openCompose}
                  disabled={!profile?.email}
                  className="h-8 gap-1.5"
                >
                  <Send size={11} strokeWidth={2.5} />
                  Compose
                </Button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="p-1.5 rounded-lg text-black/35 hover:text-black/60 hover:bg-black/5 transition-colors"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            )}
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
            <Button onClick={openNew} variant="accent" className="active:scale-[0.98]">
              <Plus size={14} strokeWidth={2.5} />
              New client
            </Button>
          </div>
        }
      />

      <div className="px-8 pb-20 anim-slide-up anim-d1">

        {/* Search & filter bar */}
        {!loading && clients.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-8 pr-3 py-2 text-[13px] bg-black/[0.04] border border-transparent rounded-lg outline-none focus:bg-white focus:border-border transition-colors placeholder:text-black/30"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'debt', 'overdue'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors',
                    filter === f ? 'bg-black text-white' : 'text-black/40 hover:text-black/65 hover:bg-black/5',
                  )}
                >
                  {f === 'all' ? 'All' : f === 'debt' ? 'With debt' : 'Overdue'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner text="Loading clients…" />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to get started."
            action={
              <Button onClick={openNew} className="mt-2">
                <Plus size={14} strokeWidth={2.5} />
                Add client
              </Button>
            }
          />
        ) : viewMode === 'list' ? (
          /* ── List view ── */
          <div>
            <div className="flex items-center px-3 pb-2.5 border-b border-border/50">
              <div className="w-8 shrink-0" />
              <div className="w-[46px] shrink-0" />
              <div className="w-48 shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Name</span>
              </div>
              <div className="w-56 shrink-0 pl-6">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Email</span>
              </div>
              <div className="w-36 shrink-0 pl-6">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Company</span>
              </div>
              <div className="w-28 shrink-0 pl-6">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Amount</span>
              </div>
              <div className="w-24 shrink-0 pl-6">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Overdue</span>
              </div>
              <div className="w-44 shrink-0 pl-10">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Last Reminder</span>
              </div>
              <div className="flex-1" />
              <div className="w-16 shrink-0" />
            </div>

            {filteredClients.map((client, idx) => {
              const debt = clientDebt.get(client.email.toLowerCase())
              const isSelected = selected.has(client.id)
              return (
                <div
                  key={client.id}
                  className={cn(
                    'group flex items-center px-3 transition-colors duration-150',
                    idx < filteredClients.length - 1 && 'border-b border-border/40',
                    isSelected ? 'bg-black/[0.03]' : 'hover:bg-black/[0.015]',
                  )}
                >
                  {/* Checkbox */}
                  <div className="w-8 shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleSelect(client.id)}
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                        isSelected ? 'bg-black border-black' : 'border-black/20 hover:border-black/40',
                      )}
                    >
                      {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                    </button>
                  </div>

                  <div
                    className="w-[46px] shrink-0 py-4 cursor-pointer flex items-center"
                    onClick={() => openEdit(client)}
                  >
                    <Avatar name={client.name} avatarUrl={client.avatar_url} size={36} />
                  </div>

                  <div
                    className="w-48 shrink-0 py-4 cursor-pointer min-w-0"
                    onClick={() => openEdit(client)}
                  >
                    <div className="text-[15px] font-semibold text-card-foreground truncate leading-snug">{client.name}</div>
                  </div>

                  <div className="w-56 shrink-0 py-4 pl-6">
                    <span className="text-[13px] text-black/55 truncate block">{client.email}</span>
                  </div>

                  <div className="w-36 shrink-0 py-4 pl-6">
                    <span className="text-[13px] text-black/55 truncate block">{client.company || <span className="text-black/20">—</span>}</span>
                  </div>

                  <div className="w-28 shrink-0 py-4 pl-6">
                    {debt ? (
                      <span className="text-[13px] font-semibold text-red-500">{formatAmount(debt.total, debt.currency)}</span>
                    ) : (
                      <span className="text-[13px] text-emerald-500 font-medium">No debt</span>
                    )}
                  </div>

                  <div className="w-24 shrink-0 py-4 pl-6">
                    {debt && debt.maxOverdueDays > 0 ? (
                      <span className="text-[13px] text-red-400">{debt.maxOverdueDays}d overdue</span>
                    ) : (
                      <span className="text-[13px] text-black/20">—</span>
                    )}
                  </div>

                  <div className="w-32 shrink-0 py-4 pl-10">
                    {clientLastReminder.get(client.email.toLowerCase()) ? (
                      <span className="text-[13px] text-black/50">{fmtRelative(clientLastReminder.get(client.email.toLowerCase())!)}</span>
                    ) : (
                      <span className="text-[13px] text-black/20">—</span>
                    )}
                  </div>

                  <div className="flex-1" />

                  <div className="w-16 shrink-0 py-4 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(client)}
                      className="text-black/25 hover:text-black/65 hover:bg-black/6 rounded-lg"
                    >
                      <Pencil size={13} strokeWidth={1.8} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteClient(client.id)}
                      className="text-black/25 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Card view ── */
          <div className="grid grid-cols-3 gap-4">
            {filteredClients.map(client => {
              const debt = clientDebt.get(client.email.toLowerCase())
              const isSelected = selected.has(client.id)
              return (
                <div
                  key={client.id}
                  className={cn(
                    'group relative bg-card rounded-xl border shadow-[var(--shadow-card)] p-5 flex flex-col gap-3 transition-all',
                    isSelected ? 'border-black/30 bg-black/[0.02] shadow-[var(--shadow-md)]' : 'border-border/60 hover:shadow-[var(--shadow-md)]',
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(client.id)}
                    className={cn(
                      'absolute top-3.5 right-3.5 w-4 h-4 rounded border flex items-center justify-center transition-colors',
                      isSelected ? 'bg-black border-black' : 'border-black/20 opacity-0 group-hover:opacity-100 hover:border-black/40',
                    )}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                  </button>

                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(client)}>
                    <Avatar name={client.name} avatarUrl={client.avatar_url} size={40} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-card-foreground truncate leading-snug">{client.name}</div>
                      {client.company && <div className="text-[12px] text-black/40 truncate">{client.company}</div>}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Mail size={11} strokeWidth={1.8} className="text-black/25 shrink-0" />
                      <span className="text-[12px] text-black/50 truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={11} strokeWidth={1.8} className="text-black/25 shrink-0" />
                        <span className="text-[12px] text-black/50">{client.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Debt */}
                  <div className="pt-3 border-t border-border/40">
                    {debt ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[14px] font-bold text-red-500">{formatAmount(debt.total, debt.currency)}</span>
                          <span className="text-[11px] text-black/35 ml-1.5">outstanding</span>
                        </div>
                        {debt.maxOverdueDays > 0 && (
                          <span className="text-[11px] font-medium text-red-400 bg-red-50 px-2 py-0.5 rounded-full">
                            {debt.maxOverdueDays}d overdue
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-emerald-500">No outstanding debt</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[12px] h-7"
                      onClick={() => openEdit(client)}
                    >
                      <Pencil size={11} strokeWidth={2} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteClient(client.id)}
                      className="h-7 w-7 text-black/25 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Compose Modal ── */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title={`Send to ${selected.size} client${selected.size !== 1 ? 's' : ''}`}>
        <div className="px-6 pt-5 pb-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-black/45 uppercase tracking-wider">Subject</label>
            <Input
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              placeholder="Enter email subject…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-black/45 uppercase tracking-wider">Message</label>
            <Textarea
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              placeholder="Write your message… You can use {{client_name}} as a variable."
              className="min-h-[160px] resize-y text-[14px]"
            />
          </div>
          <p className="text-[11px] text-black/35 leading-relaxed -mt-1">
            Clients with unpaid invoices will also receive invoice details and a payment button. Clients without active invoices will receive the message only.
          </p>
        </div>
        <div className="px-6 py-5 flex gap-2.5 justify-end border-t border-border/60 mt-2">
          <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={sending}>Cancel</Button>
          <Button
            onClick={handleManualSend}
            disabled={sending || !composeSubject.trim() || !profile?.email}
            className="gap-1.5 active:scale-[0.98]"
          >
            <Send size={12} strokeWidth={2.5} />
            {sending ? 'Sending…' : `Send to ${selected.size}`}
          </Button>
        </div>
      </Modal>

      {/* ── Edit/Create Modal ── */}
      <Modal open={panelOpen} onClose={closePanel} title={editingId ? 'Edit client' : 'New client'}>
        <div className="flex justify-center pt-6 pb-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className="relative p-0 h-auto w-auto rounded-full hover:bg-transparent"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Avatar" className="w-18 h-18 rounded-full object-cover ring-2 ring-border" />
            ) : (
              <div className="w-18 h-18 rounded-full bg-black/7 flex items-center justify-center ring-2 ring-border">
                <span className="text-2xl font-bold text-black/40 leading-none select-none">{formInitials}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={18} strokeWidth={2} className="text-white" />
            </div>
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mb-1">Click to upload photo</p>
        <div className="px-6 pt-4 pb-2 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required>
              <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Jane Smith" />
            </FormField>
            <FormField label="Email" required>
              <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="jane@company.com" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Company" optional>
              <Input value={form.company} onChange={e => setField('company', e.target.value)} placeholder="Acme Inc." />
            </FormField>
            <FormField label="Phone" optional>
              <Input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+1 555 0100" />
            </FormField>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
        </div>
        <div className="px-6 py-5 flex gap-2.5 justify-end border-t border-border/60 mt-4">
          <Button variant="outline" onClick={closePanel}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="active:scale-[0.98]">
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add client'}
          </Button>
        </div>
      </Modal>

    </div>
  )
}
