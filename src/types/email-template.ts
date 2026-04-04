export type EmailTemplateType = 'reminder' | 'thank_you' | 'follow_up'

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  day_offset: number
  type: EmailTemplateType
  created_at: string
}
