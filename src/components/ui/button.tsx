import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--shadow-sm)]",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        ghost: "bg-transparent text-foreground/70 hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-foreground hover:bg-muted",
        accent: "bg-amber-300 text-foreground",
        destructive: "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/15",
        success: "bg-[#2ea8ff]/10 text-[#2ea8ff] border border-[#2ea8ff]/25 hover:bg-[#2ea8ff]/15",
        warning: "bg-red-500/10 text-red-500 border border-red-500/25 hover:bg-red-500/15",
        link: "bg-transparent text-muted-foreground underline underline-offset-2 decoration-border hover:text-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "size-9",
        "icon-sm": "size-8 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
