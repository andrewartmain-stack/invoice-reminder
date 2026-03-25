interface LoadingSpinnerProps {
  text?: string
  fullPage?: boolean
}

export function LoadingSpinner({ text, fullPage = true }: LoadingSpinnerProps) {
  return (
    <div className={fullPage ? 'flex flex-col items-center gap-3 py-24' : 'flex flex-col items-center gap-3'}>
      <div className="w-7 h-7 rounded-full border-2 border-border border-t-black/40 animate-spin" />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  )
}
