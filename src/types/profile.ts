import type { EmailDesign } from './email-design'
import type { ThankYouPage } from './thank-you-page'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  sender_name: string | null
  plan: 'trial' | 'paid' | null
  email_design?: EmailDesign | null
  avatar_url?: string | null
  thank_you_page?: Partial<ThankYouPage> | null
}
