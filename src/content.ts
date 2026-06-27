// Relay Ably channel auth from background worker through the page (same-origin, no CORS)
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

// Listen for messages from the Innovation Platform page
// The main app calls: window.postMessage({ type: 'INNO_SCOOP_CHAT', chatId: 42 }, '*')
window.addEventListener('message', (event) => {
  if (event.source !== window || typeof event.data?.type !== 'string') return
  if (!event.data.type.startsWith('INNO_SCOOP_')) return

  if (event.data.type === 'INNO_SCOOP_CHAT') {
    chrome.runtime.sendMessage({ type: 'INNO_SUBSCRIBE', chatId: event.data.chatId as number })
  }
})
