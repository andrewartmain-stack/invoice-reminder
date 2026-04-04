import type { EmailDesign } from '@/types/email-design'
import { resolveDesign } from '@/types/email-design'

// ─── Style helpers ────────────────────────────────────────────

function emailFont(f: EmailDesign['font']): string {
  const m: Record<string, string> = {
    inter:   "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    georgia: "Georgia, 'Times New Roman', serif",
    mono:    "'Courier New', Courier, monospace",
  }
  return m[f] || m.inter
}

function cardRadius(r: EmailDesign['card_radius']): string {
  const m: Record<string, string> = { none: '0', sm: '8px', md: '14px', lg: '22px' }
  return m[r] || '8px'
}

function btnRadius(style: EmailDesign['button_style']): string {
  if (style === 'pill')   return '50px'
  if (style === 'square') return '2px'
  return '6px'
}

function headerHtml(design: EmailDesign): string {
  if (design.logo_url) {
    return `<img src="${design.logo_url}" alt="${design.brand_name}" style="height:32px;max-width:200px;object-fit:contain;display:block;">`
  }
  const color = design.layout === 'minimal' ? '#111' : design.header_text_color
  return `<span style="color:${color};font-size:16px;font-weight:700;letter-spacing:-0.5px;">${design.brand_name}</span>`
}

function btnCss(design: EmailDesign): string {
  const radius = btnRadius(design.button_style)
  if (design.button_style === 'outlined') {
    return `display:inline-block;background:transparent;color:${design.button_bg};text-decoration:none;padding:13px 32px;border-radius:${radius};font-size:13px;font-weight:600;border:2px solid ${design.button_bg};`
  }
  return `display:inline-block;background:${design.button_bg};color:${design.button_text_color};text-decoration:none;padding:14px 32px;border-radius:${radius};font-size:13px;font-weight:600;`
}

// ─── Styled shell (table-based) ───────────────────────────────

