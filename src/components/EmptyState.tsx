import type { ElementType, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-1">
        <Icon size={24} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="text-[15px] font-semibold text-card-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action}
    </div>
  )
}
