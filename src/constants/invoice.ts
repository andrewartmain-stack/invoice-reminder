import type { InvoiceStatus } from '@/types/invoice'

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, {
  label: string
  badgeLabel: string
  badgeCls: string
  dot: string
  text: string
  bg: string
}> = {
  pending:          { label: 'Pending',         badgeLabel: 'Pending',   badgeCls: 'bg-black/6 text-black/50',          dot: 'bg-black/20',    text: 'text-black/50',    bg: 'bg-black/5'     },
  notified:         { label: 'Reminded',         badgeLabel: 'Reminded',  badgeCls: 'bg-black/8 text-black/65',          dot: 'bg-black/55',    text: 'text-black/65',    bg: 'bg-black/5'     },
  payment_reported: { label: 'Client reported',  badgeLabel: 'Awaiting',  badgeCls: 'bg-amber-100 text-amber-700',       dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50'    },
  paid:             { label: 'Paid',             badgeLabel: 'Paid',      badgeCls: 'bg-emerald-100 text-emerald-700',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50'  },
  cancelled:        { label: 'Cancelled',        badgeLabel: 'Cancelled', badgeCls: 'bg-black/4 text-black/30',          dot: 'bg-black/15',    text: 'text-black/35',    bg: 'bg-black/4'     },
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const
export type Currency = typeof CURRENCIES[number]

export const UNPAID_STATUSES: InvoiceStatus[] = ['pending', 'notified', 'payment_reported']
export const ACTIVE_STATUSES: InvoiceStatus[] = ['pending', 'notified']
