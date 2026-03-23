// settings.js — Settings panel logic
import { t, applyI18n } from './i18n.js'
import { getState, setState } from './state.js'
import { getDistroName } from './groq.js'
import { clearAllHistory } from './history.js'

export function initSettings() {
  const panel = document.getElementById('settings-panel')
  const btnOpen = document.getElementById('btn-settings')
  const btnClose = document.getElementById('btn-settings-close')
  const backdrop = panel.querySelector('.settings-panel__backdrop')

  btnOpen.addEventListener('click', () => openSettings())
  btnClose.addEventListener('click', () => closeSettings())
  backdrop.addEventListener('click', () => closeSettings())

  // Distro select
  const distroSelect = document.getElementById('settings-distro')
  distroSelect.value = getState().distro
  distroSelect.addEventListener('change', () => {
    setState({ distro: distroSelect.value })
    updateDistroBadge()
  })

  // Level select
  const levelSelect = document.getElementById('settings-level')
  levelSelect.value = getState().level
  levelSelect.addEventListener('change', () => {
    setState({ level: levelSelect.value })
  })

  // Language buttons
  document.querySelectorAll('.settings-lang-toggle .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang
      setState({ lang })
      document.querySelectorAll('.settings-lang-toggle .lang-btn').forEach(b => b.classList.remove('lang-btn--active'))
      btn.classList.add('lang-btn--active')
      applyI18n()
      updateLangBadge()
      updatePlaceholder()
    })
  })

  // API mode radios
  document.querySelectorAll('input[name="api-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      localStorage.setItem('linxai_api_mode', radio.value)
      const keyGroup = document.getElementById('api-key-input-group')
      keyGroup.hidden = radio.value !== 'personal'
    })
  })

  // Save API key
  document.getElementById('btn-save-api-key').addEventListener('click', () => {
    const input = document.getElementById('settings-api-key')
    if (input.value.trim()) {
      localStorage.setItem('linxai_groq_key', input.value.trim())
      localStorage.setItem('linxai_api_mode', 'personal')
    }
  })

  // Clear history
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm(t('reset_confirm'))) {
      clearAllHistory()
      window.dispatchEvent(new CustomEvent('linxai:history-cleared'))
    }
  })

  // Reset all
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (confirm(t('reset_confirm'))) {
      // Clear all linxai_ keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('linxai_')) {
          localStorage.removeItem(key)
        }
      })
      window.location.reload()
    }
  })
}

function openSettings() {
  const panel = document.getElementById('settings-panel')

  // Sync values
  const state = getState()
  document.getElementById('settings-distro').value = state.distro
  document.getElementById('settings-level').value = state.level

  // Language buttons
  document.querySelectorAll('.settings-lang-toggle .lang-btn').forEach(btn => {
    btn.classList.toggle('lang-btn--active', btn.dataset.lang === state.lang)
  })

  // API mode
  const mode = localStorage.getItem('linxai_api_mode') || 'shared'
  document.querySelectorAll('input[name="api-mode"]').forEach(radio => {
    radio.checked = radio.value === mode
  })
  const keyGroup = document.getElementById('api-key-input-group')
  keyGroup.hidden = mode !== 'personal'

  // Mask existing key
  const existingKey = localStorage.getItem('linxai_groq_key')
  const keyInput = document.getElementById('settings-api-key')
  if (existingKey) {
    keyInput.value = existingKey.slice(0, 8) + '••••••••'
  }

  panel.hidden = false
}

function closeSettings() {
  document.getElementById('settings-panel').hidden = true
}

function updateDistroBadge() {
  const badge = document.getElementById('badge-distro')
  const { distro } = getState()
  badge.textContent = getDistroName(distro)
}

function updateLangBadge() {
  const btn = document.getElementById('btn-lang-toggle')
  btn.textContent = getState().lang.toUpperCase()
}

function updatePlaceholder() {
  const input = document.getElementById('chat-input')
  const { mode } = getState()
  if (mode === 'terminal') {
    input.setAttribute('placeholder', t('terminal_placeholder'))
  } else if (mode === 'guide') {
    input.setAttribute('placeholder', t('guide_placeholder'))
  } else {
    input.setAttribute('placeholder', t('chat_placeholder'))
  }
}
