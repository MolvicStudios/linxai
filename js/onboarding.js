// onboarding.js — First-run wizard
import { t, applyI18n } from './i18n.js'
import { getState, setState } from './state.js'

const DISTROS = [
  { id: 'ubuntu', name: 'Ubuntu', icon: '🟠' },
  { id: 'ubuntu', name: 'Linux Mint', icon: '🟢', alias: 'mint' },
  { id: 'arch', name: 'Arch Linux', icon: '🔵' },
  { id: 'arch', name: 'Manjaro', icon: '🟣', alias: 'manjaro' },
]

const LEVELS = ['beginner', 'intermediate', 'advanced']

let currentStep = 0
let selectedLang = getState().lang
let selectedDistro = getState().distro
let selectedLevel = getState().level
let apiMode = localStorage.getItem('linxai_api_mode') || 'shared'

export function initOnboarding() {
  if (localStorage.getItem('linxai_onboarding_done')) return

  const overlay = document.getElementById('onboarding')
  overlay.hidden = false
  renderStep()
}

function renderStep() {
  const card = document.querySelector('.onboarding__card')
  card.innerHTML = ''

  // Progress bar
  const progress = document.createElement('div')
  progress.className = 'onboarding__progress'
  for (let i = 0; i < 3; i++) {
    const step = document.createElement('div')
    step.className = 'onboarding__progress-step'
    if (i < currentStep) step.classList.add('onboarding__progress-step--done')
    if (i === currentStep) step.classList.add('onboarding__progress-step--active')
    progress.appendChild(step)
  }
  card.appendChild(progress)

  // Step content
  switch (currentStep) {
    case 0: renderWelcome(card); break
    case 1: renderDistro(card); break
    case 2: renderApiKey(card); break
  }

  // Navigation
  const nav = document.createElement('div')
  nav.className = 'onboarding__nav'

  if (currentStep === 0) {
    // Skip checkbox
    const skip = document.createElement('label')
    skip.className = 'onboarding__skip'
    skip.innerHTML = `<input type="checkbox" id="onboarding-skip"> <span>${t('onboarding_skip')}</span>`
    nav.appendChild(skip)
  }

  if (currentStep > 0) {
    const backBtn = document.createElement('button')
    backBtn.className = 'onboarding__btn-back'
    backBtn.textContent = t('onboarding_back')
    backBtn.addEventListener('click', () => { currentStep--; renderStep() })
    nav.appendChild(backBtn)
  }

  const nextBtn = document.createElement('button')
  nextBtn.className = 'onboarding__btn-next'
  nextBtn.textContent = currentStep === 2 ? t('onboarding_start') : t('onboarding_next')
  nextBtn.addEventListener('click', handleNext)
  nav.appendChild(nextBtn)

  card.appendChild(nav)
}

function renderWelcome(card) {
  const title = document.createElement('h2')
  title.className = 'onboarding__title'
  title.textContent = t('onboarding_welcome_title')
  card.appendChild(title)

  const desc = document.createElement('p')
  desc.className = 'onboarding__desc'
  desc.textContent = t('onboarding_welcome_desc')
  card.appendChild(desc)

  // Language toggle
  const langToggle = document.createElement('div')
  langToggle.className = 'onboarding__lang-toggle'

  ;['es', 'en'].forEach(lang => {
    const btn = document.createElement('button')
    btn.className = 'onboarding__lang-btn'
    if (lang === selectedLang) btn.classList.add('onboarding__lang-btn--active')
    btn.textContent = lang.toUpperCase()
    btn.addEventListener('click', () => {
      selectedLang = lang
      setState({ lang })
      applyI18n()
      renderStep()
    })
    langToggle.appendChild(btn)
  })

  card.appendChild(langToggle)
}

function renderDistro(card) {
  const title = document.createElement('h2')
  title.className = 'onboarding__title'
  title.textContent = t('onboarding_distro_title')
  card.appendChild(title)

  const body = document.createElement('div')
  body.className = 'onboarding__body'

  // Distro grid
  const grid = document.createElement('div')
  grid.className = 'onboarding__distro-grid'

  DISTROS.forEach(d => {
    const el = document.createElement('button')
    el.className = 'distro-card'
    if (d.id === selectedDistro) el.classList.add('distro-card--selected')
    el.innerHTML = `
      <span class="distro-card__icon">${d.icon}</span>
      <span class="distro-card__name">${d.name}</span>
    `
    el.addEventListener('click', () => {
      selectedDistro = d.id
      grid.querySelectorAll('.distro-card').forEach(c => c.classList.remove('distro-card--selected'))
      el.classList.add('distro-card--selected')
    })
    grid.appendChild(el)
  })
  body.appendChild(grid)

  // Level title
  const levelTitle = document.createElement('h3')
  levelTitle.className = 'onboarding__title'
  levelTitle.style.fontSize = '18px'
  levelTitle.textContent = t('onboarding_level_title')
  body.appendChild(levelTitle)

  // Level buttons
  const levelGroup = document.createElement('div')
  levelGroup.className = 'onboarding__level-group'
  LEVELS.forEach(lvl => {
    const btn = document.createElement('button')
    btn.className = 'level-btn'
    if (lvl === selectedLevel) btn.classList.add('level-btn--selected')
    btn.textContent = t('level_' + lvl)
    btn.addEventListener('click', () => {
      selectedLevel = lvl
      levelGroup.querySelectorAll('.level-btn').forEach(b => b.classList.remove('level-btn--selected'))
      btn.classList.add('level-btn--selected')
    })
    levelGroup.appendChild(btn)
  })
  body.appendChild(levelGroup)

  card.appendChild(body)
}

