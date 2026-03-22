'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Invoice = {
    id: string
    client_name: string
    client_email: string
    amount: number
    currency: string
    invoice_number: string | null
    due_date: string
    status: 'pending' | 'notified' | 'payment_reported' | 'paid' | 'cancelled'
    reminder_preset: string
    created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#f59e0b' },
    notified: { label: 'Reminded', color: '#6366f1' },
    payment_reported: { label: 'Client reported', color: '#3b82f6' },
    paid: { label: 'Paid', color: '#10b981' },
    cancelled: { label: 'Cancelled', color: '#6b7280' },
}


export default function DashboardPage() {
    const supabase = createClient()
    const router = useRouter()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')

    useEffect(() => {
        fetchInvoices()
    }, [])

    async function fetchInvoices() {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('due_date', { ascending: true })

        if (error) console.error(error)
        else setInvoices(data || [])
        setLoading(false)
    }

    async function markAsPaid(id: string) {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
        fetchInvoices()
    }

    async function markAsNotReceived(id: string) {
        await fetch('/api/resume-reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice_id: id }),
        })
        fetchInvoices()
    }

    async function deleteInvoice(id: string) {
        if (!confirm('Delete this invoice?')) return
        await supabase.from('invoices').delete().eq('id', id)
        fetchInvoices()
    }

    async function signOut() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filtered = invoices.filter(inv => {
        if (filter === 'pending') return ['pending', 'notified', 'payment_reported'].includes(inv.status)
        if (filter === 'paid') return inv.status === 'paid'
        return true
    })

    const overdue = invoices.filter(i =>
        ['pending', 'notified'].includes(i.status) && new Date(i.due_date) < new Date()
    ).length

    const totalUnpaid = invoices
        .filter(i => !['paid', 'cancelled'].includes(i.status))
        .reduce((sum, i) => sum + Number(i.amount), 0)

    return (
        <div style={styles.page}>
            {/* Header */}
            <header style={styles.header}>
                <span style={styles.logo}>paynudge</span>
                <div style={styles.headerRight}>
                    <Link href="/invoices/new" style={styles.btnPrimary}>+ New</Link>
                    <button onClick={signOut} style={styles.btnGhost}>Sign out</button>
                </div>
            </header>

            {/* Stats */}
            <div style={styles.stats}>
                <div style={styles.statCard}>
                    <span style={styles.statValue}>{invoices.filter(i => !['paid', 'cancelled'].includes(i.status)).length}</span>
                    <span style={styles.statLabel}>Unpaid</span>
                </div>
                <div style={styles.statCard}>
                    <span style={styles.statValue}>{overdue}</span>
                    <span style={styles.statLabel}>Overdue</span>
                </div>
                <div style={styles.statCard}>
                    <span style={styles.statValue}>${totalUnpaid.toLocaleString()}</span>
                    <span style={styles.statLabel}>Outstanding</span>
                </div>
                <div style={styles.statCard}>
                    <span style={styles.statValue}>{invoices.filter(i => i.status === 'paid').length}</span>
                    <span style={styles.statLabel}>Paid</span>
                </div>
            </div>

            {/* Filter tabs */}
            <div style={styles.tabs}>
                {(['all', 'pending', 'paid'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{ ...styles.tab, ...(filter === f ? styles.tabActive : {}) }}
                    >
                        {f === 'all' ? 'All' : f === 'pending' ? 'Unpaid' : 'Paid'}
                    </button>
                ))}
            </div>

            {/* Invoice list */}
            {loading ? (
                <p style={styles.empty}>Loading...</p>
            ) : filtered.length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={styles.emptyText}>No invoices yet.</p>
                    <Link href="/invoices/new" style={styles.btnPrimary}>Create your first</Link>
                </div>
            ) : (
                <div style={styles.list}>
                    {filtered.map(inv => {
                        const isOverdue = ['pending', 'notified'].includes(inv.status) && new Date(inv.due_date) < new Date()
                        const s = STATUS_LABELS[inv.status]
                        return (
                            <div key={inv.id} style={styles.card}>
                                <div style={styles.cardLeft}>
                                    <div style={styles.cardName}>{inv.client_name}</div>
                                    <div style={styles.cardMeta}>
                                        {inv.invoice_number && <span>#{inv.invoice_number} · </span>}
                                        <span style={isOverdue ? { color: '#ef4444' } : {}}>
                                            Due {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            {isOverdue && ' ⚠'}
                                        </span>
                                    </div>
                                </div>
                                <div style={styles.cardMiddle}>
                                    <span style={{ ...styles.badge, background: s.color + '20', color: s.color }}>
                                        {s.label}
                                    </span>
                                </div>
                                <div style={styles.cardRight}>
                                    <span style={styles.amount}>${Number(inv.amount).toLocaleString()}</span>
                                    <div style={styles.actions}>
                                        {inv.status === 'payment_reported' && (
                                            <>
                                                <button onClick={() => markAsPaid(inv.id)} style={styles.btnSuccess}>
                                                    ✓ Confirm paid
                                                </button>
                                                <button onClick={() => markAsNotReceived(inv.id)} style={styles.btnWarning}>
                                                    ✗ Not received
                                                </button>
                                            </>
                                        )}
                                        {!['paid', 'cancelled'].includes(inv.status) && inv.status !== 'payment_reported' && (
                                            <button onClick={() => markAsPaid(inv.id)} style={styles.btnSmall}>
                                                Mark paid
                                            </button>
                                        )}
                                        <Link href={`/invoices/${inv.id}`} style={styles.btnSmall}>View</Link>
                                        <button onClick={() => deleteInvoice(inv.id)} style={styles.btnDanger}>✕</button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    btnWarning: {
        background: '#ef444420',
        color: '#ef4444',
        border: '1px solid #ef444440',
        borderRadius: '5px',
        padding: '5px 10px',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: "'DM Mono', monospace",
        fontWeight: '600',
    },
    page: {
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "'Inter', sans-serif",
        padding: '0 0 60px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        borderBottom: '1px solid var(--border-subtle)',
    },
    logo: {
        fontSize: '18px',
        fontWeight: '600',
        letterSpacing: '-0.5px',
        color: 'var(--text-heading)',
    },
    headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
    btnPrimary: {
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: "'Inter', sans-serif",
    },
    btnGhost: {
        background: 'transparent',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '8px 14px',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    btnSmall: {
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: '5px',
        padding: '5px 10px',
        fontSize: '11px',
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: "'Inter', sans-serif",
    },
    btnSuccess: {
        background: '#10b98120',
        color: '#10b981',
        border: '1px solid #10b98140',
        borderRadius: '5px',
        padding: '5px 10px',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        fontWeight: '600',
    },
    btnDanger: {
        background: 'transparent',
        color: '#ef444460',
        border: 'none',
        borderRadius: '5px',
        padding: '5px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    stats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-subtle)',
    },
    statCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '24px 32px',
        background: 'var(--bg)',
    },
    statValue: { fontSize: '28px', fontWeight: '600', color: 'var(--text-heading)', letterSpacing: '-1px' },
    statLabel: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' },
    tabs: {
        display: 'flex',
        gap: '0',
        padding: '20px 32px 0',
        borderBottom: '1px solid var(--border-subtle)',
    },
    tab: {
        background: 'none',
        border: 'none',
        borderBottomWidth: '2px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'transparent',
        color: 'var(--text-muted)',
        padding: '8px 16px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontFamily: "'Inter', sans-serif",
        marginBottom: '-1px',
    },
    tabActive: { color: 'var(--text-heading)', borderBottomColor: 'var(--text-heading)' },
    list: { padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: '1px' },
    card: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
    },
    cardLeft: { flex: 1 },
    cardName: { fontSize: '14px', color: 'var(--text)', fontWeight: '500' },
    cardMeta: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' },
    cardMiddle: { display: 'flex', alignItems: 'center' },
    cardRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    badge: {
        fontSize: '10px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    amount: { fontSize: '15px', fontWeight: '600', color: 'var(--text-heading)', minWidth: '80px', textAlign: 'right' },
    actions: { display: 'flex', gap: '6px', alignItems: 'center' },
    empty: { color: 'var(--text-muted)', padding: '40px 32px', fontSize: '13px' },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '80px 32px',
    },
    emptyText: { color: 'var(--text-muted)', fontSize: '13px' },
}
