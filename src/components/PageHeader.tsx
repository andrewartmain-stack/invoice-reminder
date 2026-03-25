import type { ElementType, ReactNode } from 'react'

interface PageHeaderProps {
  icon?: ElementType
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 pt-8 pb-5">
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={16} strokeWidth={2} className="text-black/35" />}
          <span className="text-[22px] font-bold text-card-foreground tracking-tight">{title}</span>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 m-0">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  )
}
