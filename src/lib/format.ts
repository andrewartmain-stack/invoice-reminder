export function formatDue(dateStr: string): { text: string; urgent: boolean } {
  const now = new Date()
  const due = new Date(dateStr)
  now.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true }
  if (diff === 0) return { text: 'Due today', urgent: true }
  if (diff === 1) return { text: 'Tomorrow', urgent: false }
  if (diff <= 7) return { text: `In ${diff} days`, urgent: false }
  return { text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), urgent: false }
}

export function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString()}`
}

export function formatDate(dateStr: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  return new Date(dateStr).toLocaleDateString('en-US', options)
}

export function isOverdue(status: string, dueDate: string): boolean {
  return ['pending', 'notified'].includes(status) && new Date(dueDate) < new Date()
}

export function getInitials(name: string, fallback = '?'): string {
  const trimmed = name.trim()
  if (!trimmed) return fallback
  return trimmed.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
