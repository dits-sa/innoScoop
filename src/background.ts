import Pusher from 'pusher-js'

type Config = { serverUrl: string; ablyKey: string }

type BrowserCommand = {
  command_id: string
  type: 'snapshot' | 'click' | 'fill' | 'navigate' | 'read' | 'scroll'
  selector?: string
  value?: string
  url?: string
}

type AiChatEvent = { type: string } & BrowserCommand

let pusher: Pusher | null = null
let activeChannel: ReturnType<Pusher['subscribe']> | null = null
let cfg: Config | null = null
let activeChatId: number | null = null
let activeTabId: number | null = null

function buildPusher(config: Config): Pusher {
  return new Pusher(config.ablyKey, {
    wsHost: 'realtime-pusher.ably.io',
    httpHost: 'rest-pusher.ably.io',
    wsPort: 443,
    wssPort: 443,
    disableStats: true,
    encrypted: true,
    enabledTransports: ['ws', 'wss'],
    cluster: '',
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        if (activeTabId == null) {
          callback(new Error('No active tab'), null)
          return
        }
        chrome.tabs.sendMessage(
          activeTabId,
          { type: 'INNO_AUTH', channelName: channel.name, socketId, serverUrl: config.serverUrl },
          (response) => {
            if (chrome.runtime.lastError || response?.error) {
              callback(new Error(response?.error ?? 'Channel auth failed'), null)
            } else {
              callback(null, response)
            }
          },
        )
      },
    }),
  })
}

function connect(config: Config, tabId: number): void {
  if (pusher && cfg?.serverUrl === config.serverUrl && cfg?.ablyKey === config.ablyKey) return

  cfg = config
  activeTabId = tabId

  if (pusher) pusher.disconnect()
  pusher = buildPusher(cfg)
  void chrome.storage.local.set(cfg)
}

function subscribeToChat(chatId: number): void {
  if (!pusher || !cfg) return

  if (activeChannel) {
    activeChannel.unbind_all()
    pusher.unsubscribe(`private-ai-chat.${activeChatId}`)
  }

  activeChatId = chatId
  activeChannel = pusher.subscribe(`private-ai-chat.${chatId}`)

  activeChannel.bind('AiChatEvent', async (data: AiChatEvent) => {
    if (data.type !== 'browser_command') return
    const result = await runCommand(data)
    await relayResult(data.command_id, result)
  })
}

async function runCommand(cmd: BrowserCommand): Promise<unknown> {
  if (activeTabId == null) return { error: 'No active tab' }

  if (cmd.type === 'navigate' && cmd.url) {
    await chrome.tabs.update(activeTabId, { url: cmd.url })
    return { ok: true }
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: executeInPage,
      args: [cmd],
    })
    return result?.result ?? null
  } catch (err) {
    return { error: String(err) }
  }
}

async function relayResult(commandId: string, result: unknown): Promise<void> {
  if (!cfg || activeChatId == null || activeTabId == null) return

  chrome.tabs.sendMessage(activeTabId, {
    type: 'INNO_POST',
    url: `${cfg.serverUrl}/api/ai-chat/browser-result`,
    body: { chat_id: activeChatId, command_id: commandId, result },
  })
}

function executeInPage(cmd: BrowserCommand): unknown {
  if (cmd.type === 'snapshot') return captureSnapshot()

  const el = cmd.selector ? (document.querySelector(cmd.selector) as HTMLElement | null) : null

  if (cmd.type === 'click') {
    if (!el) return { error: `Not found: ${cmd.selector}` }
    el.click()
    return { ok: true }
  }

  if (cmd.type === 'fill' && cmd.value !== undefined) {
    if (!el) return { error: `Not found: ${cmd.selector}` }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, cmd.value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true }
  }

  if (cmd.type === 'read') {
    if (!el) return { error: `Not found: ${cmd.selector}` }
    return { value: (el as HTMLInputElement).value ?? el.textContent?.trim() }
  }

  if (cmd.type === 'scroll') {
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return { ok: true }
  }

  return { error: `Unknown command: ${cmd.type}` }

  function captureSnapshot(): string {
    const lines: string[] = [`url: ${location.href}`, `title: ${document.title}`, '']
    walk(document.body, 0)
    return lines.join('\n')

    function walk(node: Element, depth: number): void {
      const tag = node.tagName.toLowerCase()
      if (['script', 'style', 'svg', 'head', 'noscript'].includes(tag)) return

      const interactive =
        ['a', 'button', 'input', 'select', 'textarea'].includes(tag) || node.hasAttribute('role')

      if (interactive) {
        const role = node.getAttribute('role') ?? tag
        const label =
          node.getAttribute('aria-label') ??
          node.getAttribute('placeholder') ??
          node.getAttribute('title') ??
          node.textContent?.trim().slice(0, 100) ??
          ''
        const parts: string[] = [`${'  '.repeat(depth)}[${role}]`]
        if (node.id) parts.push(`#${node.id}`)
        const name = node.getAttribute('name')
        if (name) parts.push(`name="${name}"`)
        const type = node.getAttribute('type')
        if (type && type !== 'text') parts.push(`type="${type}"`)
        const href = (node as HTMLAnchorElement).href
        if (href) parts.push(`href="${new URL(href).pathname}"`)
        const val = (node as HTMLInputElement).value
        if (val) parts.push(`value="${val}"`)
        if (label) parts.push(`"${label}"`)
        lines.push(parts.join(' '))
      }

      for (const child of node.children) walk(child, depth + (interactive ? 1 : 0))
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  void handleMessage(msg, sender, reply)
  return true
})

async function handleMessage(
  msg: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  reply: (r: unknown) => void,
): Promise<void> {
  switch (msg.type) {
    case 'INNO_INIT': {
      // Auto-triggered when the Innovation Platform page loads
      const tabId = sender.tab?.id
      if (tabId == null) break
      connect(
        { serverUrl: msg.serverUrl as string, ablyKey: msg.ablyKey as string },
        tabId,
      )
      reply({ ok: true })
      break
    }
    case 'INNO_SUBSCRIBE': {
      subscribeToChat(msg.chatId as number)
      if (msg.tabId) activeTabId = msg.tabId as number
      reply({ ok: true })
      break
    }
    case 'INNO_STATUS': {
      reply({
        state: pusher?.connection.state ?? 'disconnected',
        chatId: activeChatId,
        serverUrl: cfg?.serverUrl,
      })
      break
    }
    case 'INNO_DISCONNECT': {
      pusher?.disconnect()
      pusher = null
      activeChannel = null
      activeChatId = null
      cfg = null
      await chrome.storage.local.clear()
      reply({ ok: true })
      break
    }
  }
}

chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(['serverUrl', 'ablyKey'])
  if (stored.serverUrl && stored.ablyKey) {
    cfg = stored as Config
    pusher = buildPusher(cfg)
  }
})
