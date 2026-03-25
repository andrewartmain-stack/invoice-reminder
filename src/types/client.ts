export type Client = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  avatar_url?: string | null
  created_at: string
}

export type ClientOption = {
  id: string
  name: string
  email: string
  avatar_url?: string | null
}
