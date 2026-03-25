import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex items-center gap-1 p-1 bg-black/4 rounded-xl', className)}>
      {tabs.map(tab => (
        <Button
          key={tab.id}
          variant="ghost"
          onClick={() => onChange(tab.id)}
          className={cn(
            'h-auto px-4 py-1.5 text-[13px] font-medium',
            active === tab.id
              ? 'bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)] hover:bg-white'
              : 'text-black/45 hover:text-black/70 hover:bg-white/50',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-[11px] font-semibold px-1.5 py-px rounded-full tabular-nums transition-colors duration-150',
              active === tab.id ? 'bg-black/8 text-black/60' : 'bg-black/5 text-black/35',
            )}>
              {tab.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  )
}
