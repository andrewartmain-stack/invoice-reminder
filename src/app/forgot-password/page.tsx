'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Zap, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-[400px] shadow-[var(--shadow-md)]">
        <CardContent className="p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-xl font-bold text-card-foreground tracking-tight">paynudge</span>
              <p className="text-sm text-muted-foreground mt-0.5">Reset your password</p>
            </div>
          </div>

          <div className="h-px bg-border mb-8" />

          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#2ea8ff]/10 flex items-center justify-center">
                <CheckCircle size={24} strokeWidth={1.5} className="text-[#2ea8ff]" />
              </div>
              <p className="text-base font-semibold text-card-foreground">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground -mt-2">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} strokeWidth={2} className="shrink-0" />
                  {error}
                </div>
              )}

              <Button onClick={submit} disabled={loading || !email.trim()} size="lg" className="w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </div>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 w-full mt-4 text-sm text-muted-foreground hover:text-foreground no-underline transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={2} />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
