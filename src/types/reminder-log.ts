export type ReminderLog = {
  id: string
  sent_at: string
  day_offset: number
  email_subject: string
  status: string
  client_name?: string | null
}
