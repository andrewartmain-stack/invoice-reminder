export const DEFAULT_TEMPLATES = [
  {
    name: 'Due today',
    subject: 'Invoice — payment due today',
    body: `Hi {{client_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{amount}} is due today.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`,
    day_offset: 0,
  },
  {
    name: 'Overdue — gentle',
    subject: 'Friendly reminder — invoice overdue',
    body: `Hi {{client_name}},\n\nI wanted to follow up on invoice {{invoice_number}} for {{amount}}, which was due on {{due_date}}.\n\nCould you please arrange payment when you get a chance?\n\nThank you.`,
    day_offset: 3,
  },
  {
    name: 'Overdue — firm',
    subject: 'Final notice — invoice requires attention',
    body: `Hi {{client_name}},\n\nThis is a final notice regarding invoice {{invoice_number}} for {{amount}}, which is now significantly overdue.\n\nPlease arrange payment immediately.\n\nThank you.`,
    day_offset: 14,
  },
]

export const TEMPLATE_VARIABLES = ['{{client_name}}', '{{invoice_number}}', '{{amount}}', '{{due_date}}'] as const

export const DAY_OFFSET_PRESETS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30] as const
