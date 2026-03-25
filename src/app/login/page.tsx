'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/FormField'
import { Alert } from '@/components/Alert'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      router.push('/')
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      setMessage('Check your email to confirm your account.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 anim-fade">
      <Card className="w-full max-w-100 shadow-(--shadow-md) anim-scale-in">
        <CardContent className="p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-xl font-bold text-card-foreground tracking-tight">paynudge</span>
              <p className="text-sm text-muted-foreground mt-0.5">Stop chasing payments.</p>
            </div>
          </div>

          <div className="h-px bg-border mb-8" />

          <div className="flex flex-col gap-4">
            <FormField label="Email address">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </FormField>
            <FormField label="Password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </FormField>
          </div>

          {error   && <Alert variant="error"   className="mt-4">{error}</Alert>}
          {message && <Alert variant="success" className="mt-4">{message}</Alert>}

          <Button onClick={submit} disabled={loading} size="lg" className="w-full mt-6 active:scale-[0.98]">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>

          {mode === 'login' && (
            <div className="flex justify-end mt-2">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground no-underline transition-colors">
                Forgot password?
              </Link>
            </div>
          )}

          <Button
            variant="link"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="w-full mt-3 h-auto py-1"
          >
            {mode === 'login' ? "Don't have an account? Sign up →" : '← Back to sign in'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
