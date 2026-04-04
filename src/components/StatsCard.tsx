import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CardColor = 'neutral' | 'green' | 'yellow' | 'red' | 'blue'

interface StatsCardProps {
  icon: ElementType
  label: string
  value: ReactNode
  sub: string
  color?: CardColor
  className?: string
}

export function StatsCard({ icon: Icon, label, value, sub, color = 'neutral', className }: StatsCardProps) {
  return (
    <div className={cn('h-36 rounded-xl p-5 flex-1 bg-gray-50', className)}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex items-center gap-2">
          <Icon size={13} strokeWidth={2} className="" />
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider')}>{label}</span>
        </div>
        <div>
          <div className={cn('text-[2rem] font-bold leading-none tabular-nums')}>{value}</div>
          <div className={cn('text-[11px] mt-1')}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

// Legacy named exports
export { StatsCard as DarkStatsCard, StatsCard as LightStatsCard }
