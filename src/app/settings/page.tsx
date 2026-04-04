'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Zap, Mail, Settings, AtSign, KeyRound, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'
import type { Profile } from '@/types/profile'

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-white border border-black/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-black/[0.06]">
        <Icon size={14} strokeWidth={2} className="text-black/35" />
        <span className="text-[12px] font-semibold text-black/40 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex flex-col gap-5 px-6 py-5">
        {children}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

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
        .select('id, email, full_name, sender_name, plan, avatar_url')
        .eq('id', user.id)
        .single()
      const p: Profile = {
        id: user.id,
        email: user.email || '',
        full_name: data?.full_name || null,
        sender_name: data?.sender_name || null,
        plan: data?.plan || 'trial',
        avatar_url: data?.avatar_url || null,
      }
      setProfile(p)
      setSenderName(data?.sender_name || '')
      setAvatarUrl(data?.avatar_url || null)
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setAvatarUploading(true)
    setAvatarError('')
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `profile-avatars/${profile.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      setAvatarError(`Upload failed: ${uploadError.message}`)
      setAvatarUploading(false)
      e.target.value = ''
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', profile.id)
    if (dbError) {
      setAvatarError(`Could not save avatar: ${dbError.message}`)
      setAvatarUploading(false)
      e.target.value = ''
      return
    }
    setAvatarUrl(url)
    setProfile(p => p ? { ...p, avatar_url: url } : p)
    setAvatarUploading(false)
    e.target.value = ''
  }

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
  const initials = profile?.email ? profile.email.charAt(0).toUpperCase() : '?'

  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,sans-serif] anim-fade rounded-l-2xl">

      <PageHeader icon={Settings} title="Settings" />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="px-8 pb-20 flex flex-col gap-6 anim-slide-up">

          {/* Profile strip */}
          <div className="flex items-center gap-5 px-7 py-5 rounded-2xl bg-gradient-to-r from-amber-200 to-amber-300">

            {/* Avatar */}
            <div className="relative shrink-0 group">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div
                onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                className="w-14 h-14 rounded-full overflow-hidden bg-black/15 flex items-center justify-center cursor-pointer ring-2 ring-white/50 transition-all group-hover:ring-white"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[20px] font-bold text-black/40">{initials}</span>
                )}
              </div>
              <div
                onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black flex items-center justify-center cursor-pointer shadow-sm"
              >
                {avatarUploading
                  ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <Camera size={10} strokeWidth={2.5} className="text-white" />
                }
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-black leading-snug truncate">{profile?.email}</div>
              <div className="text-[12px] text-black/50 mt-0.5">
                {avatarUploading ? 'Uploading photo…' : profile?.sender_name ? `Sending as ${profile.sender_name}` : 'Click the photo to upload'}
              </div>
              {avatarError && <div className="text-[11px] text-red-600 mt-1">{avatarError}</div>}
            </div>

            <span className={cn(
              'text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shrink-0',
              isPaid ? 'bg-black text-white' : 'bg-white/70 text-black/50 border border-black/10',
            )}>
              {isPaid ? 'Pro' : 'Free Trial'}
            </span>
          </div>

          {/* Main grid — 3 equal columns */}
          <div className="grid grid-cols-3 gap-5 items-start">

            <Card icon={Mail} title="Sender name">
              <FormField
                label="Display name"
                hint={`Clients see: ${senderName.trim() ? `${senderName.trim()} via PayNudge` : 'PayNudge'}`}
              >
                <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="John Smith" />
              </FormField>
              <Button
                onClick={saveSenderName}
                disabled={senderSaving || senderName === (profile?.sender_name || '')}
                size="sm" className="self-start active:scale-95"
                variant={senderSaved ? 'success' : 'default'}
              >
                {senderSaved ? '✓ Saved' : senderSaving ? 'Saving…' : 'Save'}
              </Button>
            </Card>

            <Card icon={AtSign} title="Change email">
              <FormField label="New email address" hint="A confirmation link will be sent to the new address.">
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" />
              </FormField>
              {emailMsg && <Alert variant={emailMsg.type === 'success' ? 'success' : 'error'}>{emailMsg.text}</Alert>}
              <Button onClick={changeEmail} disabled={emailSaving || !newEmail.trim()} size="sm" className="self-start active:scale-95">
                {emailSaving ? 'Sending…' : 'Update email'}
              </Button>
            </Card>

            <Card icon={KeyRound} title="Change password">
              <FormField label="New password" hint="Minimum 8 characters.">
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
              </FormField>
              <FormField label="Confirm password">
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </FormField>
              {passwordMsg && <Alert variant={passwordMsg.type === 'success' ? 'success' : 'error'}>{passwordMsg.text}</Alert>}
              <Button onClick={changePassword} disabled={passwordSaving || !newPassword || !confirmPassword} size="sm" className="self-start active:scale-95">
                {passwordSaving ? 'Updating…' : 'Update password'}
              </Button>
            </Card>
          </div>

          {/* Plan — full width */}
          <div className="flex flex-col bg-white border border-black/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-black/[0.06]">
              <CreditCard size={14} strokeWidth={2} className="text-black/35" />
              <span className="text-[12px] font-semibold text-black/40 uppercase tracking-wider">Plan & billing</span>
            </div>
            <div className="flex items-stretch gap-0 divide-x divide-black/[0.06]">
              <div className="flex-1 px-6 py-5 flex flex-col gap-1">
                <span className="text-[12px] text-black/35 font-medium uppercase tracking-wider">Current plan</span>
                <span className="text-[20px] font-bold text-card-foreground mt-1">{isPaid ? 'Pro' : 'Free Trial'}</span>
                <span className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                  {isPaid ? 'Full access to all features, unlimited invoices.' : 'Limited to 3 active invoices. Upgrade to remove limits.'}
                </span>
              </div>
              <div className="flex-1 px-6 py-5 flex items-center gap-4">
                {isPaid ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center shrink-0">
                      <Zap size={15} strokeWidth={2.5} className="text-white" />
                    </div>
                    <span className="text-[14px] text-card-foreground font-medium">You're on the Pro plan — all features unlocked.</span>
                  </div>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center shrink-0">
                      <Zap size={15} strokeWidth={2.5} className="text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-semibold text-card-foreground">Upgrade to Pro</span>
                      <span className="text-[13px] text-muted-foreground">Unlimited invoices, custom branding, priority support.</span>
                    </div>
                    <Button size="sm" className="ml-auto shrink-0 active:scale-95">Upgrade now</Button>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