function shell(body: string, footer: string, design: EmailDesign): string {
  const font = emailFont(design.font)
  const cr = cardRadius(design.card_radius)
  const fg = design.footer_text || footer
  const footerRow = fg
    ? `<tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;"><p style="margin:0;color:#bbb;font-size:11px;line-height:1.6;">${fg}</p></td></tr>`
    : ''

  if (design.layout === 'minimal') {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${design.body_bg};font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${design.body_bg};padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:${design.card_bg};border-radius:${cr};overflow:hidden;border:1px solid #e0e0e0;">
      <tr><td style="padding:24px 32px;">${headerHtml(design)}</td></tr>
      <tr><td style="padding:24px 32px 32px;border-top:1px solid #f0f0f0;">${body}</td></tr>
      ${footerRow}
    </table>
  </td></tr>
</table>
</body>
</html>`.trim()
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${design.body_bg};font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${design.body_bg};padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:${design.card_bg};border-radius:${cr};overflow:hidden;">
      <tr><td style="background:${design.header_bg};padding:24px 32px;">${headerHtml(design)}</td></tr>
      <tr><td style="padding:32px;">${body}</td></tr>
      ${footerRow}
    </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

// ─── Plain text shell ─────────────────────────────────────────

function plainShell(body: string, footer: string, design: EmailDesign): string {
  const font = emailFont(design.font)
  const fg = design.footer_text || footer
  const footerHtml = fg
    ? `<p style="margin:32px 0 0;padding-top:18px;border-top:1px solid #e5e5e5;font-size:12px;color:#999;line-height:1.6;">${fg}</p>`
    : ''
  const logoHtml = design.logo_url
    ? `<img src="${design.logo_url}" alt="${design.brand_name}" style="height:28px;max-width:160px;object-fit:contain;display:block;margin-bottom:28px;">`
    : `<p style="margin:0 0 28px;font-size:14px;font-weight:700;color:#111;">${design.brand_name}</p>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 32px 40px;">
        ${logoHtml}
        ${body}
        ${footerHtml}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

// ─── Invoice detail box ───────────────────────────────────────

function invoiceBox(
  invoice_number: string | undefined,
  formattedDate: string | undefined,
  formattedAmount: string | undefined,
  design: EmailDesign,
): string {
  if (!design.show_invoice_box) return ''
  if (!formattedAmount && !formattedDate) return ''

  if (design.template === 'plain') {
    const lines = [
      invoice_number ? `Invoice: <strong>#${invoice_number}</strong>` : '',
      formattedDate  ? `Due: ${formattedDate}` : '',
      formattedAmount ? `Amount: <strong>${formattedAmount}</strong>` : '',
    ].filter(Boolean).join('<br>')
    return `<p style="margin:0 0 24px;font-size:13px;line-height:2.2;color:${design.body_text_color};padding:12px 16px;border-left:3px solid #ddd;">${lines}</p>`
  }

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;margin:20px 0 24px;">
  <tr><td style="padding:20px 24px;">
    ${invoice_number ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice</td><td align="right" style="color:#111;font-size:13px;">#${invoice_number}</td></tr></table>` : ''}
    ${formattedDate ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr><td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Due date</td><td align="right" style="color:#111;font-size:13px;">${formattedDate}</td></tr></table>` : ''}
    ${formattedAmount ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;padding-top:12px;margin-top:4px;"><tr><td style="color:#111;font-size:13px;font-weight:600;">Amount due</td><td align="right" style="color:#111;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${formattedAmount}</td></tr></table>` : ''}
  </td></tr>
</table>`
}

// ─── Pay button + reported link ───────────────────────────────

function payActions(stripe_payment_link: string | undefined, reportUrl: string, design: EmailDesign): string {
  if (design.template === 'plain') {
    return `${stripe_payment_link ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
  <tr><td>
    <a href="${stripe_payment_link}" style="color:${design.button_bg};font-size:14px;font-weight:600;text-decoration:none;">→ Pay now</a>
  </td></tr>
</table>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
  <tr><td>
    <a href="${reportUrl}" style="color:${design.link_color};font-size:13px;text-decoration:underline;">I've already sent the payment</a>
  </td></tr>
</table>`
  }

  const css = btnCss(design)
  return `${stripe_payment_link ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td align="center">
  <a href="${stripe_payment_link}" style="${css}">Pay now</a>
</td></tr></table>` : ''}
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <a href="${reportUrl}" style="color:${design.link_color};font-size:12px;text-decoration:underline;">I've already sent the payment</a>
</td></tr></table>`
}

// ─── Public builders ──────────────────────────────────────────

export function buildReminderEmail({
  client_name, formattedAmount, formattedDate, invoice_number, day_offset,
  stripe_payment_link, invoice_id, freelancer_email, sender_name, rawDesign,
}: {
  client_name: string
  formattedAmount: string
  formattedDate: string
  invoice_number?: string
  day_offset: number
  stripe_payment_link?: string
  invoice_id: string
  freelancer_email: string
  sender_name?: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`
  const tone =
    day_offset === 0
      ? 'This is a friendly reminder that your payment is due today.'
      : day_offset <= 3
        ? 'I wanted to follow up on the invoice below, which is now past due.'
        : day_offset <= 7
          ? "I'm reaching out again regarding the outstanding invoice. Could you please arrange payment at your earliest convenience?"
          : 'This is a final notice regarding the unpaid invoice. Please arrange payment immediately to avoid further action.'

  const body = `
<p style="margin:0 0 16px;color:${design.heading_color};font-size:15px;">Hi ${client_name},</p>
<p style="margin:0 0 28px;color:${design.body_text_color};font-size:14px;line-height:1.6;">${tone}</p>
${invoiceBox(invoice_number, formattedDate, formattedAmount, design)}
${payActions(stripe_payment_link, reportUrl, design)}
${sender_name ? `<p style="margin:24px 0 0;color:#888;font-size:13px;">— ${sender_name}</p>` : ''}`

  const footer = `Questions? Reply to this email or contact <a href="mailto:${freelancer_email}" style="color:${design.link_color};">${freelancer_email}</a>`
  return design.template === 'plain'
    ? plainShell(body, footer, design)
    : shell(body, footer, design)
}

export function buildTemplateEmail({
  bodyText, invoice_number, formattedAmount, formattedDate,
  stripe_payment_link, invoice_id, freelancer_email, rawDesign,
}: {
  bodyText: string
  invoice_number?: string
  formattedAmount?: string
  formattedDate?: string
  stripe_payment_link?: string
  invoice_id: string
  freelancer_email: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reportUrl = `${appUrl}/api/payment-reported?invoice_id=${invoice_id}`
  const htmlBody = bodyText
    .split('\n')
    .map(line =>
      line.trim() === ''
        ? '<br/>'
        : `<p style="margin:0 0 12px;color:${design.body_text_color};font-size:14px;line-height:1.6;">${line}</p>`
    )
    .join('\n')
  const body = `${htmlBody}${invoiceBox(invoice_number, formattedDate, formattedAmount, design)}${payActions(stripe_payment_link, reportUrl, design)}`
  const footer = `Questions? Reply to this email or contact <a href="mailto:${freelancer_email}" style="color:${design.link_color};">${freelancer_email}</a>`
  return design.template === 'plain'
    ? plainShell(body, footer, design)
    : shell(body, footer, design)
}

export function buildFollowupEmail({
  client_name, inv, formattedAmount, days_since_report, invoice_id, rawDesign,
}: {
  client_name: string
  inv: string
  formattedAmount: string
  days_since_report: number
  invoice_id: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (design.template === 'plain') {
    const body = `
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:${design.heading_color};">${client_name} reported sending payment ${days_since_report} days ago.</p>
<p style="margin:0 0 24px;font-size:14px;color:${design.body_text_color};line-height:1.6;">Invoice${inv} for <strong>${formattedAmount}</strong> is still marked as unconfirmed. Please check your bank account and confirm.</p>
<p style="margin:0;"><a href="${appUrl}/invoices/${invoice_id}" style="color:${design.button_bg};font-size:14px;font-weight:600;text-decoration:none;">→ Review &amp; confirm payment</a></p>`
    return plainShell(body, "If payment hasn't arrived, resume reminders from the invoice page.", design)
  }

  const css = btnCss(design)
  const body = `
<p style="margin:0 0 8px;color:${design.heading_color};font-size:15px;font-weight:600;">${client_name} reported sending payment ${days_since_report} days ago.</p>
<p style="margin:0 0 28px;color:${design.body_text_color};font-size:14px;line-height:1.6;">Invoice${inv} for <strong>${formattedAmount}</strong> is still marked as unconfirmed. Please check your bank account and confirm.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td align="center">
  <a href="${appUrl}/invoices/${invoice_id}" style="${css}">Review &amp; confirm payment</a>
</td></tr></table>
<p style="margin:0;color:#bbb;font-size:11px;text-align:center;">If payment hasn't arrived, you can resume reminders from the invoice page.</p>`
  return shell(body, '', design)
}

export function buildThankYouEmail({
  client_name, inv, formattedAmount, sender_name, rawDesign,
}: {
  client_name: string
  inv: string
  formattedAmount: string
  sender_name?: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const body = `
<p style="margin:0 0 16px;color:${design.heading_color};font-size:15px;">Hi ${client_name},</p>
<p style="margin:0 0 20px;color:${design.body_text_color};font-size:14px;line-height:1.6;">Thank you for settling invoice${inv} for <strong>${formattedAmount}</strong>. Your payment has been received and everything is in order.</p>
<p style="margin:0;color:${design.body_text_color};font-size:14px;line-height:1.6;">It's a pleasure working with you.</p>
${sender_name ? `<p style="margin:24px 0 0;color:#888;font-size:13px;">— ${sender_name}</p>` : ''}`
  return design.template === 'plain'
    ? plainShell(body, '', design)
    : shell(body, '', design)
}

export function buildThankYouFromTemplate({
  bodyText, rawDesign,
}: {
  bodyText: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const htmlBody = bodyText
    .split('\n')
    .map(line =>
      line.trim() === '' ? '<br/>' : `<p style="margin:0 0 12px;color:${design.body_text_color};font-size:14px;line-height:1.6;">${line}</p>`
    )
    .join('\n')
  return design.template === 'plain'
    ? plainShell(htmlBody, '', design)
    : shell(htmlBody, '', design)
}

export function buildFollowupFromTemplate({
  bodyText, invoice_id, rawDesign,
}: {
  bodyText: string
  invoice_id: string
  rawDesign?: Partial<EmailDesign> | null
}): string {
  const design = resolveDesign(rawDesign)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const htmlBody = bodyText
    .split('\n')
    .map(line =>
      line.trim() === '' ? '<br/>' : `<p style="margin:0 0 12px;color:${design.body_text_color};font-size:14px;line-height:1.6;">${line}</p>`
    )
    .join('\n')

  if (design.template === 'plain') {
    const body = `${htmlBody}
<p style="margin:16px 0 0;"><a href="${appUrl}/invoices/${invoice_id}" style="color:${design.button_bg};font-size:14px;font-weight:600;text-decoration:none;">→ Review invoice</a></p>`
    return plainShell(body, '', design)
  }

  const css = btnCss(design)
  const body = `${htmlBody}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center">
  <a href="${appUrl}/invoices/${invoice_id}" style="${css}">Review invoice</a>
</td></tr></table>`
  return shell(body, '', design)
}

// ─── Preview (used by email design editor) ────────────────────

export function buildPreviewEmail(design: EmailDesign): string {
  if (design.template === 'plain') {
    const body = `
<p style="margin:0 0 16px;color:${design.heading_color};font-size:15px;">Hi Jane,</p>
<p style="margin:0 0 24px;color:${design.body_text_color};font-size:14px;line-height:1.6;">This is a friendly reminder that your invoice is due today.</p>
${design.show_invoice_box ? `<p style="margin:0 0 24px;font-size:13px;line-height:2.2;color:${design.body_text_color};padding:12px 16px;border-left:3px solid #ddd;">Invoice: <strong>#INV-001</strong><br>Due: April 15, 2026<br>Amount: <strong>USD 1,250.00</strong></p>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td><a href="#" style="color:${design.button_bg};font-size:14px;font-weight:600;text-decoration:none;">→ Pay now</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td><a href="#" style="color:${design.link_color};font-size:13px;text-decoration:underline;">I've already sent the payment</a></td></tr></table>`
    return plainShell(body, design.footer_text || 'Questions? Reply to this email.', design)
  }

  const css = btnCss(design)
  const body = `
<p style="margin:0 0 16px;color:${design.heading_color};font-size:15px;">Hi Jane,</p>
<p style="margin:0 0 28px;color:${design.body_text_color};font-size:14px;line-height:1.6;">This is a friendly reminder that your invoice is due today.</p>
${design.show_invoice_box ? invoiceBox('INV-001', 'April 15, 2026', 'USD 1,250.00', design) : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td align="center">
  <a href="#" style="${css}">Pay now</a>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <a href="#" style="color:${design.link_color};font-size:12px;text-decoration:underline;">I've already sent the payment</a>
</td></tr></table>`
  return shell(body, design.footer_text || 'Questions? Reply to this email.', design)
}
