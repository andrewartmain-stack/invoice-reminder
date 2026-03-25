import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = '500px' }: ModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] anim-fade"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl border border-border shadow-[var(--shadow-md)] w-full flex flex-col overflow-hidden anim-scale-in"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <span className="text-[15px] font-semibold text-card-foreground">{title}</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} strokeWidth={2} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
