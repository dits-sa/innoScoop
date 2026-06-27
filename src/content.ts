chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'INNO_AUTH') {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

    fetch(`${msg.serverUrl as string}/broadcasting/auth`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ socket_id: msg.socketId, channel_name: msg.channelName }),
    })
      .then((r) => r.json())
      .then((data) => reply(data))
      .catch((err) => reply({ error: String(err) }))

    return true
  }

  if (msg.type === 'INNO_POST') {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

    fetch(msg.url as string, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(msg.body),
    }).catch(() => {})
  }
})

interface InertiaTheme {
  colors?: Record<string, string>
  fonts?: { body?: { arabic?: string; english?: string } }
  logos?: Record<string, string | undefined>
}

function readThemeFromPage(origin: string): {
  logoUrl: string | null
  primaryColor: string | null
  fontFamily: string | null
} {
  try {
    const raw = document.getElementById('app')?.getAttribute('data-page')
    if (!raw) return { logoUrl: null, primaryColor: null, fontFamily: null }

    const page = JSON.parse(raw) as { props?: { theme?: InertiaTheme } }
    const theme = page.props?.theme
    if (!theme) return { logoUrl: null, primaryColor: null, fontFamily: null }

    const logoPath =
      theme.logos?.['shorthand_white'] ??
      theme.logos?.['shorthand-white'] ??
      theme.logos?.['shorthand'] ??
      null

    const logoUrl = logoPath
      ? logoPath.startsWith('http')
        ? logoPath
        : `${origin}${logoPath}`
      : null

    const primaryColor = theme.colors?.['primary'] ?? null
    const lang = document.documentElement.lang ?? 'ar'
    const fontFamily =
      (lang === 'ar' ? theme.fonts?.body?.arabic : theme.fonts?.body?.english) ?? null

    return { logoUrl, primaryColor, fontFamily }
  } catch {
    return { logoUrl: null, primaryColor: null, fontFamily: null }
  }
}

function sendInitFromMeta(): boolean {
  const raw = document.querySelector<HTMLMetaElement>('meta[name="inno-scoop-config"]')?.content
  if (!raw) return false
  try {
    const cfg = JSON.parse(raw) as {
      serverUrl: string
      ablyKey: string
      logoUrl: string | null
    }

    const theme = readThemeFromPage(cfg.serverUrl)

    chrome.runtime.sendMessage({
      type: 'INNO_INIT',
      serverUrl: cfg.serverUrl,
      ablyKey: cfg.ablyKey,
      logoUrl: cfg.logoUrl ?? theme.logoUrl,
      primaryColor: theme.primaryColor,
      fontFamily: theme.fontFamily,
    })
    return true
  } catch {
    return false
  }
}

// Track the last known chat so we can re-subscribe after a SW restart
let lastKnownChatId: number | null = null

function resubscribeIfNeeded(): void {
  if (lastKnownChatId != null) {
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'INNO_SUBSCRIBE', chatId: lastKnownChatId! }).catch(() => {})
    }, 2500)
  }
}

// Initial connection
sendInitFromMeta()

// Heartbeat: Chrome MV3 service workers are killed after ~30s of inactivity.
// Every 20s check if the SW still has a live connection; reinitialize if not.
setInterval(async () => {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'INNO_STATUS' })
    if (!status?.serverUrl) {
      // SW was killed and lost in-memory state — reinitialize
      if (sendInitFromMeta()) resubscribeIfNeeded()
    }
  } catch {
    // SW not running at all — sending a message will wake it, INNO_INIT reconnects
    if (sendInitFromMeta()) resubscribeIfNeeded()
  }
}, 20_000)

window.addEventListener('message', (event) => {
  if (event.source !== window || typeof event.data?.type !== 'string') return

  if (event.data.type === 'INNO_SCOOP_INIT') {
    const theme = readThemeFromPage(event.data.serverUrl as string)
    chrome.runtime.sendMessage({
      type: 'INNO_INIT',
      serverUrl: event.data.serverUrl as string,
      ablyKey: event.data.ablyKey as string,
      logoUrl: (event.data.logoUrl as string | null) ?? theme.logoUrl,
      primaryColor: theme.primaryColor,
      fontFamily: theme.fontFamily,
    })
  }

  if (event.data.type === 'INNO_SCOOP_CHAT') {
    lastKnownChatId = event.data.chatId as number
    chrome.runtime.sendMessage({ type: 'INNO_SUBSCRIBE', chatId: lastKnownChatId })
  }
})
