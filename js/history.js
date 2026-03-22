// history.js — Session history management
import { t } from './i18n.js'
import { getState, setState } from './state.js'

const STORAGE_KEY = 'linxai_history'
const MAX_SESSIONS = 30

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function setHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function saveCurrentSession() {
  const { session, mode, sessionId } = getState()
  if (session.length === 0) return

  const history = getHistory()
  const title = session[0]?.content?.slice(0, 50) || 'Session'
  const now = new Date().toISOString()

  if (sessionId) {
    // Update existing
    const idx = history.findIndex(s => s.id === sessionId)
    if (idx !== -1) {
      history[idx].mensajes = session
      history[idx].titulo = title
    } else {
      history.unshift({
        id: sessionId,
        fecha: now,
        modo: mode,
        titulo: title,
        mensajes: session
      })
    }
  } else {
    // New session
    const id = 'ses-' + Date.now()
    setState({ sessionId: id })
    history.unshift({
      id,
      fecha: now,
      modo: mode,
      titulo: title,
      mensajes: session
    })
  }

  // Trim to max
  while (history.length > MAX_SESSIONS) {
    history.pop()
  }

  setHistory(history)
  renderHistorySidebar()
}

export function loadSessionById(id) {
  const history = getHistory()
  const session = history.find(s => s.id === id)
  if (!session) return null
  setState({
    session: session.mensajes,
    sessionId: session.id,
    mode: session.modo || 'chat'
  })
  return session
}

export function deleteSession(id) {
  let history = getHistory()
  history = history.filter(s => s.id !== id)
  setHistory(history)

  const { sessionId } = getState()
  if (sessionId === id) {
    setState({ session: [], sessionId: null })
  }

  renderHistorySidebar()
}

export function clearAllHistory() {
  setHistory([])
  setState({ session: [], sessionId: null })
  renderHistorySidebar()
}

export function startNewSession() {
  setState({ session: [], sessionId: null })
}

export function renderHistorySidebar() {
  const list = document.getElementById('history-list')
  if (!list) return

  const history = getHistory()
  list.innerHTML = ''

  if (history.length === 0) {
    list.innerHTML = `<div style="padding:var(--space-sm);font-size:12px;color:var(--text-tertiary);text-align:center">${t('history_empty')}</div>`
    return
  }

  const { sessionId } = getState()
  const groups = groupByDate(history)

  Object.keys(groups).forEach(groupKey => {
    const label = document.createElement('div')
    label.className = 'history-group-label'
    label.textContent = t(groupKey)
    list.appendChild(label)

    groups[groupKey].forEach(session => {
      const item = document.createElement('div')
      item.className = 'history-item' + (session.id === sessionId ? ' history-item--active' : '')

      const modeIcon = session.modo === 'terminal' ? '⌨️' : session.modo === 'guide' ? '📖' : '💬'

      item.innerHTML = `
        <span>${modeIcon}</span>
        <span class="history-item__title">${escapeHtml(session.titulo)}</span>
        <button class="history-item__delete btn-icon" title="Delete" aria-label="Delete session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `

      // Click to load
      item.addEventListener('click', (e) => {
        if (e.target.closest('.history-item__delete')) return
        window.dispatchEvent(new CustomEvent('linxai:load-session', { detail: session.id }))
      })

      // Delete
      item.querySelector('.history-item__delete').addEventListener('click', (e) => {
        e.stopPropagation()
        if (confirm(t('history_delete_confirm'))) {
          deleteSession(session.id)
        }
      })

      list.appendChild(item)
    })
  })
}

function groupByDate(sessions) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups = {}

  sessions.forEach(s => {
    const d = new Date(s.fecha)
    let key
    if (d >= today) key = 'today'
    else if (d >= yesterday) key = 'yesterday'
    else if (d >= weekAgo) key = 'this_week'
    else key = 'older'

    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })

  return groups
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
