interface ThemeSettings {
  fontFamily: string
  fontSize: number
  margins: number
  lineHeight: number
}

const STYLE_ID = 'foliate-theme'

export function injectTheme(doc: Document, settings: ThemeSettings) {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    doc.head?.appendChild(style)
  }
  style.textContent = css(settings)
}

export function updateAllThemes(
  settings: ThemeSettings,
  getContents: () => { doc?: Document }[]
) {
  for (const { doc } of getContents()) {
    if (doc) injectTheme(doc, settings)
  }
}

function css(s: ThemeSettings) {
  return `
    :root {
      --font-family: ${s.fontFamily};
      --font-size: ${s.fontSize}%;
      --margin: ${s.margins}px;
      --line-height: ${s.lineHeight};
    }
    body {
      font-family: var(--font-family) !important;
      font-size: var(--font-size) !important;
      line-height: var(--line-height) !important;
      padding: var(--margin) !important;
    }
  `
}
