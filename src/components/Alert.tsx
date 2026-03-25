import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'error' | 'success' | 'info'

interface AlertProps {
  variant: AlertVariant
  children: ReactNode
  className?: string
}

const STYLES: Record<AlertVariant, { cls: string; Icon: typeof AlertCircle }> = {
  error:   { cls: 'text-destructive bg-destructive/8 border-destructive/20',        Icon: AlertCircle  },
  success: { cls: 'text-emerald-600 bg-emerald-50 border-emerald-200/60',           Icon: CheckCircle  },
  info:    { cls: 'text-[#2ea8ff] bg-[#2ea8ff]/8 border-[#2ea8ff]/20',             Icon: Info         },
}

export function Alert({ variant, children, className }: AlertProps) {
  const { cls, Icon } = STYLES[variant]
  return (
    <div className={cn(
      'flex items-center gap-2 text-[13px] border rounded-xl px-4 py-2.5 anim-slide-down',
      cls,
      className,
    )}>
      <Icon size={14} strokeWidth={2} className="shrink-0" />
      {children}
    </div>
  )
}
