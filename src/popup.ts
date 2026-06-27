const logoEl = document.getElementById('logo') as HTMLImageElement
const dot = document.getElementById('dot') as HTMLDivElement
const statusText = document.getElementById('statusText') as HTMLSpanElement
const serverUrlEl = document.getElementById('serverUrl') as HTMLSpanElement
const chatIdEl = document.getElementById('chatId') as HTMLSpanElement
const detectedEl = document.getElementById('detected') as HTMLDivElement
const notDetectedEl = document.getElementById('notDetected') as HTMLDivElement
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement

const STATE_LABELS: Record<string, string> = {
  connected: 'متصل',
  connecting: 'جاري الاتصال…',
  disconnected: 'غير متصل',
  unavailable: 'غير متاح',
  failed: 'فشل الاتصال',
}

function applyTheme(primaryColor: string | null, fontFamily: string | null): void {
  const root = document.documentElement

  if (primaryColor) {
    root.style.setProperty('--theme-primary', primaryColor)
  }

  if (fontFamily) {
    // Load Google Font if it looks like one we know about
    const knownGoogleFonts: Record<string, string> = {
      'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic:wght@300;400;500;700',
      'DIN Next LT Arabic': null as unknown as string,
    }
    const url = knownGoogleFonts[fontFamily]
    if (url) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${url}&display=swap`
      document.head.appendChild(link)
    }
    root.style.setProperty('--theme-font', `"${fontFamily}", Tahoma, sans-serif`)
  }
}

let themeApplied = false

async function refresh(): Promise<void> {
  const s = await chrome.runtime.sendMessage({ type: 'INNO_STATUS' })
  const state: string = s?.state ?? 'disconnected'
  const chatId: number | null = s?.chatId ?? null
  const serverUrl: string = s?.serverUrl ?? ''
  const logoUrl: string | null = s?.logoUrl ?? null
  const primaryColor: string | null = s?.primaryColor ?? null
  const fontFamily: string | null = s?.fontFamily ?? null

  const detected = !!serverUrl
  detectedEl.style.display = detected ? 'block' : 'none'
  notDetectedEl.style.display = detected ? 'none' : 'block'

  if (!detected) return

  if (!themeApplied && (primaryColor || fontFamily)) {
    applyTheme(primaryColor, fontFamily)
    themeApplied = true
  }

  if (logoUrl && !logoEl.src.includes(logoUrl)) {
    logoEl.src = logoUrl
    logoEl.style.display = 'block'
  }

  dot.className = `dot ${state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : ''}`
  statusText.textContent = STATE_LABELS[state] ?? state
  serverUrlEl.textContent = new URL(serverUrl).hostname
  chatIdEl.textContent = chatId ? `#${chatId}` : 'لا يوجد'
}

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'INNO_DISCONNECT' })
  themeApplied = false
  await refresh()
})

refresh()
setInterval(refresh, 2000)
