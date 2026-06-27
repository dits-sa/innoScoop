const dot = document.getElementById('dot') as HTMLDivElement
const statusText = document.getElementById('statusText') as HTMLSpanElement
const serverUrlEl = document.getElementById('serverUrl') as HTMLSpanElement
const chatIdEl = document.getElementById('chatId') as HTMLSpanElement
const detectedEl = document.getElementById('detected') as HTMLDivElement
const notDetectedEl = document.getElementById('notDetected') as HTMLDivElement
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement

async function refresh(): Promise<void> {
  const s = await chrome.runtime.sendMessage({ type: 'INNO_STATUS' })
  const state: string = s?.state ?? 'disconnected'
  const chatId: number | null = s?.chatId ?? null
  const serverUrl: string = s?.serverUrl ?? ''

  const detected = !!serverUrl
  detectedEl.style.display = detected ? 'block' : 'none'
  notDetectedEl.style.display = detected ? 'none' : 'block'

  if (!detected) return

  dot.className = `dot ${state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : ''}`
  statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1)
  serverUrlEl.textContent = new URL(serverUrl).hostname
  chatIdEl.textContent = chatId ? `#${chatId}` : 'None'
}

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'INNO_DISCONNECT' })
  await refresh()
})

refresh()
setInterval(refresh, 2000)
