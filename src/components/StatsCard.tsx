import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CardColor = 'neutral' | 'green' | 'yellow' | 'red' | 'blue'

const COLOR_CONFIG: Record<CardColor, {
  bg: string; border: string; icon: string; label: string; value: string; sub: string
}> = {
  neutral: {
    bg: 'bg-white',
    border: 'border-black/7',
    icon: 'text-black/30',
    label: 'text-black/35',
    value: 'text-black',
    sub: 'text-black/35',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    icon: 'text-emerald-500',
    label: 'text-emerald-700/60',
    value: 'text-emerald-700',
    sub: 'text-emerald-600/55',
  },
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-200/70',
    icon: 'text-amber-500',
    label: 'text-amber-700/65',
    value: 'text-amber-700',
    sub: 'text-amber-600/60',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200/80',
    icon: 'text-red-400',
    label: 'text-red-400/80',
    value: 'text-red-500',
    sub: 'text-red-400/60',
  },
  blue: {
    bg: 'bg-sky-50',
    border: 'border-sky-100',
    icon: 'text-sky-500',
    label: 'text-sky-700/60',
    value: 'text-sky-700',
    sub: 'text-sky-600/55',
  },
}

interface StatsCardProps {
  icon: ElementType
  label: string
  value: ReactNode
  sub: string
  color?: CardColor
  className?: string
}

export function StatsCard({ icon: Icon, label, value, sub, color = 'neutral', className }: StatsCardProps) {
  const c = COLOR_CONFIG[color]
  return (
    <div className={cn('h-36 rounded-xl p-5 flex-1 border', c.bg, c.border, className)}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex items-center gap-2">
          <Icon size={13} strokeWidth={2} className={c.icon} />
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider', c.label)}>{label}</span>
        </div>
        <div>
          <div className={cn('text-[2rem] font-bold leading-none tabular-nums', c.value)}>{value}</div>
          <div className={cn('text-[11px] mt-1', c.sub)}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

// Legacy named exports
export { StatsCard as DarkStatsCard, StatsCard as LightStatsCard }
