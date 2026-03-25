'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Plus, X, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, DAY_OFFSET_PRESETS } from '@/constants/email-templates'
import type { EmailTemplate } from '@/types/email-template'

export default function EmailTemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', body: '', day_offset: '0' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data } = await supabase.from('email_templates').select('*').order('day_offset', { ascending: true })
    setTemplates(data || [])
    setLoading(false)
  }

  function openCreate() {
    setForm({ name: '', subject: '', body: '', day_offset: '0' })
    setEditing(null)
    setCreating(true)
  }

  function openEdit(t: EmailTemplate) {
    setForm({ name: t.name, subject: t.subject, body: t.body, day_offset: String(t.day_offset) })
    setEditing(t)
    setCreating(true)
  }

  function closeForm() { setCreating(false); setEditing(null) }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { name: form.name, subject: form.subject, body: form.body, day_offset: parseInt(form.day_offset), user_id: user.id }
    if (editing) {
      await supabase.from('email_templates').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('email_templates').insert(payload)
    }
    setSaving(false)
    closeForm()
    fetchTemplates()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    await supabase.from('email_templates').delete().eq('id', id)
    fetchTemplates()
  }

  async function seedDefaults() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('email_templates').insert(DEFAULT_TEMPLATES.map(t => ({ ...t, user_id: user.id })))
    fetchTemplates()
  }

  function insertVariable(v: string) {
    setForm(f => ({ ...f, body: f.body + v }))
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade">

      <PageHeader
        title="Email Templates"
        subtitle="Customise the emails sent to your clients."
        action={
          <div className="flex gap-2">
            {templates.length === 0 && !loading && (
              <Button variant="outline" size="sm" onClick={seedDefaults}>Load defaults</Button>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} strokeWidth={2.5} />
              New template
            </Button>
          </div>
        }
      />

      {creating && (
        <div className="mx-8 mt-6 anim-slide-down">
          <Card>
            <CardHeader className="pb-4 border-b border-border/60 flex-row justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Mail size={15} strokeWidth={2} className="text-muted-foreground" />
                {editing ? 'Edit template' : 'New template'}
              </CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={closeForm}>
                <X size={15} strokeWidth={2} />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Template name">
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Overdue reminder"
                  />
                </FormField>
                <FormField label="Send on day">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        value={form.day_offset}
                        onChange={e => setForm(f => ({ ...f, day_offset: String(Math.max(0, parseInt(e.target.value) || 0)) }))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        {parseInt(form.day_offset) === 0 ? 'on due date' : `day${parseInt(form.day_offset) > 1 ? 's' : ''} after due date`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Quick:</span>
                      {DAY_OFFSET_PRESETS.map(d => (
                        <Button
                          key={d}
                          variant="outline"
                          onClick={() => setForm(f => ({ ...f, day_offset: String(d) }))}
                          className={cn(
                            'text-[11px] px-2 h-auto py-0.5 active:scale-95',
                            form.day_offset === String(d)
                              ? 'bg-accent text-accent-foreground border-accent hover:bg-accent'
                              : 'text-muted-foreground hover:border-accent/50 hover:text-foreground',
                          )}
                        >
                          {d === 0 ? 'Due date' : `+${d}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </FormField>
              </div>
              <FormField label="Subject line">
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Invoice — payment due today"
                />
              </FormField>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Body</span>
                  <div className="flex items-center gap-1.5">
                    <Tag size={11} strokeWidth={2} className="text-muted-foreground" />
                    {TEMPLATE_VARIABLES.map(v => (
                      <Button
                        key={v}
                        variant="outline"
                        onClick={() => insertVariable(v)}
                        className="text-[11px] px-2 h-auto py-0.5 bg-[var(--accent-subtle)] text-accent border-[var(--accent-border)] hover:bg-accent/10 active:scale-95"
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={10}
                  placeholder="Hi {{client_name}}, ..."
                  className="leading-relaxed"
                />
                <p className="text-xs text-muted-foreground m-0">Click a variable to insert it into the body.</p>
              </div>
              <Button
                onClick={save}
                disabled={saving || !form.name || !form.subject || !form.body}
                size="lg"
                className="w-full active:scale-[0.99]"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground px-8 py-10 text-sm">Loading…</p>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Create a custom template or load the defaults to get started."
          action={<Button onClick={seedDefaults} className="mt-2">Load default templates</Button>}
        />
      ) : (
        <div className="px-8 py-5 flex flex-col gap-2 anim-slide-up anim-d1">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-4 px-5 py-4 bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="text-[15px] font-medium text-card-foreground">{t.name}</span>
                <span className="text-sm text-muted-foreground truncate">{t.subject}</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-accent border border-[var(--accent-border)] shrink-0 uppercase tracking-wide">
                Day {t.day_offset === 0 ? '0' : `+${t.day_offset}`}
              </span>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => deleteTemplate(t.id)}
                  className="text-muted-foreground hover:text-destructive hover:border-destructive/30"
                >
                  <X size={13} strokeWidth={2} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
