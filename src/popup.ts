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

async function refresh(): Promise<void> {
  const s = await chrome.runtime.sendMessage({ type: 'INNO_STATUS' })
  const state: string = s?.state ?? 'disconnected'
  const chatId: number | null = s?.chatId ?? null
  const serverUrl: string = s?.serverUrl ?? ''
  const logoUrl: string | null = s?.logoUrl ?? null

  const detected = !!serverUrl
  detectedEl.style.display = detected ? 'block' : 'none'
  notDetectedEl.style.display = detected ? 'none' : 'block'

  if (!detected) return

  if (logoUrl) {
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
  await refresh()
})

refresh()
setInterval(refresh, 2000)
