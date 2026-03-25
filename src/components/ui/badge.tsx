import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors uppercase",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-muted text-muted-foreground border border-border",
        success: "bg-[#2ea8ff]/10 text-[#2ea8ff] border border-[#2ea8ff]/25",
        warning: "bg-black/6 text-black/50 border border-black/10",
        destructive: "bg-red-500/10 text-red-500 border border-red-500/25",
        info: "bg-[#2ea8ff]/10 text-[#2ea8ff] border border-[#2ea8ff]/25",
        accent: "bg-[var(--accent-subtle)] text-accent border border-[var(--accent-border)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
