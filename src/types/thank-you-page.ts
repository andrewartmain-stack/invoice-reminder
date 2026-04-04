export type IconType = 'check' | 'heart' | 'star' | 'sparkles' | 'none'
export type IconStyle = 'circle' | 'outlined' | 'plain'
export type CardRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl'
export type CardShadow = 'none' | 'sm' | 'md' | 'lg'
export type FontFamily = 'inter' | 'serif' | 'mono'
export type LogoSize = 'sm' | 'md' | 'lg'
export type BgType = 'color' | 'image'

export type ThankYouPage = {
  // Content
  heading: string
  message: string

  // Logo
  show_logo: boolean
  logo_size: LogoSize

  // Icon
  icon_type: IconType
  icon_style: IconStyle

  // Background
  bg_type: BgType
  bg_color: string
  bg_image_url: string

  // Card
  card_bg: string
  card_radius: CardRadius
  card_shadow: CardShadow
  card_border: boolean

  // Typography
  heading_color: string
  text_color: string
  font: FontFamily

  // Accent
  accent_color: string
}

export const DEFAULT_THANK_YOU_PAGE: ThankYouPage = {
  heading: 'Thank you for your payment!',
  message: "We've let the sender know your payment is on the way.",
  show_logo: true,
  logo_size: 'md',
  icon_type: 'check',
  icon_style: 'circle',
  bg_type: 'color',
  bg_color: '#f4f4f4',
  bg_image_url: '',
  card_bg: '#ffffff',
  card_radius: 'lg',
  card_shadow: 'md',
  card_border: false,
  heading_color: '#111111',
  text_color: '#666666',
  font: 'inter',
  accent_color: '#22c55e',
}

export function resolveThankYouPage(d: Partial<ThankYouPage> | null | undefined): ThankYouPage {
  return { ...DEFAULT_THANK_YOU_PAGE, ...(d ?? {}) }
}
