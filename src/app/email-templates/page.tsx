'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Mail, Plus, X, Tag, LayoutList, LayoutGrid, Check, Upload,
  Bell, MessageSquare, Sparkles, Pencil, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import {
  DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, DAY_OFFSET_PRESETS, TEMPLATE_TYPE_CONFIG,
} from '@/constants/email-templates'
import type { EmailTemplate, EmailTemplateType } from '@/types/email-template'
import type { EmailDesign, EmailFont, EmailDesignTemplate } from '@/types/email-design'
import { DEFAULT_EMAIL_DESIGN, resolveDesign } from '@/types/email-design'
import { buildPreviewEmail } from '@/lib/build-email'
import type { ThankYouPage, IconType, IconStyle, CardRadius, CardShadow, FontFamily, LogoSize } from '@/types/thank-you-page'
import { DEFAULT_THANK_YOU_PAGE, resolveThankYouPage } from '@/types/thank-you-page'
import { buildThankYouPage } from '@/lib/build-thank-you-page'

// ─── Constants ────────────────────────────────────────────────
const TYPE_COLORS: Record<EmailTemplateType, string> = {
  reminder: 'bg-blue-50 text-blue-600 border-blue-100',
  follow_up: 'bg-amber-50 text-amber-600 border-amber-100',
  thank_you: 'bg-emerald-50 text-emerald-600 border-emerald-100',
}

