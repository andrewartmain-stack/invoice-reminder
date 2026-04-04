import type { ThankYouPage } from '@/types/thank-you-page'

const LOGO_HEIGHT: Record<string, string> = { sm: '28px', md: '42px', lg: '60px' }
const CARD_RADIUS: Record<string, string> = { none: '0', sm: '8px', md: '14px', lg: '22px', xl: '32px' }
const CARD_SHADOW: Record<string, string> = {
  none: 'none',
  sm: '0 2px 8px rgba(0,0,0,0.07)',
  md: '0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.04)',
  lg: '0 8px 60px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.06)',
}
const FONT: Record<string, string> = {
  inter: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
}

function svgIcon(type: string, color: string): string {
  const stroke = `stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`
  const base = `width="28" height="28" viewBox="0 0 24 24" style="display:block;"`
  if (type === 'check')    return `<svg ${base} fill="none" ${stroke}><polyline points="20 6 9 17 4 12"/></svg>`
  if (type === 'heart')    return `<svg ${base} fill="${color}" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
  if (type === 'star')     return `<svg ${base} fill="${color}" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  if (type === 'sparkles') return `<svg ${base} fill="none" ${stroke}><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/><path d="M5 16l.75 2.25L8 19l-2.25.75L5 22l-.75-2.25L2 19l2.25-.75L5 16z"/></svg>`
  return ''
}

export function buildThankYouPage(config: ThankYouPage, logoUrl?: string | null): string {
  const font = FONT[config.font] || FONT.inter
  const cardRadius = CARD_RADIUS[config.card_radius] || CARD_RADIUS.lg
  const cardShadow = CARD_SHADOW[config.card_shadow] || CARD_SHADOW.md
  const logoH = LOGO_HEIGHT[config.logo_size] || LOGO_HEIGHT.md
  const iconColor = config.icon_style === 'outlined' ? config.accent_color : (config.icon_style === 'plain' ? config.accent_color : '#fff')
  const iconBg = config.icon_style === 'circle' ? config.accent_color
    : config.icon_style === 'outlined' ? 'transparent'
    : 'transparent'
  const iconBorder = config.icon_style === 'outlined' ? `2px solid ${config.accent_color}` : 'none'

  const logoHtml = config.show_logo && logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:${logoH};max-width:200px;object-fit:contain;margin:0 auto 28px;display:block;" />`
    : ''

  const iconHtml = config.icon_type !== 'none' ? `
    <div style="width:64px;height:64px;border-radius:50%;background:${iconBg};border:${iconBorder};display:flex;align-items:center;justify-content:center;margin:0 auto 28px;overflow:hidden;flex-shrink:0;">
      ${svgIcon(config.icon_type, iconColor)}
    </div>` : ''

  const bgStyle = config.bg_type === 'image' && config.bg_image_url
    ? `background: url('${config.bg_image_url}') center/cover no-repeat; background-color: ${config.bg_color};`
    : `background: ${config.bg_color};`

  const cardBorder = config.card_border ? `1px solid rgba(0,0,0,0.08)` : 'none'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment confirmed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      ${bgStyle}
      font-family: ${font};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: ${config.card_bg};
      border-radius: ${cardRadius};
      padding: 52px 44px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: ${cardShadow};
      border: ${cardBorder};
    }
    h1 {
      font-size: 23px;
      font-weight: 700;
      color: ${config.heading_color};
      margin: 0 0 14px;
      line-height: 1.3;
      letter-spacing: -0.3px;
    }
    p {
      font-size: 15px;
      color: ${config.text_color};
      line-height: 1.65;
    }
  </style>
</head>
<body>
  <div class="card">
    ${logoHtml}
    ${iconHtml}
    <h1>${config.heading}</h1>
    <p>${config.message}</p>
  </div>
</body>
</html>`
}
