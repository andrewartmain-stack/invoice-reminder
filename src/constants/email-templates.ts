export const DEFAULT_TEMPLATES = [
  {
    name: 'Due today',
    subject: 'Invoice — payment due today',
    body: `Hi {{client_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{amount}} is due today.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n{{sender_name}}`,
    day_offset: 0,
    type: 'reminder' as const,
  },
  {
    name: 'Overdue — gentle',
    subject: 'Friendly reminder — invoice overdue',
    body: `Hi {{client_name}},\n\nI wanted to follow up on invoice {{invoice_number}} for {{amount}}, which was due on {{due_date}}.\n\nCould you please arrange payment when you get a chance?\n\nThank you,\n{{sender_name}}`,
    day_offset: 3,
    type: 'reminder' as const,
  },
  {
    name: 'Overdue — firm',
    subject: 'Final notice — invoice requires attention',
    body: `Hi {{client_name}},\n\nThis is a final notice regarding invoice {{invoice_number}} for {{amount}}, which is now significantly overdue.\n\nPlease arrange payment immediately.\n\nThank you,\n{{sender_name}}`,
    day_offset: 14,
    type: 'reminder' as const,
  },
  {
    name: 'Payment received',
    subject: 'Thank you for your payment — invoice {{invoice_number}}',
    body: `Hi {{client_name}},\n\nThank you for settling invoice {{invoice_number}} for {{amount}}. Your payment has been received and everything is in order.\n\nIt's a pleasure working with you.\n\n{{sender_name}}`,
    day_offset: 0,
    type: 'thank_you' as const,
  },
  {
    name: 'Payment check-in',
    subject: 'Quick check-in — invoice {{invoice_number}}',
    body: `Hi {{client_name}},\n\nJust checking in on invoice {{invoice_number}} for {{amount}}, which was due on {{due_date}}. If you've already sent payment, please ignore this message.\n\nIf there's anything I can help with, feel free to reply.\n\n{{sender_name}}`,
    day_offset: 7,
    type: 'follow_up' as const,
  },
]

export const TEMPLATE_TYPE_CONFIG = {
  reminder:  { label: 'Reminders',               description: 'Sent automatically to clients with unpaid invoices' },
  thank_you: { label: 'Thank You',               description: 'Sent to clients when a payment is confirmed' },
  follow_up: { label: 'Follow-up Confirmation',  description: 'Sent to you when a client reports payment — asks you to confirm it was received' },
} as const

export const TEMPLATE_VARIABLES = [
  '{{client_name}}',
  '{{invoice_number}}',
  '{{amount}}',
  '{{due_date}}',
  '{{sender_name}}',
] as const

export const DAY_OFFSET_PRESETS_BEFORE = [-7, -5, -3, -2, -1] as const
export const DAY_OFFSET_PRESETS_AFTER  = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30] as const
export const DAY_OFFSET_PRESETS = [...DAY_OFFSET_PRESETS_BEFORE, ...DAY_OFFSET_PRESETS_AFTER] as const