function renderApiKey(card) {
  const title = document.createElement('h2')
  title.className = 'onboarding__title'
  title.textContent = t('onboarding_api_title')
  card.appendChild(title)

  const desc = document.createElement('p')
  desc.className = 'onboarding__desc'
  desc.textContent = t('onboarding_api_desc')
  card.appendChild(desc)

  const body = document.createElement('div')
  body.className = 'onboarding__body'

  // Options
  const options = document.createElement('div')
  options.className = 'onboarding__api-options'

  // Shared option
  const sharedOpt = createApiOption('shared', t('api_shared'))
  options.appendChild(sharedOpt)

  // Personal option
  const personalOpt = createApiOption('personal', t('api_personal'))
  options.appendChild(personalOpt)

  body.appendChild(options)

  // Key input group (visible when personal selected)
  const keyGroup = document.createElement('div')
  keyGroup.className = 'onboarding__api-key-group'
  keyGroup.style.display = apiMode === 'personal' ? 'flex' : 'none'
  keyGroup.id = 'onboarding-key-group'

  const keyInput = document.createElement('input')
  keyInput.type = 'password'
  keyInput.className = 'onboarding__api-key-input'
  keyInput.placeholder = 'gsk_...'
  keyInput.id = 'onboarding-api-key'
  keyInput.value = localStorage.getItem('linxai_groq_key') || ''
  keyGroup.appendChild(keyInput)

  const verifyBtn = document.createElement('button')
  verifyBtn.className = 'onboarding__api-verify-btn'
  verifyBtn.textContent = t('api_verify')
  verifyBtn.addEventListener('click', verifyApiKey)
  keyGroup.appendChild(verifyBtn)

  body.appendChild(keyGroup)

  // Status message
  const status = document.createElement('div')
  status.id = 'onboarding-api-status'
  status.className = 'onboarding__api-status'
  body.appendChild(status)

  // Link to console
  const link = document.createElement('p')
  link.className = 'onboarding__api-link'
  link.innerHTML = `${t('api_get_key')} <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>`
  body.appendChild(link)

  card.appendChild(body)
}

function createApiOption(mode, label) {
  const opt = document.createElement('div')
  opt.className = 'api-option'
  if (apiMode === mode) opt.classList.add('api-option--selected')
  opt.innerHTML = `
    <div class="api-option__radio"></div>
    <span class="api-option__label">${label}</span>
  `
  opt.addEventListener('click', () => {
    apiMode = mode
    document.querySelectorAll('.api-option').forEach(o => o.classList.remove('api-option--selected'))
    opt.classList.add('api-option--selected')
    const keyGroup = document.getElementById('onboarding-key-group')
    if (keyGroup) keyGroup.style.display = mode === 'personal' ? 'flex' : 'none'
  })
  return opt
}

async function verifyApiKey() {
  const input = document.getElementById('onboarding-api-key')
  const status = document.getElementById('onboarding-api-status')
  const key = input.value.trim()

  if (!key) return

  status.textContent = '...'
  status.className = 'onboarding__api-status'

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    })
    if (res.ok) {
      status.textContent = t('api_valid')
      status.classList.add('onboarding__api-status--valid')
    } else {
      status.textContent = t('api_invalid')
      status.classList.add('onboarding__api-status--invalid')
    }
  } catch {
    status.textContent = t('api_invalid')
    status.classList.add('onboarding__api-status--invalid')
  }
}

function handleNext() {
  if (currentStep < 2) {
    // Save intermediate state
    if (currentStep === 1) {
      setState({ distro: selectedDistro, level: selectedLevel })
    }
    currentStep++
    renderStep()
    return
  }

  // Final step — save everything and close
  setState({ distro: selectedDistro, level: selectedLevel, lang: selectedLang })
  localStorage.setItem('linxai_api_mode', apiMode)

  if (apiMode === 'personal') {
    const key = document.getElementById('onboarding-api-key')
    if (key && key.value.trim()) {
      localStorage.setItem('linxai_groq_key', key.value.trim())
    }
  } else {
    localStorage.removeItem('linxai_groq_key')
  }

  // Check "don't show again" or on final step always mark done
  localStorage.setItem('linxai_onboarding_done', 'true')
  setState({ onboardingDone: true })

  const overlay = document.getElementById('onboarding')
  overlay.hidden = true

  // Refresh UI translations
  applyI18n()

  // Dispatch custom event so app.js can react
  window.dispatchEvent(new CustomEvent('linxai:onboarding-done'))
}
