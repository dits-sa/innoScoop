const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const ablyKeyInput = document.getElementById('ablyKey') as HTMLInputElement
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement
const dot = document.getElementById('dot') as HTMLDivElement
const statusText = document.getElementById('statusText') as HTMLSpanElement
const chatTag = document.getElementById('chatTag') as HTMLSpanElement

async function refresh(): Promise<void> {
  const s = await chrome.runtime.sendMessage({ type: 'INNO_STATUS' })
  const state: string = s?.state ?? 'disconnected'
  const chatId: number | null = s?.chatId ?? null
  const serverUrl: string = s?.serverUrl ?? ''

  dot.className = `dot ${state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : ''}`
  statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1)

  chatTag.style.display = chatId ? 'inline' : 'none'
  chatTag.textContent = chatId ? `Chat #${chatId}` : ''

  if (serverUrl && !serverUrlInput.value) serverUrlInput.value = serverUrl

  const connected = state === 'connected'
  connectBtn.style.display = connected ? 'none' : 'block'
  disconnectBtn.style.display = connected ? 'block' : 'none'
}

// Restore stored config
chrome.storage.local.get(['serverUrl', 'ablyKey']).then((s) => {
  if (s.serverUrl) serverUrlInput.value = s.serverUrl as string
  if (s.ablyKey) ablyKeyInput.value = s.ablyKey as string
})

connectBtn.addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim()
  const ablyKey = ablyKeyInput.value.trim()
  if (!serverUrl || !ablyKey) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  connectBtn.disabled = true
  statusText.textContent = 'Connecting…'
  dot.className = 'dot connecting'

  await chrome.runtime.sendMessage({ type: 'INNO_CONNECT', serverUrl, ablyKey, tabId: tab?.id })
  connectBtn.disabled = false
  await refresh()
})

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'INNO_DISCONNECT' })
  await refresh()
})

refresh()
setInterval(refresh, 2000)
