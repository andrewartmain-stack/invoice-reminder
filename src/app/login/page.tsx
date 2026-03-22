'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase/clent'
import { useRouter } from 'next/navigation'

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
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logoBlock}>
                    <span style={styles.logo}>paynudge</span>
                    <p style={styles.tagline}>Stop chasing payments.</p>
                </div>

                <div style={styles.fields}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            style={styles.input}
                            onKeyDown={e => e.key === 'Enter' && submit()}
                        />
                    </div>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={styles.input}
                            onKeyDown={e => e.key === 'Enter' && submit()}
                        />
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {message && <p style={styles.success}>{message}</p>}

                <button
                    onClick={submit}
                    disabled={loading}
                    style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
                >
                    {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>

                <button
                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                    style={styles.toggle}
                >
                    {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '360px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    logoBlock: { marginBottom: '8px' },
    logo: { fontSize: '20px', fontWeight: '600', color: 'var(--text-heading)', letterSpacing: '-0.5px' },
    tagline: { fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' },
    fields: { display: 'flex', flexDirection: 'column', gap: '12px' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '11px', color: 'var(--text-secondary)' },
    input: {
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: '6px',
        padding: '10px 12px',
        color: 'var(--text)',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as const,
    },
    btn: {
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: 'none',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    toggle: {
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center' as const,
    },
    error: { fontSize: '12px', color: '#ef4444', margin: 0 },
    success: { fontSize: '12px', color: '#10b981', margin: 0 },
}
