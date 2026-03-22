'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PRESETS = [
    {
        id: 'gentle',
        label: '🟢 Gentle',
        desc: 'Day 0 + Day 3',
        days: [0, 3],
    },
    {
        id: 'standard',
        label: '🟡 Standard',
        desc: 'Day 0 + 3 + 7',
        days: [0, 3, 7],
    },
    {
        id: 'firm',
        label: '🔴 Firm',
        desc: 'Day 0 + 3 + 7 + 14',
        days: [0, 3, 7, 14],
    },
]

export default function NewInvoicePage() {
    const supabase = createClient()
    const router = useRouter()

    const [form, setForm] = useState({
        client_name: '',
        client_email: '',
        amount: '',
        currency: 'USD',
        invoice_number: '',
        due_date: '',
        stripe_payment_link: '',
        reminder_preset: 'standard',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    function set(field: string, value: string) {
        setForm(f => ({ ...f, [field]: value }))
    }

    async function submit() {
        if (!form.client_name || !form.client_email || !form.amount || !form.due_date) {
            setError('Please fill all required fields.')
            return
        }
        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { error: err } = await supabase.from('invoices').insert({
            user_id: user.id,
            client_name: form.client_name,
            client_email: form.client_email,
            amount: parseFloat(form.amount),
            currency: form.currency,
            invoice_number: form.invoice_number || null,
            due_date: form.due_date,
            stripe_payment_link: form.stripe_payment_link || null,
            reminder_preset: form.reminder_preset,
            status: 'pending',
        })

        if (err) { setError(err.message); setLoading(false); return }
        router.push('/')
    }

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <Link href="/" style={styles.back}>← Back</Link>
                <span style={styles.title}>New invoice</span>
            </header>

            <div style={styles.form}>
                {/* Client */}
                <section style={styles.section}>
                    <label style={styles.sectionLabel}>Client</label>
                    <div style={styles.row}>
                        <Field
                            label="Name *"
                            value={form.client_name}
                            onChange={v => set('client_name', v)}
                            placeholder="John Smith"
                        />
                        <Field
                            label="Email *"
                            type="email"
                            value={form.client_email}
                            onChange={v => set('client_email', v)}
                            placeholder="john@company.com"
                        />
                    </div>
                </section>

                {/* Invoice */}
                <section style={styles.section}>
                    <label style={styles.sectionLabel}>Invoice</label>
                    <div style={styles.row}>
                        <Field
                            label="Amount *"
                            type="number"
                            value={form.amount}
                            onChange={v => set('amount', v)}
                            placeholder="1500"
                            prefix={form.currency}
                        />
                        <Field
                            label="Due date *"
                            type="date"
                            value={form.due_date}
                            onChange={v => set('due_date', v)}
                        />
                    </div>
                    <div style={styles.row}>
                        <Field
                            label="Invoice # (optional)"
                            value={form.invoice_number}
                            onChange={v => set('invoice_number', v)}
                            placeholder="INV-042"
                        />
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Currency</label>
                            <select
                                style={styles.select}
                                value={form.currency}
                                onChange={e => set('currency', e.target.value)}
                            >
                                {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Payment link */}
                <section style={styles.section}>
                    <label style={styles.sectionLabel}>Payment link <span style={styles.optional}>(optional)</span></label>
                    <Field
                        label="Stripe / PayPal payment URL"
                        value={form.stripe_payment_link}
                        onChange={v => set('stripe_payment_link', v)}
                        placeholder="https://buy.stripe.com/..."
                        full
                    />
                    <p style={styles.hint}>If provided, client can pay directly from the reminder email. Status updates automatically on payment.</p>
                </section>

                {/* Reminder preset */}
                <section style={styles.section}>
                    <label style={styles.sectionLabel}>Reminder schedule</label>
                    <div style={styles.presets}>
                        {PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => set('reminder_preset', p.id)}
                                style={{
                                    ...styles.preset,
                                    ...(form.reminder_preset === p.id ? styles.presetActive : {}),
                                }}
                            >
                                <span style={styles.presetLabel}>{p.label}</span>
                                <span style={styles.presetDesc}>{p.desc}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {error && <p style={styles.error}>{error}</p>}

                <button
                    onClick={submit}
                    disabled={loading}
                    style={{ ...styles.submit, opacity: loading ? 0.6 : 1 }}
                >
                    {loading ? 'Saving...' : 'Create & start reminders'}
                </button>
            </div>
        </div>
    )
}

function Field({
    label, value, onChange, placeholder = '', type = 'text', prefix, full = false
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    prefix?: string
    full?: boolean
}) {
    return (
        <div style={{ ...styles.fieldGroup, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputWrapper}>
                {prefix && <span style={styles.prefix}>{prefix}</span>}
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{ ...styles.input, ...(prefix ? { paddingLeft: '52px' } : {}) }}
                />
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "'Inter', sans-serif",
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 32px',
        borderBottom: '1px solid var(--border-subtle)',
    },
    back: {
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        fontSize: '13px',
    },
    title: { fontSize: '15px', fontWeight: '600', color: 'var(--text-heading)' },
    form: {
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '36px',
    },
    section: { display: 'flex', flexDirection: 'column', gap: '12px' },
    sectionLabel: {
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: 'var(--text-muted)',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-subtle)',
    },
    optional: { color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 },
    row: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
    },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '11px', color: 'var(--text-secondary)' },
    inputWrapper: { position: 'relative' },
    prefix: {
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '11px',
        color: 'var(--text-muted)',
    },
    input: {
        width: '100%',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: '6px',
        padding: '10px 12px',
        color: 'var(--text)',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
    },
    select: {
        width: '100%',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: '6px',
        padding: '10px 12px',
        color: 'var(--text)',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
    },
    hint: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' },
    presets: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
    preset: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.15s',
    },
    presetActive: { border: '1px solid var(--text-heading)', background: 'var(--bg-tertiary)' },
    presetLabel: { fontSize: '12px', color: 'var(--text)' },
    presetDesc: { fontSize: '10px', color: 'var(--text-muted)' },
    error: { fontSize: '12px', color: '#ef4444' },
    submit: {
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: 'none',
        borderRadius: '8px',
        padding: '14px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '0.3px',
    },
}
