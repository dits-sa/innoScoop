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

function sendInitFromMeta(): boolean {
  const raw = document.querySelector<HTMLMetaElement>('meta[name="inno-scoop-config"]')?.content
  if (!raw) return false
  try {
    const cfg = JSON.parse(raw) as { serverUrl: string; ablyKey: string; logoUrl: string | null }
    chrome.runtime.sendMessage({
      type: 'INNO_INIT',
      serverUrl: cfg.serverUrl,
      ablyKey: cfg.ablyKey,
      logoUrl: cfg.logoUrl ?? null,
    })
    return true
  } catch {
    return false
  }
}

// Read config from meta tag written by bootstrap.ts (handles document_idle timing)
sendInitFromMeta()

window.addEventListener('message', (event) => {
  if (event.source !== window || typeof event.data?.type !== 'string') return

  if (event.data.type === 'INNO_SCOOP_INIT') {
    chrome.runtime.sendMessage({
      type: 'INNO_INIT',
      serverUrl: event.data.serverUrl as string,
      ablyKey: event.data.ablyKey as string,
      logoUrl: (event.data.logoUrl as string | null) ?? null,
    })
  }

  if (event.data.type === 'INNO_SCOOP_CHAT') {
    chrome.runtime.sendMessage({ type: 'INNO_SUBSCRIBE', chatId: event.data.chatId as number })
  }
})
