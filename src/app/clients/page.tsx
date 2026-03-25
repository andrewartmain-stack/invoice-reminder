'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Pencil, Trash2, Plus, Camera, Mail, Phone, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import type { Client } from '@/types/client'

type FormState = {
  name: string
  email: string
  company: string
  phone: string
}

const EMPTY_FORM: FormState = { name: '', email: '', company: '', phone: '' }

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('name', { ascending: true })
    setClients(data || [])
    setLoading(false)
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

    setSaving(false); closePanel(); fetchClients()
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client?')) return
    await supabase.from('clients').delete().eq('id', id)
    fetchClients()
  }

  const displayAvatar = avatarPreview || currentAvatarUrl
  const formInitials = getInitials(form.name.trim(), '?')

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade">

      <PageHeader
        icon={Users}
        title="Clients"
        action={
          <Button onClick={openNew} className="active:scale-[0.98]">
            <Plus size={14} strokeWidth={2.5} />
            New client
          </Button>
        }
      />

      <div className="px-8 pb-20 anim-slide-up anim-d1">
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
        ) : (
          <div>
            {/* Column headers */}
            <div className="flex items-center px-3 pb-2.5 border-b border-border/50">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Name</span>
              </div>
              <div className="w-55 shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Email</span>
              </div>
              <div className="w-45 shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Company</span>
              </div>
              <div className="w-37.5 shrink-0">
                <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Phone</span>
              </div>
              <div className="w-18 shrink-0" />
            </div>

            {clients.map((client, idx) => (
              <div
                key={client.id}
                className={cn(
                  'group flex items-center px-3 transition-colors duration-150 cursor-pointer',
                  idx < clients.length - 1 && 'border-b border-border/40',
                  'hover:bg-black/[0.015]',
                )}
                onClick={() => openEdit(client)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 py-4 pr-4">
                  <Avatar name={client.name} avatarUrl={client.avatar_url} size={36} />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-card-foreground truncate leading-snug">{client.name}</div>
                    {client.company && <div className="text-[13px] text-black/40 truncate mt-0.5">{client.company}</div>}
                  </div>
                </div>

                <div className="w-55 shrink-0 py-4">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Mail size={12} strokeWidth={1.8} className="text-black/20 shrink-0" />
                    <span className="text-[14px] text-black/55 truncate">{client.email}</span>
                  </div>
                </div>

                <div className="w-45 shrink-0 py-4">
                  {client.company ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 size={12} strokeWidth={1.8} className="text-black/20 shrink-0" />
                      <span className="text-[14px] text-black/55 truncate">{client.company}</span>
                    </div>
                  ) : <span className="text-[14px] text-black/20">—</span>}
                </div>

                <div className="w-37.5 shrink-0 py-4">
                  {client.phone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} strokeWidth={1.8} className="text-black/20 shrink-0" />
                      <span className="text-[14px] text-black/55">{client.phone}</span>
                    </div>
                  ) : <span className="text-[14px] text-black/20">—</span>}
                </div>

                <div className="w-18 shrink-0 py-4 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(client)}
                    className="opacity-0 group-hover:opacity-100 text-black/25 hover:text-black/65 hover:bg-black/6 rounded-lg"
                  >
                    <Pencil size={13} strokeWidth={1.8} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteClient(client.id)}
                    className="opacity-0 group-hover:opacity-100 text-black/25 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={panelOpen} onClose={closePanel} title={editingId ? 'Edit client' : 'New client'}>
        {/* Avatar upload */}
        <div className="flex justify-center pt-6 pb-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className="relative p-0 h-auto w-auto rounded-full hover:bg-transparent"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Avatar" className="w-18 h-18 rounded-full object-cover ring-2 ring-border group-hover/av:ring-black/30 transition-all" />
            ) : (
              <div className="w-18 h-18 rounded-full bg-black/7 flex items-center justify-center ring-2 ring-border group-hover/av:ring-black/30 transition-all">
                <span className="text-2xl font-bold text-black/40 leading-none select-none">{formInitials}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity">
              <Camera size={18} strokeWidth={2} className="text-white" />
            </div>
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mb-1">Click to upload photo</p>

        {/* Fields */}
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

        {/* Footer */}
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
