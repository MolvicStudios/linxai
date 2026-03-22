// terminal.js — Terminal NL→CMD mode
import { t } from './i18n.js'
import { getState, setState } from './state.js'
import { askGroq, buildTerminalPrompt } from './groq.js'

let resultsContainer = null

export function initTerminal() {
  resultsContainer = document.getElementById('terminal-results')
  renderEmpty()
}

export function renderEmpty() {
  if (!resultsContainer) return
  const { terminalHistory } = getState()
  resultsContainer.innerHTML = ''

  const empty = document.createElement('div')
  empty.className = 'terminal-empty'
  empty.innerHTML = `
    <div class="terminal-empty__icon">⌨️</div>
    <p class="terminal-empty__text">${t('terminal_empty')}</p>
  `
  resultsContainer.appendChild(empty)

  if (terminalHistory.length > 0) {
    renderHistoryList()
  }
}

export async function sendTerminalQuery(text) {
  const state = getState()
  if (state.loading) return

  setState({ loading: true })

  // Remove empty state if present
  const emptyEl = resultsContainer.querySelector('.terminal-empty')
  if (emptyEl) emptyEl.remove()

  // Show typing
  showTyping()

  try {
    const systemPrompt = buildTerminalPrompt()
    const messages = [{ role: 'user', content: text }]
    const reply = await askGroq(messages, systemPrompt)

    removeTyping()

    // Parse JSON response
    const parsed = parseTerminalResponse(reply)
    if (!parsed) {
      appendError(t('error_parse'))
      setState({ loading: false })
      return
    }

    // If dangerous, show warning first
    if (parsed.peligroso) {
      renderDangerWarning(parsed, text)
    } else {
      renderResultCard(parsed, text)
    }

    // Add to terminal history
    addToHistory(parsed.comando)

    setState({ loading: false })
  } catch (err) {
    removeTyping()
    appendError(t('error_api'))
    setState({ loading: false })
    console.error('Terminal error:', err)
  }
}

function parseTerminalResponse(text) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.comando) return null
    return {
      comando: parsed.comando,
      explicacion: parsed.explicacion || '',
      partes: Array.isArray(parsed.partes) ? parsed.partes : [],
      peligroso: !!parsed.peligroso,
      razon_peligro: parsed.razon_peligro || ''
    }
  } catch {
    return null
  }
}

function renderResultCard(data, query) {
  const card = document.createElement('div')
  card.className = 'terminal-card'

  // Query
  const queryEl = document.createElement('div')
  queryEl.className = 'terminal-card__query'
  queryEl.textContent = query
  card.appendChild(queryEl)

  // Command
  const cmdEl = document.createElement('div')
  cmdEl.className = 'terminal-card__cmd'
  cmdEl.innerHTML = `
    <span class="terminal-card__cmd-prefix">$</span>
    <span class="terminal-card__cmd-text">${escapeHtml(data.comando)}</span>
    <button class="terminal-card__cmd-copy">${t('copy')}</button>
  `
  const copyBtn = cmdEl.querySelector('.terminal-card__cmd-copy')
  copyBtn.addEventListener('click', () => handleCopy(copyBtn, data.comando))
  card.appendChild(cmdEl)

  // Explanation
  if (data.explicacion) {
    const explainEl = document.createElement('div')
    explainEl.className = 'terminal-card__explain'
    explainEl.textContent = data.explicacion
    card.appendChild(explainEl)
  }

  // Breakdown
  if (data.partes.length > 0) {
    const breakdown = document.createElement('div')
    breakdown.className = 'terminal-card__breakdown'
    breakdown.innerHTML = `<div class="terminal-card__breakdown-title">${t('terminal_breakdown')}</div>`
    const parts = document.createElement('div')
    parts.className = 'terminal-card__parts'
    data.partes.forEach(p => {
      parts.innerHTML += `
        <div class="terminal-part">
          <span class="terminal-part__cmd">${escapeHtml(p.parte)}</span>
          <span class="terminal-part__sep">→</span>
          <span class="terminal-part__desc">${escapeHtml(p.significado)}</span>
        </div>
      `
    })
    breakdown.appendChild(parts)
    card.appendChild(breakdown)
  }

  resultsContainer.appendChild(card)
  resultsContainer.scrollTop = resultsContainer.scrollHeight
}

function renderDangerWarning(data, query) {
  const warning = document.createElement('div')
  warning.className = 'terminal-danger'
  warning.innerHTML = `
    <div class="terminal-danger__icon">⚠️</div>
    <div class="terminal-danger__title">${t('danger_title')}</div>
    <div class="terminal-danger__reason">${escapeHtml(data.razon_peligro || t('danger_body'))}</div>
    <div class="terminal-danger__actions">
      <button class="terminal-danger__btn terminal-danger__btn--confirm">${t('danger_confirm')}</button>
      <button class="terminal-danger__btn terminal-danger__btn--cancel">${t('cancel')}</button>
    </div>
  `

  const confirmBtn = warning.querySelector('.terminal-danger__btn--confirm')
  const cancelBtn = warning.querySelector('.terminal-danger__btn--cancel')

  confirmBtn.addEventListener('click', () => {
    warning.remove()
    renderResultCard(data, query)
  })

  cancelBtn.addEventListener('click', () => {
    warning.remove()
  })

  resultsContainer.appendChild(warning)
  resultsContainer.scrollTop = resultsContainer.scrollHeight
}

function addToHistory(cmd) {
  const { terminalHistory } = getState()
  const updated = [cmd, ...terminalHistory.filter(c => c !== cmd)].slice(0, 20)
  setState({ terminalHistory: updated })
  // Re-render history if visible
  renderHistoryList()
}

function renderHistoryList() {
  // Remove existing history block
  const existing = resultsContainer.querySelector('.terminal-history')
  if (existing) existing.remove()

  const { terminalHistory } = getState()
  if (terminalHistory.length === 0) return

  const section = document.createElement('div')
  section.className = 'terminal-history'
  section.innerHTML = `<div class="terminal-history__title">${t('terminal_history')}</div>`

  const list = document.createElement('div')
  list.className = 'terminal-history__list'

  terminalHistory.forEach(cmd => {
    const item = document.createElement('div')
    item.className = 'terminal-history__item'
    item.textContent = cmd
    item.addEventListener('click', () => {
      navigator.clipboard.writeText(cmd)
    })
    list.appendChild(item)
  })

  section.appendChild(list)
  resultsContainer.appendChild(section)
}

function showTyping() {
  const el = document.createElement('div')
  el.className = 'terminal-typing'
  el.id = 'terminal-typing'
  el.innerHTML = `
    <span class="typing-dots"><span></span><span></span><span></span></span>
    <span>${t('thinking')}</span>
  `
  resultsContainer.appendChild(el)
  resultsContainer.scrollTop = resultsContainer.scrollHeight
}

function removeTyping() {
  const el = document.getElementById('terminal-typing')
  if (el) el.remove()
}

function appendError(text) {
  const el = document.createElement('div')
  el.className = 'terminal-danger'
  el.style.borderColor = 'rgba(255,79,79,0.2)'
  el.innerHTML = `<div class="terminal-danger__reason">${escapeHtml(text)}</div>`
  resultsContainer.appendChild(el)
}

function handleCopy(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = t('copied')
    btn.classList.add('terminal-card__cmd-copy--copied')
    setTimeout(() => {
      btn.textContent = t('copy')
      btn.classList.remove('terminal-card__cmd-copy--copied')
    }, 2000)
  })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
