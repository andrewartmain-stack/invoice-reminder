'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, CreditCard, Lock, Zap, Mail, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import type { Profile } from '@/types/profile'

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pb-4 mb-5 border-b border-black/[0.07]">
        <Icon size={14} strokeWidth={2} className="text-black/35" />
        <span className="text-[13px] font-semibold text-black/50 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [senderName, setSenderName] = useState('')
  const [senderSaving, setSenderSaving] = useState(false)
  const [senderSaved, setSenderSaved] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, sender_name, plan')
        .eq('id', user.id)
        .single()
      const p: Profile = {
        id: user.id,
        email: user.email || '',
        full_name: data?.full_name || null,
        sender_name: data?.sender_name || null,
        plan: data?.plan || 'trial',
      }
      setProfile(p)
      setSenderName(data?.sender_name || '')
      setLoading(false)
    }
    load()
  }, [])

  async function saveSenderName() {
    if (!profile) return
    setSenderSaving(true)
    await supabase.from('profiles').update({ sender_name: senderName.trim() || null }).eq('id', profile.id)
    setProfile(p => p ? { ...p, sender_name: senderName.trim() || null } : p)
    setSenderSaving(false)
    setSenderSaved(true)
    setTimeout(() => setSenderSaved(false), 2000)
  }

  async function changeEmail() {
    if (!newEmail.trim()) return
    setEmailSaving(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ type: 'error', text: error.message })
    } else {
      setEmailMsg({ type: 'success', text: `Confirmation sent to ${newEmail.trim()}` })
      setNewEmail('')
    }
  }

  async function changePassword() {
    setPasswordMsg(null)
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const isPaid = profile?.plan === 'paid'

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade">

      <PageHeader icon={Settings} title="Settings" />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="px-8 pb-20 flex flex-col gap-8">

          {/* Profile strip */}
          <div className="flex items-center gap-4 p-6 bg-[#f5f5f7] rounded-2xl anim-slide-up">
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-bold text-black leading-snug">{profile?.email}</div>
            </div>
            <span className={cn(
              'text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shrink-0',
              isPaid ? 'bg-black text-white' : 'bg-white text-black/50 border border-black/10',
            )}>
              {isPaid ? 'Pro' : 'Free Trial'}
            </span>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-8 items-start">

            {/* Left column */}
            <div className="flex flex-col gap-8 anim-slide-up anim-d1">

              <Section icon={User} title="Account">
                <FormField label="Email address" hint="Your login email cannot be changed here.">
                  <Input value={profile?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
                </FormField>
              </Section>

              <Section icon={Mail} title="Email sending">
                <div className="flex flex-col gap-5">
                  <FormField
                    label="Sender name"
                    hint={`Your clients will see: ${senderName.trim() ? `${senderName.trim()} via PayNudge` : 'PayNudge'} as the sender.`}
                  >
                    <Input
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </FormField>
                  <Button
                    onClick={saveSenderName}
                    disabled={senderSaving || senderName === (profile?.sender_name || '')}
                    size="sm"
                    className="self-start active:scale-95"
                    variant={senderSaved ? 'success' : 'default'}
                  >
                    {senderSaved ? '✓ Saved' : senderSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </Section>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-8 anim-slide-up anim-d2">

              <Section icon={CreditCard} title="Plan">
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4 p-5 bg-[#f5f5f7] rounded-xl">
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-semibold text-card-foreground">
                        {isPaid ? 'Pro plan' : 'Free Trial'}
                      </span>
                      <span className="text-[13px] text-muted-foreground leading-relaxed">
                        {isPaid
                          ? 'Full access to all features, unlimited invoices.'
                          : 'Limited to 3 active invoices. Upgrade to remove limits.'}
                      </span>
                    </div>
                  </div>

                  {!isPaid && (
                    <div className="flex items-start gap-4 p-5 rounded-xl border border-black/10 bg-white">
                      <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center shrink-0 mt-0.5">
                        <Zap size={15} strokeWidth={2.5} className="text-white" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[14px] font-semibold text-card-foreground">Upgrade to Pro</span>
                        <span className="text-[13px] text-muted-foreground">Unlimited invoices, custom branding, priority support.</span>
                        <Button size="sm" className="mt-2 self-start active:scale-95">Upgrade now</Button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              <Section icon={Lock} title="Security">
                <div className="flex flex-col gap-7">

                  {/* Change email */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-card-foreground">Change email</div>
                      <div className="text-[13px] text-muted-foreground mt-0.5">A confirmation link will be sent to the new address.</div>
                    </div>
                    <FormField label="New email address">
                      <Input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="new@example.com"
                      />
                    </FormField>
                    {emailMsg && <Alert variant={emailMsg.type === 'success' ? 'success' : 'error'}>{emailMsg.text}</Alert>}
                    <Button
                      onClick={changeEmail}
                      disabled={emailSaving || !newEmail.trim()}
                      size="sm"
                      className="self-start active:scale-95"
                    >
                      {emailSaving ? 'Sending…' : 'Update email'}
                    </Button>
                  </div>

                  <div className="border-t border-black/[0.07]" />

                  {/* Change password */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-card-foreground">Change password</div>
                      <div className="text-[13px] text-muted-foreground mt-0.5">Minimum 8 characters.</div>
                    </div>
                    <FormField label="New password">
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </FormField>
                    <FormField label="Confirm new password">
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </FormField>
                    {passwordMsg && <Alert variant={passwordMsg.type === 'success' ? 'success' : 'error'}>{passwordMsg.text}</Alert>}
                    <Button
                      onClick={changePassword}
                      disabled={passwordSaving || !newPassword || !confirmPassword}
                      size="sm"
                      className="self-start active:scale-95"
                    >
                      {passwordSaving ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
