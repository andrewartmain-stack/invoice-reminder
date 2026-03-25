import type { ReactNode, ElementType } from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  titleIcon?: ElementType
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, titleIcon: TitleIcon, badge, children, className }: SectionCardProps) {
  return (
    <div className={cn('rounded-2xl border border-black/[0.07] bg-white overflow-hidden', className)}>
      {title && (
        <div className="flex items-center gap-2 px-6 py-4 border-b border-black/6">
          {TitleIcon && <TitleIcon size={13} strokeWidth={2} className="text-black/30" />}
          <span className="text-[11px] font-semibold text-black/35 uppercase tracking-wider">{title}</span>
          {badge}
        </div>
      )}
      {children}
    </div>
  )
}
