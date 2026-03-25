export type Profile = {
  id: string
  email: string
  full_name: string | null
  sender_name: string | null
  plan: 'trial' | 'paid' | null
}
