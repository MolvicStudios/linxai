// chat.js — Chat mode module
import { t } from './i18n.js'
import { getState, setState, subscribe } from './state.js'
import { askGroq, buildChatPrompt } from './groq.js'
import { saveCurrentSession } from './history.js'

const MAX_SESSION_MESSAGES = 50
let messagesContainer = null

export function initChat() {
  messagesContainer = document.getElementById('chat-messages')
  renderWelcome()
}

export function renderWelcome() {
  if (!messagesContainer) return
  const state = getState()
  // Only show welcome if session is empty
  if (state.session.length > 0) {
    renderAllMessages()
    return
  }
  messagesContainer.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome__icon">🐧</div>
      <h2 class="chat-welcome__title">${t('chat_welcome_title')}</h2>
      <p class="chat-welcome__body">${t('chat_welcome_body')}</p>
    </div>
  `
}

function renderAllMessages() {
  if (!messagesContainer) return
  const { session } = getState()
  messagesContainer.innerHTML = ''
  session.forEach(msg => {
    appendMessageBubble(msg.role, msg.content, msg.ts, false)
  })
  scrollToBottom()
}

export function loadSession(messages) {
  setState({ session: messages })
  renderAllMessages()
}

export async function sendChatMessage(text) {
  const state = getState()
  if (state.loading) return
  if (state.session.length >= MAX_SESSION_MESSAGES) {
    appendErrorMessage(t('error_api'))
    return
  }

  // Clear welcome if first message
  if (state.session.length === 0) {
    messagesContainer.innerHTML = ''
  }

  // Add user message
  const userMsg = { role: 'user', content: text, ts: Date.now() }
  const session = [...state.session, userMsg]
  setState({ session, loading: true })

  appendMessageBubble('user', text, userMsg.ts)
  showTyping()

  try {
    const systemPrompt = buildChatPrompt()
    const apiMessages = session.map(m => ({ role: m.role, content: m.content }))
    const reply = await askGroq(apiMessages, systemPrompt)

    removeTyping()

    const aiMsg = { role: 'assistant', content: reply, ts: Date.now() }
    const updatedSession = [...session, aiMsg]
    setState({ session: updatedSession, loading: false })

    appendMessageBubble('assistant', reply, aiMsg.ts)
    window.molvicTrack && window.molvicTrack('chat_message')
    saveCurrentSession()
  } catch (err) {
    removeTyping()
    setState({ loading: false })
    appendErrorMessage(t('error_api'))
    console.error('Chat error:', err)
  }
}

function appendMessageBubble(role, content, ts, animate = true) {
  const msgEl = document.createElement('div')
  msgEl.className = `msg msg--${role === 'user' ? 'user' : 'ai'}`
  if (!animate) msgEl.style.animation = 'none'

  const time = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (role === 'user') {
    msgEl.innerHTML = `
      <div class="msg__bubble">${escapeHtml(content)}</div>
      <div class="msg__meta">${time}</div>
    `
  } else {
    msgEl.innerHTML = `
      <div class="msg__avatar">🐧</div>
      <div class="msg__content">
        <div class="msg__bubble">${renderMarkdown(content)}</div>
        <div class="msg__meta">${time}</div>
      </div>
    `
  }

  messagesContainer.appendChild(msgEl)

  // Add copy buttons to code blocks
  msgEl.querySelectorAll('pre').forEach(pre => {
    if (!pre.querySelector('.btn-copy')) {
      const btn = document.createElement('button')
      btn.className = 'btn-copy'
      btn.textContent = t('copy')
      btn.addEventListener('click', () => handleCopy(btn, pre))
      pre.appendChild(btn)
    }
  })

  scrollToBottom()
}

function appendErrorMessage(text) {
  const msgEl = document.createElement('div')
  msgEl.className = 'msg msg--ai msg--error'
  msgEl.innerHTML = `
    <div class="msg__avatar">⚠️</div>
    <div class="msg__content">
      <div class="msg__bubble">${escapeHtml(text)}</div>
    </div>
  `
  messagesContainer.appendChild(msgEl)
  scrollToBottom()
}

function showTyping() {
  const el = document.createElement('div')
  el.className = 'msg msg--ai msg--typing'
  el.id = 'typing-indicator'
  el.innerHTML = `
    <div class="msg__avatar">🐧</div>
    <div class="msg__bubble">
      <span class="typing-dots"><span></span><span></span><span></span></span>
    </div>
  `
  messagesContainer.appendChild(el)
  scrollToBottom()
}

function removeTyping() {
  const el = document.getElementById('typing-indicator')
  if (el) el.remove()
}

function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }
}

function handleCopy(btn, pre) {
  const code = pre.querySelector('code')
  const text = code ? code.textContent : pre.textContent
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = t('copied')
    btn.classList.add('btn-copy--copied')
    setTimeout(() => {
      btn.textContent = t('copy')
      btn.classList.remove('btn-copy--copied')
    }, 2000)
  })
}

// ===== Basic Markdown renderer =====
function renderMarkdown(text) {
  let html = escapeHtml(text)

  // Code blocks: ```lang\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`
  })

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic: *text*
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p>')
  // Wrap in p if there's content
  if (!html.startsWith('<')) html = '<p>' + html + '</p>'
  // Single newlines to <br> (but not inside pre/code)
  html = html.replace(/(?<!<\/li>|<\/ul>|<\/ol>|<\/pre>|<\/code>)\n(?!<)/g, '<br>')

  return html
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
