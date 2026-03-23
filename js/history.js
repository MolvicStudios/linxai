// history.js — Session history management (v2: auto-titles, search, export)
import { t } from './i18n.js'
import { getState, setState } from './state.js'
import { askGroq } from './groq.js'

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

async function generarTituloSesion(primerMensaje) {
  try {
    const systemPrompt = 'Genera un título corto (máximo 5 palabras) para esta conversación sobre Linux. Solo el título, sin comillas ni puntuación.'
    const titulo = await askGroq([{ role: 'user', content: primerMensaje }], systemPrompt)
    return titulo.trim().slice(0, 50)
  } catch {
    return primerMensaje.slice(0, 50)
  }
}

export async function saveCurrentSession() {
  const { session, mode, sessionId } = getState()
  if (session.length === 0) return

  const history = getHistory()
  const now = new Date().toISOString()
  const primerMensaje = session[0]?.content || 'Session'

  if (sessionId) {
    const idx = history.findIndex(s => s.id === sessionId)
    if (idx !== -1) {
      history[idx].mensajes = session
      // Generate title if it's still the first save (no auto-title yet)
      if (!history[idx].autoTitle && session.length >= 2) {
        history[idx].titulo = await generarTituloSesion(primerMensaje)
        history[idx].autoTitle = true
      }
    } else {
      const titulo = session.length >= 2
        ? await generarTituloSesion(primerMensaje)
        : primerMensaje.slice(0, 50)
      history.unshift({
        id: sessionId,
        fecha: now,
        modo: mode,
        titulo,
        autoTitle: session.length >= 2,
        mensajes: session
      })
    }
  } else {
    const id = 'ses-' + Date.now()
    setState({ sessionId: id })
    const titulo = session.length >= 2
      ? await generarTituloSesion(primerMensaje)
      : primerMensaje.slice(0, 50)
    history.unshift({
      id,
      fecha: now,
      modo: mode,
      titulo,
      autoTitle: session.length >= 2,
      mensajes: session
    })
  }

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

export function buscarEnHistorial(query) {
  const sesiones = getHistory()
  const q = query.toLowerCase()
  return sesiones.filter(s =>
    s.titulo?.toLowerCase().includes(q) ||
    s.mensajes.some(m => m.content.toLowerCase().includes(q))
  )
}

export function exportarSesion(sesionId) {
  const sesiones = getHistory()
  const sesion = sesiones.find(s => s.id === sesionId)
  if (!sesion) return

  let contenido = `# ${sesion.titulo}\n_${sesion.fecha}_\n\n`
  sesion.mensajes.forEach(m => {
    const quien = m.role === 'user' ? '**Tú**' : '**LinxAI**'
    contenido += `${quien}: ${m.content}\n\n`
  })

  const blob = new Blob([contenido], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `linxai-${sesion.id}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function renderHistorySidebar() {
  const list = document.getElementById('history-list')
  if (!list) return

  const history = getHistory()
  list.innerHTML = ''

  // Search bar
  const searchWrap = document.createElement('div')
  searchWrap.className = 'history-search-wrap'
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.className = 'history-search-input'
  searchInput.placeholder = t('history_search')
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim()
    if (q.length >= 2) {
      renderFilteredHistory(list, buscarEnHistorial(q), searchWrap)
    } else {
      renderHistoryItems(list, history, searchWrap)
    }
  })
  searchWrap.appendChild(searchInput)
  list.appendChild(searchWrap)

  if (history.length === 0) {
    list.innerHTML = ''
    list.appendChild(searchWrap)
    const empty = document.createElement('div')
    empty.style.cssText = 'padding:var(--space-sm);font-size:12px;color:var(--text-tertiary);text-align:center'
    empty.textContent = t('history_empty')
    list.appendChild(empty)
    return
  }

  renderHistoryItems(list, history, searchWrap)
}

function renderFilteredHistory(list, filtered, searchWrap) {
  list.innerHTML = ''
  list.appendChild(searchWrap)

  if (filtered.length === 0) {
    const noRes = document.createElement('div')
    noRes.style.cssText = 'padding:var(--space-sm);font-size:12px;color:var(--text-tertiary);text-align:center'
    noRes.textContent = t('history_no_results')
    list.appendChild(noRes)
    return
  }

  renderHistoryItems(list, filtered, searchWrap)
}

function renderHistoryItems(list, history, searchWrap) {
  list.innerHTML = ''
  list.appendChild(searchWrap)

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
        <button class="history-item__export btn-icon" title="${t('history_export')}" aria-label="Export session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="history-item__delete btn-icon" title="Delete" aria-label="Delete session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `

      // Click to load
      item.addEventListener('click', (e) => {
        if (e.target.closest('.history-item__delete') || e.target.closest('.history-item__export')) return
        window.dispatchEvent(new CustomEvent('linxai:load-session', { detail: session.id }))
      })

      // Export
      item.querySelector('.history-item__export').addEventListener('click', (e) => {
        e.stopPropagation()
        exportarSesion(session.id)
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
