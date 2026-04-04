import { toast } from 'sonner'

// Shared AudioContext — created lazily and resumed before each use
let _ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
    return _ctx
  } catch { return null }
}

// Warm up the context on first user interaction so it's ready for remote events
if (typeof window !== 'undefined') {
  const warm = () => {
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }
  window.addEventListener('pointerdown', warm, { once: true })
}

function playSound(type: 'paid' | 'reported' | 'reminder') {
  try {
    const ctx = getCtx()
    if (!ctx) return

    const go = () => {
      const master = ctx.createGain()
      master.connect(ctx.destination)

      const note = (freq: number, start: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(master)
        osc.type = 'sine'
        osc.frequency.value = freq
        g.gain.setValueAtTime(vol, ctx.currentTime + start)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }

      if (type === 'paid') {
        note(523, 0,    0.35, 0.28)
        note(784, 0.16, 0.45, 0.22)
      } else if (type === 'reported') {
        note(440, 0,    0.25, 0.20)
        note(550, 0.12, 0.35, 0.16)
        note(660, 0.26, 0.40, 0.12)
      } else {
        note(480, 0, 0.25, 0.15)
      }
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(go).catch(() => {})
    } else {
      go()
    }
  } catch { /* blocked or unsupported */ }
}

export function notifyReminderSent(subject: string, clients: string[]) {
  playSound('reminder')
  const who =
    clients.length === 1 ? clients[0]
    : clients.length === 2 ? `${clients[0]} & ${clients[1]}`
    : `${clients[0]} +${clients.length - 1} others`
  toast('Reminder sent', { description: `${who} · ${subject}` })
}

export function notifyMessageSent(clients: string[]) {
  playSound('reminder')
  const who =
    clients.length === 1 ? clients[0]
    : clients.length === 2 ? `${clients[0]} & ${clients[1]}`
    : `${clients[0]} +${clients.length - 1} others`
  toast('Message sent', { description: who })
}

export function notifyPaymentPaid(clientName: string, invoiceNumber?: string) {
  playSound('paid')
  const num = invoiceNumber ? ` #${invoiceNumber}` : ''
  toast.success('Payment received', { description: `${clientName}${num} marked as paid` })
}

export function notifyPaymentReported(clientName: string, invoiceNumber?: string) {
  playSound('reported')
  const num = invoiceNumber ? ` #${invoiceNumber}` : ''
  toast.info('Payment reported by client', { description: `${clientName}${num} says they've sent payment` })
}

export function notifyThankYouSent(clientName: string, invoiceNumber?: string) {
  playSound('paid')
  const num = invoiceNumber ? ` #${invoiceNumber}` : ''
  toast.success('Thank-you email sent', { description: `${clientName}${num}` })
}
