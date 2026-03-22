'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Invoice = {
    id: string
    client_name: string
    client_email: string
    amount: number
    currency: string
    invoice_number: string | null
    due_date: string
    status: string
    reminder_preset: string
    stripe_payment_link: string | null
    created_at: string
}

type Log = {
    id: string
    sent_at: string
    day_offset: number
    email_subject: string
    status: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#f59e0b' },
    notified: { label: 'Reminded', color: '#6366f1' },
    payment_reported: { label: 'Client reported', color: '#3b82f6' },
    paid: { label: 'Paid', color: '#10b981' },
    cancelled: { label: 'Cancelled', color: '#6b7280' },
}

export default function InvoiceDetailPage() {
    const { id } = useParams()
    const supabase = createClient()
    const router = useRouter()
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [id])

    async function fetchData() {
        const [{ data: inv }, { data: logData }] = await Promise.all([
            supabase.from('invoices').select('*').eq('id', id).single(),
            supabase.from('reminder_logs').select('*').eq('invoice_id', id).order('sent_at', { ascending: true }),
        ])
        setInvoice(inv)
        setLogs(logData || [])
        setLoading(false)
    }

    async function updateStatus(status: string) {
        await supabase.from('invoices').update({ status }).eq('id', id)
        fetchData()
    }

    async function deleteInvoice() {
        if (!confirm('Delete this invoice?')) return
        await supabase.from('invoices').delete().eq('id', id)
        router.push('/')
    }

    if (loading) return <div style={styles.page}><p style={{ color: 'var(--text-muted)', padding: '40px 32px' }}>Loading...</p></div>
    if (!invoice) return <div style={styles.page}><p style={{ color: 'var(--text-muted)', padding: '40px 32px' }}>Not found.</p></div>

    const s = STATUS_LABELS[invoice.status]
    const isOverdue = ['pending', 'notified'].includes(invoice.status) && new Date(invoice.due_date) < new Date()

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <Link href="/" style={styles.back}>← Back</Link>
            </header>

            <div style={styles.container}>
                {/* Top */}
                <div style={styles.top}>
                    <div>
                        <h1 style={styles.clientName}>{invoice.client_name}</h1>
                        <p style={styles.clientEmail}>{invoice.client_email}</p>
                    </div>
                    <div style={styles.amountBlock}>
                        <span style={styles.amount}>{invoice.currency} {Number(invoice.amount).toLocaleString()}</span>
                        <span style={{ ...styles.badge, background: s.color + '20', color: s.color }}>
                            {s.label}
                        </span>
                    </div>
                </div>

                {/* Meta */}
                <div style={styles.meta}>
                    <MetaItem label="Due date" value={
                        <>
                            {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            {isOverdue && <span style={{ color: '#ef4444', marginLeft: '8px' }}>Overdue</span>}
                        </>
                    } />
                    {invoice.invoice_number && <MetaItem label="Invoice #" value={invoice.invoice_number} />}
                    <MetaItem label="Schedule" value={invoice.reminder_preset} />
                    {invoice.stripe_payment_link && (
                        <MetaItem label="Payment link" value={
                            <a href={invoice.stripe_payment_link} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>
                                View link ↗
                            </a>
                        } />
                    )}
                </div>

                {/* Actions */}
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                    <div style={styles.actions}>
                        {invoice.status === 'payment_reported' && (
                            <button onClick={() => updateStatus('paid')} style={styles.btnSuccess}>
                                ✓ Confirm payment received
                            </button>
                        )}
                        {invoice.status !== 'payment_reported' && (
                            <button onClick={() => updateStatus('paid')} style={styles.btnOutline}>
                                Mark as paid
                            </button>
                        )}
                        <button onClick={() => updateStatus('cancelled')} style={styles.btnGhost}>
                            Cancel reminders
                        </button>
                    </div>
                )}

                {/* Reminder log */}
                <div style={styles.section}>
                    <p style={styles.sectionLabel}>Reminder history</p>
                    {logs.length === 0 ? (
                        <p style={styles.empty}>No reminders sent yet.</p>
                    ) : (
                        <div style={styles.logList}>
                            {logs.map(log => (
                                <div key={log.id} style={styles.logItem}>
                                    <span style={styles.logDot} />
                                    <div>
                                        <p style={styles.logSubject}>{log.email_subject || `Reminder day +${log.day_offset}`}</p>
                                        <p style={styles.logDate}>
                                            {new Date(log.sent_at).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <span style={{
                                        ...styles.logStatus,
                                        color: log.status === 'sent' ? '#10b981' : '#ef4444'
                                    }}>
                                        {log.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delete */}
                <button onClick={deleteInvoice} style={styles.btnDelete}>
                    Delete invoice
                </button>
            </div>
        </div>
    )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>{value}</span>
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
        padding: '20px 32px',
        borderBottom: '1px solid var(--border-subtle)',
    },
    back: { color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px' },
    container: {
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
    },
    top: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    clientName: { fontSize: '22px', fontWeight: '600', color: 'var(--text-heading)', margin: 0, letterSpacing: '-0.5px' },
    clientEmail: { fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' },
    amountBlock: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' },
    amount: { fontSize: '24px', fontWeight: '600', color: 'var(--text-heading)', letterSpacing: '-1px' },
    badge: {
        fontSize: '10px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '4px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    meta: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
    },
    actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
    btnSuccess: {
        background: '#10b98120',
        color: '#10b981',
        border: '1px solid #10b98140',
        borderRadius: '6px',
        padding: '10px 16px',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        fontWeight: '600',
    },
    btnOutline: {
        background: 'transparent',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '10px 16px',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    btnGhost: {
        background: 'transparent',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '10px 16px',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    section: { display: 'flex', flexDirection: 'column', gap: '12px' },
    sectionLabel: {
        fontSize: '10px',
        textTransform: 'uppercase' as const,
        letterSpacing: '1.5px',
        color: 'var(--text-muted)',
        margin: 0,
    },
    empty: { fontSize: '12px', color: 'var(--text-muted)', margin: 0 },
    logList: { display: 'flex', flexDirection: 'column', gap: '1px' },
    logItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: 'var(--bg-secondary)',
        borderRadius: '6px',
    },
    logDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#6366f1',
        flexShrink: 0,
    },
    logSubject: { fontSize: '12px', color: 'var(--text)', margin: 0 },
    logDate: { fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' },
    logStatus: { fontSize: '10px', marginLeft: 'auto', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    btnDelete: {
        background: 'transparent',
        color: '#ef444460',
        border: '1px solid #ef444420',
        borderRadius: '6px',
        padding: '10px 16px',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        alignSelf: 'flex-start' as const,
    },
}
