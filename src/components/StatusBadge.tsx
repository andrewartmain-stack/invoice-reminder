import { cn } from '@/lib/utils'
import { INVOICE_STATUS_CONFIG } from '@/constants/invoice'
import type { InvoiceStatus } from '@/types/invoice'

interface StatusBadgeProps {
  status: InvoiceStatus
  overdue?: boolean
}

export function StatusBadge({ status, overdue = false }: StatusBadgeProps) {
  const cfg = INVOICE_STATUS_CONFIG[status] ?? INVOICE_STATUS_CONFIG.pending
  const cls = overdue ? 'bg-red-100 text-red-600' : cfg.badgeCls
  const label = overdue ? 'Overdue' : cfg.badgeLabel

  return (
    <span className={cn('inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full', cls)}>
      {label}
    </span>
  )
}
