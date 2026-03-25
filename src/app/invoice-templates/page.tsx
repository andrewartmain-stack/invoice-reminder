'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LayoutTemplate, Pencil, Trash2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

type InvoiceTemplate = {
  id: string
  name: string
  default_amount: number | null
  currency: string
  notes: string | null
  created_at: string
}

type FormState = {
  name: string
  default_amount: string
  currency: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', default_amount: '', currency: 'USD', notes: '' }

export default function InvoiceTemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data } = await supabase.from('invoice_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setPanelOpen(true)
  }

  function openEdit(tpl: InvoiceTemplate) {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name,
      default_amount: tpl.default_amount != null ? String(tpl.default_amount) : '',
      currency: tpl.currency,
      notes: tpl.notes || '',
    })
    setError('')
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  function setField(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      default_amount: form.default_amount ? parseFloat(form.default_amount) : null,
      currency: form.currency,
      notes: form.notes.trim() || null,
    }

    if (editingId) {
      const { error: err } = await supabase.from('invoice_templates').update(payload).eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('invoice_templates').insert({ ...payload, user_id: user?.id })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    closePanel()
    fetchTemplates()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    await supabase.from('invoice_templates').delete().eq('id', id)
    fetchTemplates()
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif]">
      <header className="flex items-center justify-between px-8 pt-8 pb-5">
        <div>
          <span className="text-base font-semibold text-card-foreground tracking-tight">Invoice Templates</span>
          <p className="text-xs text-muted-foreground m-0">Save reusable invoice configurations.</p>
        </div>
        <Button onClick={openNew} size="sm" className="flex items-center gap-1.5">
          <Plus size={14} strokeWidth={2.5} />
          New template
        </Button>
      </header>

      <div className="max-w-[700px] mx-auto px-6 py-8 pb-20 flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <LayoutTemplate size={36} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="text-sm font-medium text-card-foreground m-0">No invoice templates yet</p>
            <p className="text-xs text-muted-foreground m-0">Create templates to reuse common invoice configurations.</p>
            <Button onClick={openNew} size="sm" className="mt-2">Create template</Button>
          </div>
        ) : (
          templates.map(tpl => (
            <div
              key={tpl.id}
              className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] px-5 py-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
                <LayoutTemplate size={16} strokeWidth={1.8} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-card-foreground">{tpl.name}</span>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {tpl.default_amount != null && (
                    <span className="text-xs text-muted-foreground">
                      {tpl.currency} {Number(tpl.default_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {!tpl.default_amount && (
                    <span className="text-xs text-muted-foreground">{tpl.currency}</span>
                  )}
                  {tpl.notes && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{tpl.notes}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href={`/invoices/new?template=${tpl.id}`}>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3">Use</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => openEdit(tpl)} className="h-8 w-8 p-0">
                  <Pencil size={13} strokeWidth={2} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTemplate(tpl.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 size={13} strokeWidth={2} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-sm)] w-full max-w-[480px] flex flex-col gap-0 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
              <span className="text-base font-semibold text-card-foreground">
                {editingId ? 'Edit template' : 'New invoice template'}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={closePanel}>
                <X size={16} strokeWidth={2} />
              </Button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Standard consulting" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Default amount (optional)</Label>
                  <Input
                    type="number"
                    value={form.default_amount}
                    onChange={e => setField('default_amount', e.target.value)}
                    placeholder="1500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onChange={e => setField('currency', e.target.value)}>
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="Any notes to pre-fill on invoices…"
                  rows={3}
                />
              </div>
              {error && (
                <p className="text-xs text-destructive m-0">{error}</p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <Button variant="outline" onClick={closePanel} size="sm">Cancel</Button>
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
