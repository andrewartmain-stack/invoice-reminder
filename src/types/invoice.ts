export type InvoiceStatus = 'pending' | 'notified' | 'payment_reported' | 'paid' | 'cancelled'

export type Invoice = {
  id: string
  client_name: string
  client_email: string
  amount: number
  currency: string
  invoice_number: string | null
  due_date: string
  status: InvoiceStatus
  reminder_preset: string
  stripe_payment_link: string | null
  invoice_file_url: string | null
  created_at: string
}
