// app.js — Main application orchestrator
import { applyI18n, t } from './i18n.js'
import { getState, setState, subscribe } from './state.js'
import { getDistroName } from './groq.js'
import { initOnboarding } from './onboarding.js'
import { initChat, sendChatMessage, renderWelcome, loadSession } from './chat.js'
import { initTerminal, sendTerminalQuery, renderEmpty as renderTerminalEmpty } from './terminal.js'
import { initGuide, renderLessons, sendGuideMessage } from './guide.js'
import { renderHistorySidebar, startNewSession, loadSessionById, saveCurrentSession } from './history.js'
import { initSettings } from './settings.js'
import { initPWA } from './pwa.js'
import { initWizard, renderWizard, resetWizard } from './wizard.js'
import { initComparator, renderComparator } from './comparator.js'
import { initGaming, renderGaming } from './gaming.js'
import { initGlossary, renderGlossary } from './glossary.js'

document.addEventListener('DOMContentLoaded', () => {
  // Apply translations
  applyI18n()

  // Init modules
  initChat()
  initTerminal()
  initGuide()
  initWizard()
  initComparator()
  initGaming()
  initGlossary()
  initSettings()
  initPWA()
  renderHistorySidebar()

  // Show onboarding if first visit
  initOnboarding()

  // Sync UI to initial state
  syncUI()

  // ===== INPUT HANDLING =====
  const input = document.getElementById('chat-input')
  const btnSend = document.getElementById('btn-send')

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 120) + 'px'
    btnSend.disabled = !input.value.trim()
  })

  // Enter to send, Shift+Enter for newline
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  })

  btnSend.addEventListener('click', handleSend)

  function handleSend() {
    const text = input.value.trim()
    if (!text || getState().loading) return

    input.value = ''
    input.style.height = 'auto'
    btnSend.disabled = true

    const { mode } = getState()
    if (mode === 'terminal') {
      sendTerminalQuery(text)
    } else if (mode === 'guide' && getState().guideLesson) {
      sendGuideMessage(text)
    } else {
      sendChatMessage(text)
    }
  }

  // ===== MODE SWITCHING =====
  // Desktop sidebar buttons
  document.querySelectorAll('.sidebar__nav .nav-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode))
  })

  // Mobile bottom nav
  document.querySelectorAll('.mobile-nav__btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode))
  })

  function switchMode(mode) {
    setState({ mode })

    // Update nav active states
    document.querySelectorAll('.nav-btn[data-mode]').forEach(b => {
      b.classList.toggle('nav-btn--active', b.dataset.mode === mode)
    })
    document.querySelectorAll('.mobile-nav__btn[data-mode]').forEach(b => {
      b.classList.toggle('mobile-nav__btn--active', b.dataset.mode === mode)
    })

    // Switch views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'))
    const viewId = `view-${mode}`
    document.getElementById(viewId)?.classList.add('view--active')

    // Update header
    document.getElementById('header-mode-label').textContent = t('mode_' + mode)

    // Show/hide input bar based on mode
    const inputBar = document.getElementById('input-bar')
    const modesWithInput = ['chat', 'terminal', 'guide']
    if (inputBar) {
      inputBar.style.display = modesWithInput.includes(mode) ? '' : 'none'
    }

    // Update placeholder
    if (mode === 'terminal') {
      input.setAttribute('placeholder', t('terminal_placeholder'))
    } else if (mode === 'guide') {
      input.setAttribute('placeholder', t('guide_placeholder'))
    } else {
      input.setAttribute('placeholder', t('chat_placeholder'))
    }

    // Render v2 views on switch
    if (mode === 'wizard') renderWizard()
    if (mode === 'comparator') renderComparator()
    if (mode === 'gaming') renderGaming()
    if (mode === 'glossary') renderGlossary()

    // Close sidebar on mobile
    closeSidebar()
  }

  // ===== SIDEBAR MOBILE TOGGLE =====
  const sidebar = document.getElementById('sidebar')
  const btnOpen = document.getElementById('btn-sidebar-open')
  const btnClose = document.getElementById('btn-sidebar-close')
  const btnMobileMenu = document.getElementById('btn-mobile-menu')

  btnOpen?.addEventListener('click', toggleSidebar)
  btnClose?.addEventListener('click', closeSidebar)
  btnMobileMenu?.addEventListener('click', toggleSidebar)

  function toggleSidebar() {
    if (sidebar.classList.contains('sidebar--open')) {
      closeSidebar()
    } else {
      openSidebar()
    }
  }

  function openSidebar() {
    sidebar.classList.add('sidebar--open')
    document.body.classList.add('sidebar-backdrop-active')
  }

  function closeSidebar() {
    sidebar.classList.remove('sidebar--open')
    document.body.classList.remove('sidebar-backdrop-active')
  }

  // Close sidebar when clicking backdrop or outside on mobile
  const sidebarBackdrop = document.getElementById('sidebar-backdrop')
  sidebarBackdrop?.addEventListener('click', closeSidebar)

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('sidebar--open')) {
      if (!sidebar.contains(e.target) && !btnOpen.contains(e.target) && !btnMobileMenu?.contains(e.target)) {
        closeSidebar()
      }
    }
  })

  // ===== LANGUAGE TOGGLE (header) =====
  document.getElementById('btn-lang-toggle').addEventListener('click', () => {
    const { lang } = getState()
    const newLang = lang === 'es' ? 'en' : 'es'
    setState({ lang: newLang })
    applyI18n()
    syncUI()
    renderLessons()
    // Re-render current view welcome if needed
    const { mode, session } = getState()
    if (mode === 'chat' && session.length === 0) {
      renderWelcome()
    } else if (mode === 'terminal') {
      renderTerminalEmpty()
    }
  })

  // ===== NEW SESSION =====
  document.getElementById('btn-new-session').addEventListener('click', () => {
    startNewSession()
    const { mode } = getState()
    if (mode === 'chat') {
      renderWelcome()
    } else if (mode === 'terminal') {
      renderTerminalEmpty()
    } else if (mode === 'guide') {
      setState({ guideLesson: null })
      renderLessons()
    }
    renderHistorySidebar()
  })

  // ===== LOAD SESSION EVENT =====
  window.addEventListener('linxai:load-session', (e) => {
    const session = loadSessionById(e.detail)
    if (session) {
      switchMode(session.modo || 'chat')
      if (session.modo === 'chat' || !session.modo) {
        loadSession(session.mensajes)
      }
      renderHistorySidebar()
    }
  })

  // ===== HISTORY CLEARED EVENT =====
  window.addEventListener('linxai:history-cleared', () => {
    renderWelcome()
    renderHistorySidebar()
  })

  // ===== ONBOARDING DONE EVENT =====
  window.addEventListener('linxai:onboarding-done', () => {
    syncUI()
    renderWelcome()
    renderLessons()
    renderHistorySidebar()
  })

  // ===== V2 CUSTOM EVENTS =====
  window.addEventListener('linxai:switch-mode', (e) => {
    switchMode(e.detail)
  })

  window.addEventListener('linxai:gaming-mode', () => {
    switchMode('chat')
  })

  // Check URL params for shared wizard result
  const params = new URLSearchParams(window.location.search)
  if (params.has('resultado')) {
    switchMode('wizard')
  }

  // ===== STATE SUBSCRIPTIONS =====
  subscribe('loading', (loading) => {
    btnSend.disabled = loading || !input.value.trim()
    input.disabled = loading
  })

  subscribe('distro', () => {
    syncUI()
    renderLessons()
  })

  subscribe('level', () => {
    renderLessons()
  })
})

function syncUI() {
  const { lang, distro, mode } = getState()
  document.getElementById('btn-lang-toggle').textContent = lang.toUpperCase()
  document.getElementById('badge-distro').textContent = getDistroName(distro)
  document.getElementById('header-mode-label').textContent = t('mode_' + mode)

  // Update html lang attribute
  document.documentElement.lang = lang
}