const TYPE_CONFIG: Record<EmailTemplateType, { icon: React.ElementType; accent: string; activeBg: string; activeBorder: string }> = {
  reminder:  { icon: Bell,         accent: 'text-blue-500',    activeBg: 'bg-blue-50',    activeBorder: 'border-blue-300' },
  follow_up: { icon: MessageSquare, accent: 'text-amber-500',  activeBg: 'bg-amber-50',   activeBorder: 'border-amber-300' },
  thank_you: { icon: Sparkles,     accent: 'text-emerald-500', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-300' },
}

// ─── Color field sub-component ────────────────────────────────
function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">{label}</span>
      <div className="flex items-center gap-2.5">
        <label className="relative cursor-pointer shrink-0">
          <div className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer shadow-sm" style={{ background: value }} />
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>
        <Input
          value={value}
          onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v) }}
          className="w-28 font-mono text-sm" maxLength={7} placeholder="#000000"
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
  const supabase = createClient()

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', body: '', day_offset: '0', type: 'reminder' as EmailTemplateType })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')

  const [design, setDesign] = useState<EmailDesign>(DEFAULT_EMAIL_DESIGN)
  const [savingDesign, setSavingDesign] = useState(false)
  const [designSaved, setDesignSaved] = useState(false)
  const [designError, setDesignError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'templates' | 'thankyou'>('templates')
  const [categoryFilter, setCategoryFilter] = useState<EmailTemplateType | null>(null)

  // Thank You Page state
  const [tyPage, setTyPage] = useState<ThankYouPage>(DEFAULT_THANK_YOU_PAGE)
  const [savingTy, setSavingTy] = useState(false)
  const [savedTy, setSavedTy] = useState(false)
  const [errorTy, setErrorTy] = useState('')
  const [bgImageUploading, setBgImageUploading] = useState(false)
  const bgImageInputRef = useRef<HTMLInputElement>(null)

  const [rejectionTemplateId, setRejectionTemplateId] = useState<string | null>(null)
  const [thankYouTemplateId, setThankYouTemplateId] = useState<string | null>(null)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [savedDefaults, setSavedDefaults] = useState(false)
  const [defaultsError, setDefaultsError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('template-view-mode') as 'list' | 'card' | null
    if (saved) setViewMode(saved)
    fetchTemplates()
    fetchDesign()
    fetchTyPage()
    fetchDefaults()
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    const { data, error } = await supabase.from('email_templates').select('*').order('day_offset', { ascending: true })
    if (!error) {
      const sorted = (data || []).slice().sort((a, b) => {
        const order: Record<string, number> = { reminder: 0, follow_up: 1, thank_you: 2 }
        return (order[a.type] ?? 3) - (order[b.type] ?? 3) || a.day_offset - b.day_offset
      })
      setTemplates(sorted)
    } else {
      setTemplates([])
    }
    setLoading(false)
  }

  async function fetchDesign() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('profiles').select('email_design, sender_name').eq('id', user.id).single()
    if (!error && data) {
      const d = data as { email_design?: Partial<EmailDesign> | null; sender_name?: string | null }
      const saved = (d.email_design || {}) as Partial<EmailDesign>
      setDesign(resolveDesign({ ...saved, brand_name: saved.brand_name || d.sender_name || undefined }))
    }
  }

  async function fetchTyPage() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('thank_you_page, email_design').eq('id', user.id).single()
    if (data) {
      setTyPage(resolveThankYouPage(data.thank_you_page as Partial<ThankYouPage> | null))
    }
  }

  async function saveTyPage() {
    setSavingTy(true); setErrorTy(''); setSavedTy(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingTy(false); return }
    const { error } = await supabase.from('profiles').update({ thank_you_page: tyPage } as Record<string, unknown>).eq('id', user.id)
    setSavingTy(false)
    if (error) { setErrorTy(error.message) } else { setSavedTy(true); setTimeout(() => setSavedTy(false), 3000) }
  }

  async function fetchDefaults() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('default_template_ids').eq('id', user.id).single()
    if (data?.default_template_ids) {
      const ids = data.default_template_ids as { rejection?: string | null; thank_you?: string | null }
      setRejectionTemplateId(ids.rejection ?? null)
      setThankYouTemplateId(ids.thank_you ?? null)
    }
  }

  async function saveDefaults() {
    setSavingDefaults(true); setDefaultsError(''); setSavedDefaults(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingDefaults(false); return }
    const { error } = await supabase.from('profiles').update({
      default_template_ids: { rejection: rejectionTemplateId, thank_you: thankYouTemplateId },
    } as Record<string, unknown>).eq('id', user.id)
    setSavingDefaults(false)
    if (error) { setDefaultsError(error.message) } else { setSavedDefaults(true); setTimeout(() => setSavedDefaults(false), 3000) }
  }

  async function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgImageUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBgImageUploading(false); return }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `ty-bg/${user.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setTyPage(p => ({ ...p, bg_image_url: data.publicUrl, bg_type: 'image' }))
    }
    setBgImageUploading(false); e.target.value = ''
  }

  async function saveDesign() {
    setSavingDesign(true); setDesignError(''); setDesignSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingDesign(false); return }
    const { error } = await supabase.from('profiles').update({ email_design: design } as Record<string, unknown>).eq('id', user.id)
    setSavingDesign(false)
    if (error) { setDesignError(error.message) } else { setDesignSaved(true); setTimeout(() => setDesignSaved(false), 3000) }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true); setDesignError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLogoUploading(false); return }
    const ext = file.name.split('.').pop() || 'png'
    const path = `logos/${user.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { setDesignError(`Logo upload failed: ${uploadError.message}`); setLogoUploading(false); e.target.value = ''; return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setDesign(d => ({ ...d, logo_url: data.publicUrl }))
    setLogoUploading(false); e.target.value = ''
  }

  function openCreate() {
    setForm({ name: '', subject: '', body: '', day_offset: '0', type: 'reminder' })
    setSaveError(''); setEditing(null); setCreating(true)
  }

  function openEdit(t: EmailTemplate) {
    setForm({ name: t.name, subject: t.subject, body: t.body, day_offset: String(t.day_offset), type: t.type ?? 'reminder' })
    setSaveError(''); setEditing(t); setCreating(true)
  }

  function closeForm() { setCreating(false); setEditing(null); setSaveError('') }

  async function save() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) { setSaveError('Name, subject and body are required.'); return }
    setSaving(true); setSaveError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setSaveError('Not authenticated.'); return }
    const payload = {
      name: form.name.trim(), subject: form.subject.trim(), body: form.body.trim(),
      day_offset: form.type === 'reminder' ? (parseInt(form.day_offset) || 0) : 0,
      type: form.type, user_id: user.id,
    }
    const { error } = editing
      ? await supabase.from('email_templates').update(payload).eq('id', editing.id)
      : await supabase.from('email_templates').insert(payload)
    // Also persist current design settings (only for reminder/thank_you templates)
    if (form.type === 'reminder' || form.type === 'thank_you') {
      const { error: designSaveErr } = await supabase.from('profiles').update({ email_design: design } as Record<string, unknown>).eq('id', user.id)
      if (designSaveErr) setDesignError(designSaveErr.message)
    }
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    closeForm(); fetchTemplates()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (!error) fetchTemplates()
  }

  async function seedDefaults() {
    setSeeding(true); setSeedError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSeeding(false); setSeedError('Not authenticated.'); return }
    const { error } = await supabase.from('email_templates').insert(DEFAULT_TEMPLATES.map(t => ({ ...t, user_id: user.id })))
    setSeeding(false)
    if (error) { setSeedError(error.message); return }
    fetchTemplates()
  }

  function setView(mode: 'list' | 'card') { setViewMode(mode); localStorage.setItem('template-view-mode', mode) }

  const grouped = (['reminder', 'follow_up', 'thank_you'] as EmailTemplateType[])
    .filter(type => categoryFilter === null || categoryFilter === type)
    .map(type => ({
      type,
      label: TEMPLATE_TYPE_CONFIG[type].label,
      description: TEMPLATE_TYPE_CONFIG[type].description,
      items: templates.filter(t => (t.type ?? 'reminder') === type),
    })).filter(g => g.items.length > 0)

  const showDayOffset = form.type === 'reminder'

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade rounded-2xl">

      <PageHeader
        title="Email Templates"
        subtitle="Customise the emails sent to your clients."
        action={
          <div className="flex items-center gap-2">
            {tab === 'templates' && (
              <>
                <div className="flex items-center gap-0.5 rounded-lg bg-black/5 p-0.5">
                  <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-white shadow-sm text-black/70' : 'text-black/35 hover:text-black/55')}>
                    <LayoutList size={14} strokeWidth={2} />
                  </button>
                  <button onClick={() => setView('card')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'card' ? 'bg-white shadow-sm text-black/70' : 'text-black/35 hover:text-black/55')}>
                    <LayoutGrid size={14} strokeWidth={2} />
                  </button>
                </div>
                {templates.length === 0 && !loading && (
                  <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seeding}>
                    {seeding ? 'Loading…' : 'Load defaults'}
                  </Button>
                )}
                <Button variant="accent" onClick={openCreate}>
                  <Plus size={14} strokeWidth={2.5} />
                  New template
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ── Page tabs ── */}
      <div className="flex items-center gap-1 px-8 pb-5">
        <button
          onClick={() => setTab('templates')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors', tab === 'templates' ? 'bg-black text-white' : 'text-black/50 hover:text-black/70 hover:bg-black/5')}
        >
          <Mail size={13} strokeWidth={2} /> Templates
        </button>
        <button
          onClick={() => setTab('thankyou')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors', tab === 'thankyou' ? 'bg-black text-white' : 'text-black/50 hover:text-black/70 hover:bg-black/5')}
        >
          <Sparkles size={13} strokeWidth={2} /> Thank You Page
        </button>
      </div>


      {/* ═══════════════════ THANK YOU PAGE TAB ═══════════════════ */}
      {tab === 'thankyou' && (
        <div className="px-8 pb-8 anim-slide-up anim-d1">
          <div className="flex gap-6 items-start" style={{ height: 'calc(100vh - 200px)' }}>

            {/* Controls */}
            <div className="w-[300px] shrink-0 flex flex-col bg-white border border-black/[0.07] rounded-xl overflow-hidden h-full">
              <div className="flex-1 overflow-y-auto">

                {/* Content */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Content</span>
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Heading</span>
                    <Input value={tyPage.heading} onChange={e => setTyPage(p => ({ ...p, heading: e.target.value }))} placeholder="Thank you for your payment!" className="h-8 text-[13px]" />
                  </div>
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Message</span>
                    <Textarea value={tyPage.message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTyPage(p => ({ ...p, message: e.target.value }))} rows={3} className="text-[13px] leading-relaxed resize-none" />
                  </div>
                </div>

                <div className="h-px bg-black/[0.06] mx-5" />

                {/* Logo */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Logo</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-black/60">Show logo</span>
                    <button onClick={() => setTyPage(p => ({ ...p, show_logo: !p.show_logo }))}
                      className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0', tyPage.show_logo ? 'bg-black' : 'bg-black/15')}>
                      <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', tyPage.show_logo ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </div>
                  {tyPage.show_logo && (
                    <div>
                      <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Logo size</span>
                      <div className="flex gap-1.5">
                        {(['sm', 'md', 'lg'] as LogoSize[]).map(s => (
                          <button key={s} onClick={() => setTyPage(p => ({ ...p, logo_size: s }))}
                            className={cn('flex-1 py-1.5 rounded-lg border text-[12px] font-medium transition-colors uppercase', tyPage.logo_size === s ? 'bg-black text-white border-black' : 'border-black/12 text-black/45 hover:border-black/25')}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-black/30 mt-1.5">Logo is set in the template design settings.</p>
                    </div>
                  )}
                </div>

                <div className="h-px bg-black/[0.06] mx-5" />

                {/* Icon */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Icon</span>
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Type</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { value: 'check', emoji: '✓' },
                        { value: 'heart', emoji: '♥' },
                        { value: 'star', emoji: '★' },
                        { value: 'sparkles', emoji: '✦' },
                        { value: 'none', emoji: '—' },
                      ] as { value: IconType; emoji: string }[]).map(({ value, emoji }) => (
                        <button key={value} onClick={() => setTyPage(p => ({ ...p, icon_type: value }))}
                          className={cn('py-2 rounded-lg border text-[14px] transition-colors', tyPage.icon_type === value ? 'bg-black text-white border-black' : 'border-black/10 text-black/50 hover:border-black/20')}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  {tyPage.icon_type !== 'none' && (
                    <div>
                      <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Style</span>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'circle', label: 'Filled' },
                          { value: 'outlined', label: 'Ring' },
                          { value: 'plain', label: 'Plain' },
                        ] as { value: IconStyle; label: string }[]).map(({ value, label }) => (
                          <button key={value} onClick={() => setTyPage(p => ({ ...p, icon_style: value }))}
                            className={cn('flex-1 py-1.5 rounded-lg border text-[12px] font-medium transition-colors', tyPage.icon_style === value ? 'bg-black text-white border-black' : 'border-black/12 text-black/45 hover:border-black/25')}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-black/[0.06] mx-5" />

                {/* Background */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Background</span>
                  <div className="flex gap-1.5">
                    {(['color', 'image'] as const).map(t => (
                      <button key={t} onClick={() => setTyPage(p => ({ ...p, bg_type: t }))}
                        className={cn('flex-1 py-1.5 rounded-lg border text-[12px] font-medium transition-colors capitalize', tyPage.bg_type === t ? 'bg-black text-white border-black' : 'border-black/12 text-black/45 hover:border-black/25')}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <ColorField label="Background color" value={tyPage.bg_color} onChange={v => setTyPage(p => ({ ...p, bg_color: v }))} />
                  {tyPage.bg_type === 'image' && (
                    <div>
                      <input ref={bgImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
                      {tyPage.bg_image_url ? (
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-9 rounded-md overflow-hidden border border-black/10 shrink-0">
                            <img src={tyPage.bg_image_url} className="w-full h-full object-cover" alt="" />
                          </div>
                          <button onClick={() => bgImageInputRef.current?.click()} className="text-[12px] text-black/50 hover:text-black/80 transition-colors">
                            {bgImageUploading ? 'Uploading…' : 'Replace'}
                          </button>
                          <button onClick={() => setTyPage(p => ({ ...p, bg_image_url: '', bg_type: 'color' }))} className="text-[12px] text-black/30 hover:text-red-500 transition-colors">Remove</button>
                        </div>
                      ) : (
                        <button onClick={() => bgImageInputRef.current?.click()} disabled={bgImageUploading}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-black/15 text-[12px] text-black/40 hover:border-black/30 hover:text-black/60 transition-colors w-full justify-center">
                          <Upload size={12} strokeWidth={2} />{bgImageUploading ? 'Uploading…' : 'Upload background image'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px bg-black/[0.06] mx-5" />

                {/* Card */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Card</span>
                  <ColorField label="Card background" value={tyPage.card_bg} onChange={v => setTyPage(p => ({ ...p, card_bg: v }))} />
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Corner radius</span>
                    <div className="grid grid-cols-5 gap-1">
                      {(['none', 'sm', 'md', 'lg', 'xl'] as CardRadius[]).map(r => (
                        <button key={r} onClick={() => setTyPage(p => ({ ...p, card_radius: r }))}
                          className={cn('py-1.5 rounded-lg border text-[11px] font-medium transition-colors', tyPage.card_radius === r ? 'bg-black text-white border-black' : 'border-black/10 text-black/45 hover:border-black/20')}>
                          {r === 'none' ? '—' : r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Shadow</span>
                    <div className="grid grid-cols-4 gap-1">
                      {(['none', 'sm', 'md', 'lg'] as CardShadow[]).map(s => (
                        <button key={s} onClick={() => setTyPage(p => ({ ...p, card_shadow: s }))}
                          className={cn('py-1.5 rounded-lg border text-[11px] font-medium transition-colors', tyPage.card_shadow === s ? 'bg-black text-white border-black' : 'border-black/10 text-black/45 hover:border-black/20')}>
                          {s === 'none' ? '—' : s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-black/60">Show border</span>
                    <button onClick={() => setTyPage(p => ({ ...p, card_border: !p.card_border }))}
                      className={cn('w-9 h-5 rounded-full transition-colors relative', tyPage.card_border ? 'bg-black' : 'bg-black/15')}>
                      <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', tyPage.card_border ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-black/[0.06] mx-5" />

                {/* Typography & colors */}
                <div className="p-5 flex flex-col gap-3">
                  <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.08em]">Typography</span>
                  <div>
                    <span className="text-[12px] font-medium text-foreground/65 block mb-1.5">Font</span>
                    <div className="flex gap-1.5">
                      {([
                        { value: 'inter', label: 'Sans' },
                        { value: 'serif', label: 'Serif' },
                        { value: 'mono', label: 'Mono' },
                      ] as { value: FontFamily; label: string }[]).map(({ value, label }) => (
                        <button key={value} onClick={() => setTyPage(p => ({ ...p, font: value }))}
                          className={cn('flex-1 py-1.5 rounded-lg border text-[12px] font-medium transition-colors', tyPage.font === value ? 'bg-black text-white border-black' : 'border-black/12 text-black/45 hover:border-black/25')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Heading" value={tyPage.heading_color} onChange={v => setTyPage(p => ({ ...p, heading_color: v }))} />
                    <ColorField label="Body text" value={tyPage.text_color} onChange={v => setTyPage(p => ({ ...p, text_color: v }))} />
                    <ColorField label="Accent / icon" value={tyPage.accent_color} onChange={v => setTyPage(p => ({ ...p, accent_color: v }))} />
                  </div>
                </div>
              </div>

              {/* Save footer */}
              <div className="shrink-0 px-5 py-4 border-t border-black/[0.06] flex flex-col gap-2">
                {errorTy && <Alert variant="error">{errorTy}</Alert>}
                <Button onClick={saveTyPage} disabled={savingTy} size="sm" className="w-full active:scale-[0.98]">
                  {savingTy ? 'Saving…' : savedTy ? <span className="flex items-center gap-1.5"><Check size={13} strokeWidth={2.5} />Saved</span> : 'Save page'}
                </Button>
              </div>
            </div>

            {/* Live preview */}
            <div className="flex-1 flex flex-col h-full min-w-0">
              <p className="text-[11px] font-semibold text-black/30 uppercase tracking-widest mb-3 shrink-0">Live preview</p>
              <div className="flex-1 rounded-xl overflow-hidden border border-black/[0.07]">
                <iframe
                  srcDoc={buildThankYouPage(tyPage, design.logo_url || null)}
                  title="Thank you page preview"
                  sandbox="allow-same-origin"
                  className="w-full h-full border-none"
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════ TEMPLATES TAB ═══════════════════ */}
      {tab === 'templates' && (
        <>
          {seedError && <div className="mx-8 mb-4"><Alert variant="error">{seedError}</Alert></div>}

          {/* ── Automatic emails ── */}
          <div className="mx-8 mb-5">
            <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.05]">
                <span className="text-[11px] font-semibold text-black/35 uppercase tracking-[0.08em]">Automatic emails</span>
                <div className="flex items-center gap-3">
                  {defaultsError && <span className="text-[12px] text-red-500">{defaultsError}</span>}
                  <Button size="sm" variant="outline" onClick={saveDefaults} disabled={savingDefaults} className="h-7 text-[12px] px-3">
                    {savingDefaults ? 'Saving…' : savedDefaults ? <span className="flex items-center gap-1.5"><Check size={11} strokeWidth={2.5} />Saved</span> : 'Save'}
                  </Button>
                </div>
              </div>
              {/* Payment not confirmed row */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.04]">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="text-[13px] font-medium text-black/75 shrink-0">Payment not confirmed</span>
                  <span className="text-[12px] text-black/35">·</span>
                  <span className="text-[12px] text-black/40 truncate">Sent to client when you reject their payment claim</span>
                </div>
                <select
                  value={rejectionTemplateId ?? ''}
                  onChange={e => setRejectionTemplateId(e.target.value || null)}
                  disabled={loading}
                  className="text-[13px] border border-black/12 rounded-lg px-3 py-1.5 bg-white text-black/70 w-[230px] outline-none focus:border-black/30 cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <option value="">Built-in email</option>
                  {templates.filter(t => t.type === 'follow_up').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {/* Thank you email row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[13px] font-medium text-black/75 shrink-0">Thank you</span>
                  <span className="text-[12px] text-black/35">·</span>
                  <span className="text-[12px] text-black/40 truncate">Sent to client when you confirm their payment</span>
                </div>
                <select
                  value={thankYouTemplateId ?? ''}
                  onChange={e => setThankYouTemplateId(e.target.value || null)}
                  disabled={loading}
                  className="text-[13px] border border-black/12 rounded-lg px-3 py-1.5 bg-white text-black/70 w-[230px] outline-none focus:border-black/30 cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <option value="">Built-in email</option>
                  {templates.filter(t => t.type === 'thank_you').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Category filter ── */}
          {!loading && templates.length > 0 && (
            <div className="mx-8 mb-4 flex items-center gap-1.5">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn('px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors', categoryFilter === null ? 'bg-black text-white' : 'text-black/40 hover:text-black/65 hover:bg-black/5')}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter('reminder')}
                className={cn('px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors', categoryFilter === 'reminder' ? 'bg-blue-600 text-white' : 'text-black/40 hover:text-black/65 hover:bg-black/5')}
              >
                Reminders
              </button>
              <button
                onClick={() => setCategoryFilter('follow_up')}
                className={cn('px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors', categoryFilter === 'follow_up' ? 'bg-amber-500 text-white' : 'text-black/40 hover:text-black/65 hover:bg-black/5')}
              >
                Payment Not Confirmed
              </button>
              <button
                onClick={() => setCategoryFilter('thank_you')}
                className={cn('px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors', categoryFilter === 'thank_you' ? 'bg-emerald-600 text-white' : 'text-black/40 hover:text-black/65 hover:bg-black/5')}
              >
                Thank You
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground px-8 py-10 text-sm">Loading…</p>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No templates yet"
              description="Create a custom template or load the defaults to get started."
              action={
                <div className="flex flex-col items-center gap-2 mt-2">
                  {seedError && <Alert variant="error">{seedError}</Alert>}
                  <Button onClick={seedDefaults} disabled={seeding}>{seeding ? 'Loading…' : 'Load default templates'}</Button>
                </div>
              }
            />
          ) : viewMode === 'list' ? (
            /* ── List view ── */
            <div className="px-8 pb-20 flex flex-col gap-8 anim-slide-up anim-d1">
              {grouped.map(group => (
                <div key={group.type}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider', TYPE_COLORS[group.type])}>{group.label}</span>
                    <span className="text-xs text-muted-foreground">{group.description}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-border/60 overflow-hidden shadow-[var(--shadow-card)]">
                    {group.items.map((t, idx) => (
                      <div key={t.id} className={cn('group flex items-center gap-4 px-5 py-4 bg-card hover:bg-black/[0.015] transition-colors', idx < group.items.length - 1 && 'border-b border-border/40')}>
                        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                          <span className="text-[14px] font-medium text-card-foreground">{t.name}</span>
                          <span className="text-[13px] text-muted-foreground truncate">{t.subject}</span>
                        </div>
                        {t.type === 'reminder' && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-accent border border-[var(--accent-border)] shrink-0 uppercase tracking-wide">
                            Day {t.day_offset === 0 ? '0' : `+${t.day_offset}`}
                          </span>
                        )}
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} className="text-black/35 hover:text-black/70 hover:bg-black/5 rounded-lg">
                            <Pencil size={13} strokeWidth={1.8} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteTemplate(t.id)} className="text-black/35 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} strokeWidth={1.8} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Card view ── */
            <div className="px-8 pb-20 flex flex-col gap-8 anim-slide-up anim-d1">
              {grouped.map(group => (
                <div key={group.type}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider', TYPE_COLORS[group.type])}>{group.label}</span>
                    <span className="text-xs text-muted-foreground">{group.description}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {group.items.map(t => (
                      <div key={t.id} className="group bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5 flex flex-col gap-3 hover:shadow-[var(--shadow-md)] transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0', TYPE_COLORS[t.type ?? 'reminder'])}>
                            {TEMPLATE_TYPE_CONFIG[t.type ?? 'reminder'].label}
                          </span>
                          {t.type === 'reminder' && (
                            <span className="text-[11px] font-medium text-muted-foreground shrink-0">Day {t.day_offset === 0 ? '0' : `+${t.day_offset}`}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="text-[15px] font-semibold text-card-foreground leading-snug">{t.name}</span>
                          <span className="text-[13px] text-muted-foreground line-clamp-1">{t.subject}</span>
                          <p className="text-[12px] text-black/40 line-clamp-3 mt-1 leading-relaxed">{t.body}</p>
                        </div>
                        <div className="flex gap-1 justify-end pt-2 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} className="text-black/35 hover:text-black/70 hover:bg-black/5 rounded-lg">
                            <Pencil size={13} strokeWidth={1.8} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteTemplate(t.id)} className="text-black/35 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} strokeWidth={1.8} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ SLIDE-IN PANEL ═══════════════════ */}
      {creating && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]" onClick={closeForm} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-screen w-[500px] bg-white z-50 flex flex-col shadow-2xl border-l border-black/[0.08]">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.07] shrink-0">
              <div>
                <h2 className="text-[16px] font-semibold text-card-foreground">{editing ? 'Edit template' : 'New template'}</h2>
                <p className="text-[12px] text-black/40 mt-0.5">Fill in the details below</p>
              </div>
              <button onClick={closeForm} className="p-2 rounded-lg text-black/30 hover:text-black/60 hover:bg-black/5 transition-colors">
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">

              {/* Type picker */}
              <div>
                <span className="text-[12px] font-medium text-black/50 block mb-3">Template type</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['reminder', 'follow_up', 'thank_you'] as EmailTemplateType[]).map(t => {
                    const cfg = TYPE_CONFIG[t]
                    const Icon = cfg.icon
                    const isActive = form.type === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center',
                          isActive ? `${cfg.activeBg} ${cfg.activeBorder}` : 'border-black/[0.07] hover:border-black/20 bg-white',
                        )}
                      >
                        <Icon size={18} strokeWidth={1.8} className={isActive ? cfg.accent : 'text-black/30'} />
                        <span className={cn('text-[12px] font-semibold leading-tight', isActive ? 'text-black/80' : 'text-black/40')}>
                          {TEMPLATE_TYPE_CONFIG[t].label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-black/35 mt-2">{TEMPLATE_TYPE_CONFIG[form.type].description}</p>
              </div>

              {/* Name */}
              <FormField label="Template name">
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Gentle overdue reminder"
                />
              </FormField>

              {/* Day offset — reminders only */}
              {showDayOffset && (
                <div>
                  <span className="text-[12px] font-medium text-black/50 block mb-2">Send on day</span>
                  <div className="flex items-center gap-3 mb-3">
                    <Input
                      type="number" min="0" max="90"
                      value={form.day_offset}
                      onChange={e => setForm(f => ({ ...f, day_offset: String(Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-20 text-center font-mono"
                    />
                    <span className="text-[13px] text-black/40">
                      {parseInt(form.day_offset) === 0 ? 'on the due date' : `day${parseInt(form.day_offset) > 1 ? 's' : ''} after due date`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-black/30 mr-0.5">Quick:</span>
                    {DAY_OFFSET_PRESETS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, day_offset: String(d) }))}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                          form.day_offset === String(d)
                            ? 'bg-black text-white border-black'
                            : 'border-black/10 text-black/40 hover:border-black/25 hover:text-black/60',
                        )}
                      >
                        {d === 0 ? 'Day 0' : `+${d}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject */}
              <FormField label="Subject line">
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Invoice — payment due today"
                />
              </FormField>

              {/* Body */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-black/50">Body</span>
                </div>
                {/* Variable chips */}
                <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-black/[0.025] rounded-lg border border-black/[0.06]">
                  <Tag size={11} strokeWidth={2} className="text-black/30 shrink-0" />
                  <span className="text-[11px] text-black/30 mr-0.5">Insert:</span>
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, body: f.body + v }))}
                      className="px-2 py-0.5 rounded-md bg-white border border-black/10 text-[11px] font-mono text-black/55 hover:border-black/25 hover:text-black/80 transition-colors shadow-sm"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={10}
                  placeholder="Hi {{client_name}}, …"
                  className="leading-relaxed font-[inherit] text-[13px]"
                />
              </div>

              {/* ── Email Design section (inline, for reminder & thank_you) ── */}
              {(form.type === 'reminder' || form.type === 'thank_you') && (
                <div className="border border-black/[0.08] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-black/[0.02]">
                    <span className="text-[12px] font-semibold text-black/50 uppercase tracking-[0.06em]">Email design</span>
                    <div className="flex gap-1">
                      {([
                        { value: 'plain' as EmailDesignTemplate, label: 'Plain text' },
                        { value: 'styled' as EmailDesignTemplate, label: 'Styled' },
                      ]).map(({ value, label }) => (
                        <button key={value} type="button" onClick={() => setDesign(d => ({ ...d, template: value }))}
                          className={cn('px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors', design.template === value ? 'bg-black text-white' : 'text-black/45 hover:text-black/65 hover:bg-black/6')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {design.template === 'styled' && (
                    <div className="px-4 py-4 flex flex-col gap-4 border-t border-black/[0.06]">
                      {/* Branding */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.06em]">Branding</span>
                        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
                        {design.logo_url ? (
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-8 rounded border border-border/60 bg-black/[0.02] flex items-center justify-center overflow-hidden p-1">
                              <img src={design.logo_url} alt="Logo" className="max-h-5 max-w-full object-contain" />
                            </div>
                            <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="text-[12px] text-black/50 hover:text-black/80">{logoUploading ? 'Uploading…' : 'Replace'}</button>
                            <button onClick={() => setDesign(d => ({ ...d, logo_url: '' }))} className="text-[12px] text-black/30 hover:text-red-500">Remove</button>
                          </div>
                        ) : (
                          <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-black/15 text-[12px] text-black/40 hover:border-black/30 self-start">
                            <Upload size={11} strokeWidth={2} />{logoUploading ? 'Uploading…' : 'Upload logo'}
                          </button>
                        )}
                        {!design.logo_url && (
                          <Input value={design.brand_name} onChange={e => setDesign(d => ({ ...d, brand_name: e.target.value }))} placeholder="Brand name" className="h-7 text-[13px]" />
                        )}
                      </div>
                      {/* Colors */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.06em]">Colors</span>
                        <div className="grid grid-cols-2 gap-3">
                          <ColorField label="Header bg" value={design.header_bg} onChange={v => setDesign(d => ({ ...d, header_bg: v }))} />
                          <ColorField label="Button color" value={design.button_bg} onChange={v => setDesign(d => ({ ...d, button_bg: v }))} />
                          <ColorField label="Heading" value={design.heading_color} onChange={v => setDesign(d => ({ ...d, heading_color: v }))} />
                          <ColorField label="Body text" value={design.body_text_color} onChange={v => setDesign(d => ({ ...d, body_text_color: v }))} />
                        </div>
                      </div>
                      {/* Font */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.06em]">Font</span>
                        <div className="flex gap-1.5">
                          {([
                            { value: 'inter' as EmailFont, label: 'Sans', sample: 'Ag' },
                            { value: 'georgia' as EmailFont, label: 'Serif', sample: 'Ag' },
                            { value: 'mono' as EmailFont, label: 'Mono', sample: 'Ag' },
                          ]).map(({ value, label, sample }) => (
                            <button key={value} type="button" onClick={() => setDesign(d => ({ ...d, font: value }))}
                              className={cn('flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border transition-colors', design.font === value ? 'border-black bg-black/[0.03]' : 'border-black/10 hover:border-black/20')}
                            >
                              <span style={{ fontFamily: value === 'inter' ? 'Inter,sans-serif' : value === 'georgia' ? 'Georgia,serif' : 'monospace' }} className="text-[13px]">{sample}</span>
                              <span className="text-[9px] text-black/35 uppercase tracking-wide">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Preview */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-black/30 uppercase tracking-[0.06em]">Preview</span>
                        <div className="rounded-lg overflow-hidden border border-black/[0.07] bg-[#eeecea]" style={{ height: '200px' }}>
                          <div style={{ transform: 'scale(0.55)', transformOrigin: 'top center', width: '560px', marginLeft: 'calc(50% - 280px)' }}>
                            <iframe
                              srcDoc={buildPreviewEmail(design)}
                              title="Email preview"
                              sandbox="allow-same-origin"
                              style={{ width: '560px', height: '400px', border: 'none', pointerEvents: 'none' }}
                            />
                          </div>
                        </div>
                      </div>
                      {designError && <Alert variant="error">{designError}</Alert>}
                    </div>
                  )}
                </div>
              )}

              {saveError && <Alert variant="error">{saveError}</Alert>}
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-black/[0.07] bg-white">
              <Button variant="ghost" onClick={closeForm} className="text-black/50">Cancel</Button>
              <Button
                onClick={save}
                disabled={saving || !form.name || !form.subject || !form.body}
                className="flex-1 active:scale-[0.99]"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
