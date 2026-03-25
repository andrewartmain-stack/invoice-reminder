'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Upload, FileText, X, AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { CURRENCIES } from '@/constants/invoice'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import type { EmailTemplate } from '@/types/email-template'
import type { ClientOption } from '@/types/client'

export default function NewInvoicePage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    client_name: '', client_email: '', amount: '', currency: 'USD',
    invoice_number: '', due_date: '', stripe_payment_link: '',
  })
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [clientMode, setClientMode] = useState<'manual' | 'select'>('manual')
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileDragOver, setFileDragOver] = useState(false)

  useEffect(() => {
    async function fetchTemplates() {
      const { data } = await supabase
        .from('email_templates')
        .select('id, name, subject, body, day_offset, created_at')
        .order('day_offset', { ascending: true })
      setTemplates(data || [])
      if (data && data.length > 0) {
        const seen = new Set<number>()
        const ids: string[] = []
        for (const t of data) {
          if (!seen.has(t.day_offset)) { seen.add(t.day_offset); ids.push(t.id) }
        }
        setSelectedTemplateIds(ids)
      }
      setTemplatesLoading(false)
    }
    async function fetchClients() {
      const { data } = await supabase.from('clients').select('id, name, email, avatar_url').order('name')
      setClients(data || [])
    }
    fetchTemplates()
    fetchClients()
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleTemplate(id: string) {
    const tpl = templates.find(t => t.id === id)
    if (!tpl) return
    setSelectedTemplateIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      const withoutConflict = prev.filter(x => templates.find(t => t.id === x)?.day_offset !== tpl.day_offset)
      return [...withoutConflict, id]
    })
  }

  async function handleFile(file: File) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Max 10 MB.'); return }
    setInvoiceFile(file)
    setFileUploading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('invoice-files').upload(path, file, { upsert: false })
    if (uploadError) { setError(`File upload failed: ${uploadError.message}`); setInvoiceFile(null); setFileUploading(false); return }
    const { data: urlData } = supabase.storage.from('invoice-files').getPublicUrl(path)
    setFileUrl(urlData.publicUrl)
    setFileUploading(false)
  }

  function removeFile() {
    setInvoiceFile(null); setFileUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submit() {
    if (!form.client_name || !form.client_email || !form.amount || !form.due_date) {
      setError('Please fill all required fields.'); return
    }
    if (selectedTemplateIds.length === 0) { setError('Please select at least one email template.'); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { error: err } = await supabase.from('invoices').insert({
      user_id: user.id, client_name: form.client_name, client_email: form.client_email,
      amount: parseFloat(form.amount), currency: form.currency,
      invoice_number: form.invoice_number || null, due_date: form.due_date,
      stripe_payment_link: form.stripe_payment_link || null,
      reminder_preset: JSON.stringify(selectedTemplateIds),
      invoice_file_url: fileUrl || null, status: 'pending',
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/invoices')
  }

  const selectedDays = new Set(
    selectedTemplateIds.map(id => templates.find(t => t.id === id)?.day_offset).filter(d => d !== undefined) as number[]
  )

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade">

      <header className="flex items-center justify-between px-8 pt-8 pb-5">
        <Link href="/invoices" className="flex items-center gap-1.5 text-[14px] text-black/45 hover:text-black no-underline transition-colors font-medium">
          <ArrowLeft size={14} strokeWidth={2} />
          Invoices
        </Link>
        <span className="text-[22px] font-bold text-card-foreground tracking-tight">New invoice</span>
        <div className="w-24" />
      </header>

      <div className="px-8 pb-20 flex flex-col gap-0">

        {/* ── Step 1: Client ── */}
        <div className="py-7 border-b border-black/[0.07] anim-slide-up anim-d1">
          <div className="flex items-center gap-8">
            <div className="w-48 shrink-0">
              <div className="text-[15px] font-semibold text-black">Client</div>
              <div className="text-[13px] text-black/40 mt-0.5">Who are you billing?</div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-black/5 rounded-lg self-start mr-4">
              {(['manual', 'select'] as const).map(mode => (
                <Button
                  key={mode}
                  variant="ghost"
                  onClick={() => setClientMode(mode)}
                  className={cn(
                    'h-auto px-3 py-1.5 text-[13px]',
                    clientMode === mode ? 'bg-white text-black shadow-sm hover:bg-white' : 'text-black/45 hover:text-black/70',
                  )}
                >
                  {mode === 'manual' ? 'Manual' : 'From clients'}
                </Button>
              ))}
            </div>

            {clientMode === 'manual' ? (
              <div className="flex gap-4 flex-1">
                <FormField label="Full name" required className="flex-1">
                  <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="John Smith" />
                </FormField>
                <FormField label="Email address" required className="flex-1">
                  <Input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="john@company.com" />
                </FormField>
              </div>
            ) : clients.length === 0 ? (
              <div className="flex-1 p-4 bg-black/4 rounded-xl">
                <p className="text-[14px] text-black/50 m-0">No clients yet. <Link href="/clients" className="text-black font-semibold hover:underline no-underline">Add clients first →</Link></p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <div className="relative">
                  <Search size={13} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search clients…"
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-black/10 bg-transparent text-[13px] text-black placeholder:text-black/30 outline-none focus:border-black/30 transition-colors font-[inherit]"
                  />
                </div>
                <div className="flex flex-col overflow-y-auto max-h-52 rounded-xl border border-black/[0.07]">
                  {clients
                    .filter(c =>
                      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                      c.email.toLowerCase().includes(clientSearch.toLowerCase())
                    )
                    .map((client, idx, arr) => {
                      const isSelected = selectedClientId === client.id
                      const initials = getInitials(client.name)
                      return (
                        <Button
                          key={client.id}
                          variant="ghost"
                          onClick={() => { setSelectedClientId(client.id); set('client_name', client.name); set('client_email', client.email) }}
                          className={cn(
                            'w-full h-auto px-4 py-3 justify-start rounded-none',
                            idx < arr.length - 1 && 'border-b border-black/5',
                            isSelected ? 'bg-black/3 hover:bg-black/3' : 'hover:bg-black/2',
                          )}
                        >
                          {client.avatar_url ? (
                            <img src={client.avatar_url} alt={client.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-black/8 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-black/45">{initials}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-card-foreground leading-tight">{client.name}</div>
                            <div className="text-[12px] text-black/40">{client.email}</div>
                          </div>
                          {isSelected && <Check size={14} strokeWidth={2.5} className="text-black shrink-0" />}
                        </Button>
                      )
                    })
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Invoice details ── */}
        <div className="py-7 border-b border-black/[0.07] anim-slide-up anim-d2">
          <div className="flex items-start gap-8">
            <div className="w-48 shrink-0 pt-1">
              <div className="text-[15px] font-semibold text-black">Invoice</div>
              <div className="text-[13px] text-black/40 mt-0.5">Amount & due date</div>
            </div>
            <div className="flex gap-4 flex-1">
              <FormField label="Amount" required className="w-40">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-black/40 pointer-events-none">{form.currency}</span>
                  <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="1500" className="pl-12" />
                </div>
              </FormField>
              <FormField label="Currency" className="w-36">
                <Select value={form.currency} onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="Due date" required className="w-44">
                <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </FormField>
              <FormField label="Invoice #" optional className="flex-1">
                <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-042" />
              </FormField>
              <FormField label="Payment link" optional className="flex-1">
                <Input value={form.stripe_payment_link} onChange={e => set('stripe_payment_link', e.target.value)} placeholder="https://buy.stripe.com/…" />
              </FormField>
            </div>
          </div>
        </div>

        {/* ── Step 3: File ── */}
        <div className="py-7 border-b border-black/[0.07] anim-slide-up anim-d3">
          <div className="flex items-start gap-8">
            <div className="w-48 shrink-0 pt-1">
              <div className="text-[15px] font-semibold text-black">Attachment</div>
              <div className="text-[13px] text-black/40 mt-0.5">Optional invoice file</div>
            </div>
            <div className="flex-1">
              {invoiceFile ? (
                <div className="flex items-center gap-3 p-3 bg-black/4 rounded-xl border border-black/8 max-w-sm anim-slide-down">
                  <FileText size={16} strokeWidth={1.5} className="text-black/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-card-foreground truncate">{invoiceFile.name}</div>
                    <div className="text-[11px] text-black/40 mt-0.5">{fileUploading ? 'Uploading…' : fileUrl ? '✓ Uploaded' : ''} · {(invoiceFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                  {fileUploading
                    ? <div className="w-4 h-4 border-2 border-black/25 border-t-transparent rounded-full animate-spin shrink-0" />
                    : <Button variant="ghost" size="icon-sm" onClick={removeFile} className="text-black/30 hover:text-red-500 hover:bg-transparent h-auto w-auto p-1"><X size={13} strokeWidth={2} /></Button>
                  }
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setFileDragOver(true) }}
                  onDragLeave={() => setFileDragOver(false)}
                  onDrop={e => { e.preventDefault(); setFileDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors max-w-sm',
                    fileDragOver ? 'border-black/40 bg-black/4' : 'border-black/10 hover:border-black/25 hover:bg-black/2',
                  )}
                >
                  <Upload size={16} strokeWidth={1.5} className="text-black/25 shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-black/55 m-0">Drop file or click to browse</p>
                    <p className="text-[11px] text-black/30 m-0 mt-0.5">PDF, PNG, JPG — up to 10 MB</p>
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          </div>
        </div>

        {/* ── Step 4: Reminder schedule ── */}
        <div className="py-7 border-b border-black/[0.07] anim-slide-up anim-d4">
          <div className="flex items-start gap-8">
            <div className="w-48 shrink-0 pt-1">
              <div className="text-[15px] font-semibold text-black">Reminders</div>
              <div className="text-[13px] text-black/40 mt-0.5">Select which emails to send</div>
            </div>
            <div className="flex-1">
              {templatesLoading ? (
                <p className="text-[14px] text-black/40">Loading…</p>
              ) : templates.length === 0 ? (
                <div className="flex flex-col gap-1.5 p-4 bg-black/4 rounded-xl max-w-sm">
                  <p className="text-[14px] font-semibold text-card-foreground m-0">No templates yet.</p>
                  <Link href="/email-templates" className="text-[13px] text-black font-semibold hover:underline no-underline">Set up Email Templates →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-center px-3 pb-2 border-b border-black/6">
                    <div className="w-5" />
                    <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Template</span>
                    <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Day</span>
                  </div>
                  {templates.map((t, idx) => {
                    const selected = selectedTemplateIds.includes(t.id)
                    const dayTaken = !selected && selectedDays.has(t.day_offset)
                    const isLast = idx === templates.length - 1
                    return (
                      <Button
                        key={t.id}
                        variant="ghost"
                        onClick={() => toggleTemplate(t.id)}
                        className={cn(
                          'grid grid-cols-[auto_1fr_auto] gap-x-4 items-center w-full h-auto px-3 py-3.5 justify-start rounded-none',
                          !isLast && 'border-b border-black/5',
                          selected ? 'bg-black/2 hover:bg-black/2' : 'hover:bg-black/1.5',
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-all',
                          selected ? 'border-black bg-black' : 'border-black/20',
                        )}>
                          {selected && <Check size={11} strokeWidth={3} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-card-foreground">{t.name}</span>
                            {dayTaken && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-black/40 bg-black/6 border border-black/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                <AlertTriangle size={9} strokeWidth={2.5} />
                                Day taken
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-black/40 truncate mt-0.5">{t.subject}</div>
                        </div>
                        <span className={cn(
                          'text-[11px] font-semibold px-2.5 py-1 rounded-lg',
                          selected ? 'bg-black text-white' : 'bg-black/6 text-black/45',
                        )}>
                          Day {t.day_offset === 0 ? '0' : `+${t.day_offset}`}
                        </span>
                      </Button>
                    )
                  })}
                  <p className="text-[12px] text-black/35 mt-3 m-0">
                    {selectedTemplateIds.length} of {templates.length} selected ·{' '}
                    <Link href="/email-templates" className="text-black/50 hover:underline no-underline font-medium">Manage →</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="pt-7 flex items-center gap-4 anim-slide-up anim-d5">
          <div className="w-48 shrink-0" />
          <div className="flex items-center gap-4 flex-1">
            {error && <Alert variant="error" className="flex-1">{error}</Alert>}
            <Button
              size="lg"
              onClick={submit}
              disabled={loading || fileUploading || (templates.length > 0 && selectedTemplateIds.length === 0)}
              className="shrink-0 ml-auto active:scale-[0.98] rounded-xl px-8"
            >
              {loading ? 'Creating…' : 'Create invoice & start reminders'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
