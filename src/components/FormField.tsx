import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  required?: boolean
  optional?: boolean
  hint?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, required, optional, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && <span className="text-black/30 font-normal text-xs ml-1">(optional)</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground m-0">{hint}</p>}
    </div>
  )
}
