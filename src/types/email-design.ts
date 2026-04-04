export type ButtonStyle = 'rounded' | 'pill' | 'square' | 'outlined'
export type LayoutStyle = 'classic' | 'minimal'
export type EmailFont = 'inter' | 'georgia' | 'mono'
export type EmailCardRadius = 'none' | 'sm' | 'md' | 'lg'
export type EmailDesignTemplate = 'plain' | 'styled'

export type EmailDesign = {
  // which visual style
  template: EmailDesignTemplate
  // branding (shared)
  brand_name: string
  logo_url: string
  // styled: layout
  header_bg: string
  header_text_color: string
  layout: LayoutStyle
  // styled: card
  card_bg: string
  card_radius: EmailCardRadius
  // styled: typography
  font: EmailFont
  heading_color: string
  body_text_color: string
  link_color: string
  // styled: button
  button_bg: string
  button_style: ButtonStyle
  button_text_color: string
  // styled: general
  body_bg: string
  show_invoice_box: boolean
  footer_text: string
}

export const DEFAULT_EMAIL_DESIGN: EmailDesign = {
  template: 'styled',
  brand_name: 'paynudge',
  logo_url: '',
  header_bg: '#0a0a0a',
  header_text_color: '#ffffff',
  layout: 'classic',
  card_bg: '#ffffff',
  card_radius: 'sm',
  font: 'inter',
  heading_color: '#111111',
  body_text_color: '#444444',
  link_color: '#888888',
  button_bg: '#0a0a0a',
  button_style: 'rounded',
  button_text_color: '#ffffff',
  body_bg: '#f4f4f4',
  show_invoice_box: true,
  footer_text: '',
}

export function resolveDesign(d: Partial<EmailDesign> | null | undefined): EmailDesign {
  return {
    template:          (d?.template          ?? DEFAULT_EMAIL_DESIGN.template) as EmailDesignTemplate,
    brand_name:        d?.brand_name        || DEFAULT_EMAIL_DESIGN.brand_name,
    logo_url:          d?.logo_url          ?? '',
    header_bg:         d?.header_bg         || DEFAULT_EMAIL_DESIGN.header_bg,
    header_text_color: d?.header_text_color || DEFAULT_EMAIL_DESIGN.header_text_color,
    layout:            d?.layout            || DEFAULT_EMAIL_DESIGN.layout,
    card_bg:           d?.card_bg           || DEFAULT_EMAIL_DESIGN.card_bg,
    card_radius:       d?.card_radius       ?? DEFAULT_EMAIL_DESIGN.card_radius,
    font:              d?.font              ?? DEFAULT_EMAIL_DESIGN.font,
    heading_color:     d?.heading_color     || DEFAULT_EMAIL_DESIGN.heading_color,
    body_text_color:   d?.body_text_color   || DEFAULT_EMAIL_DESIGN.body_text_color,
    link_color:        d?.link_color        || DEFAULT_EMAIL_DESIGN.link_color,
    button_bg:         d?.button_bg         || DEFAULT_EMAIL_DESIGN.button_bg,
    button_style:      d?.button_style      || DEFAULT_EMAIL_DESIGN.button_style,
    button_text_color: d?.button_text_color || DEFAULT_EMAIL_DESIGN.button_text_color,
    body_bg:           d?.body_bg           || DEFAULT_EMAIL_DESIGN.body_bg,
    show_invoice_box:  d?.show_invoice_box  ?? DEFAULT_EMAIL_DESIGN.show_invoice_box,
    footer_text:       d?.footer_text       ?? DEFAULT_EMAIL_DESIGN.footer_text,
  }
}
