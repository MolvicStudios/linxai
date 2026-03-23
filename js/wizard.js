// wizard.js — Distro recommendation wizard (v2)
import { t } from './i18n.js'
import { getState, setState } from './state.js'
import { askGroq } from './groq.js'

let wizardData = null
let distrosData = null

const SCORING = {
  ubuntu:     { uso: { gaming: 3, ofimatica: 5, programacion: 4, diseno: 4, servidor: 3, general: 5 }, experiencia: { ninguna: 5, poca: 5, algo: 4, avanzado: 3 }, hardware: { antiguo: 2, normal: 5, bueno: 5, potente: 4 }, actualizaciones: { estabilidad: 4, equilibrio: 5, cutting: 3 }, interfaz: { windows: 5, macos: 3, minimal: 2, indiferente: 5 }, nvidia: { si: 4, amd: 5, nosabe: 4 } },
  mint:       { uso: { gaming: 3, ofimatica: 5, programacion: 3, diseno: 3, servidor: 2, general: 5 }, experiencia: { ninguna: 5, poca: 5, algo: 4, avanzado: 2 }, hardware: { antiguo: 4, normal: 5, bueno: 4, potente: 3 }, actualizaciones: { estabilidad: 5, equilibrio: 4, cutting: 2 }, interfaz: { windows: 5, macos: 2, minimal: 2, indiferente: 4 }, nvidia: { si: 3, amd: 5, nosabe: 4 } },
  popos:      { uso: { gaming: 5, ofimatica: 3, programacion: 5, diseno: 4, servidor: 3, general: 4 }, experiencia: { ninguna: 3, poca: 4, algo: 5, avanzado: 5 }, hardware: { antiguo: 2, normal: 4, bueno: 5, potente: 5 }, actualizaciones: { estabilidad: 3, equilibrio: 5, cutting: 4 }, interfaz: { windows: 3, macos: 5, minimal: 3, indiferente: 4 }, nvidia: { si: 5, amd: 4, nosabe: 4 } },
  fedora:     { uso: { gaming: 4, ofimatica: 4, programacion: 5, diseno: 4, servidor: 4, general: 4 }, experiencia: { ninguna: 2, poca: 3, algo: 5, avanzado: 5 }, hardware: { antiguo: 2, normal: 4, bueno: 5, potente: 5 }, actualizaciones: { estabilidad: 3, equilibrio: 4, cutting: 5 }, interfaz: { windows: 3, macos: 4, minimal: 4, indiferente: 4 }, nvidia: { si: 3, amd: 5, nosabe: 3 } },
  manjaro:    { uso: { gaming: 5, ofimatica: 3, programacion: 5, diseno: 4, servidor: 3, general: 4 }, experiencia: { ninguna: 2, poca: 3, algo: 5, avanzado: 5 }, hardware: { antiguo: 2, normal: 4, bueno: 5, potente: 5 }, actualizaciones: { estabilidad: 2, equilibrio: 4, cutting: 5 }, interfaz: { windows: 3, macos: 3, minimal: 4, indiferente: 4 }, nvidia: { si: 4, amd: 5, nosabe: 3 } },
  opensuse:   { uso: { gaming: 3, ofimatica: 4, programacion: 4, diseno: 3, servidor: 5, general: 3 }, experiencia: { ninguna: 3, poca: 3, algo: 4, avanzado: 5 }, hardware: { antiguo: 3, normal: 4, bueno: 5, potente: 5 }, actualizaciones: { estabilidad: 5, equilibrio: 4, cutting: 3 }, interfaz: { windows: 3, macos: 3, minimal: 3, indiferente: 4 }, nvidia: { si: 3, amd: 5, nosabe: 3 } },
  elementary: { uso: { gaming: 2, ofimatica: 4, programacion: 3, diseno: 5, servidor: 2, general: 5 }, experiencia: { ninguna: 5, poca: 5, algo: 4, avanzado: 2 }, hardware: { antiguo: 3, normal: 5, bueno: 5, potente: 4 }, actualizaciones: { estabilidad: 5, equilibrio: 3, cutting: 2 }, interfaz: { windows: 2, macos: 5, minimal: 3, indiferente: 4 }, nvidia: { si: 3, amd: 5, nosabe: 4 } },
  arch:       { uso: { gaming: 5, ofimatica: 3, programacion: 5, diseno: 4, servidor: 4, general: 3 }, experiencia: { ninguna: 1, poca: 1, algo: 3, avanzado: 5 }, hardware: { antiguo: 3, normal: 4, bueno: 5, potente: 5 }, actualizaciones: { estabilidad: 1, equilibrio: 3, cutting: 5 }, interfaz: { windows: 2, macos: 2, minimal: 5, indiferente: 3 }, nvidia: { si: 4, amd: 5, nosabe: 3 } }
}

function calcularResultado(respuestas) {
  const scores = {}
  const preguntas = ['uso', 'experiencia', 'hardware', 'actualizaciones', 'interfaz', 'nvidia']

  Object.keys(SCORING).forEach(distro => {
    scores[distro] = 0
    preguntas.forEach(pregunta => {
      const respuesta = respuestas[pregunta]
      if (SCORING[distro][pregunta]?.[respuesta]) {
        scores[distro] += SCORING[distro][pregunta][respuesta]
      }
    })
  })

  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([distro, score]) => ({
      distro,
      score,
      porcentaje: Math.round((score / 30) * 100)
    }))
}

async function generarExplicacion(respuestas, resultado) {
  const top = resultado[0]
  const lang = getState().lang
  const systemPrompt = `Eres LinxAI. El usuario ha completado el test de selección de distro Linux.
Basándote en sus respuestas, explica en 3-4 frases por qué ${top.distro} es su mejor opción.
Sé directo, entusiasta y usa lenguaje simple. No uses tecnicismos. Menciona 1-2 ventajas concretas para su caso de uso específico.
Responde en ${lang === 'en' ? 'inglés' : 'español'}.`

  const mensaje = `Uso principal: ${respuestas.uso}. Experiencia: ${respuestas.experiencia}. Hardware: ${respuestas.hardware}. Preferencia actualizaciones: ${respuestas.actualizaciones}. Interfaz preferida: ${respuestas.interfaz}. GPU: ${respuestas.nvidia}.`

  return await askGroq([{ role: 'user', content: mensaje }], systemPrompt)
}

async function loadData() {
  if (!wizardData) {
    const res = await fetch('/data/wizard.json')
    wizardData = await res.json()
  }
  if (!distrosData) {
    const res = await fetch('/data/distros-v2.json')
    distrosData = await res.json()
  }
}

export async function initWizard() {
  await loadData()
}

export function renderWizard() {
  const container = document.getElementById('wizard-content')
  if (!container) return

  const { wizardStep, wizardAnswers } = getState()

  if (wizardStep === 0) {
    renderWizardWelcome(container)
  } else if (wizardStep <= 6) {
    renderWizardQuestion(container, wizardStep - 1)
  } else {
    renderWizardResult(container)
  }
}

function renderWizardWelcome(container) {
  const lang = getState().lang
  container.innerHTML = `
    <div class="wizard-welcome">
      <div class="wizard-welcome__icon">🧭</div>
      <h2 class="wizard-welcome__title">${t('wizard_title')}</h2>
      <p class="wizard-welcome__desc">${lang === 'en' ? wizardData.bienvenida_en : wizardData.bienvenida_es}</p>
      <button class="wizard-welcome__btn btn-primary" id="wizard-start-btn">${t('wizard_start')}</button>
    </div>
  `
  document.getElementById('wizard-start-btn').addEventListener('click', () => {
    setState({ wizardStep: 1 })
    renderWizard()
  })
}

function renderWizardQuestion(container, index) {
  const lang = getState().lang
  const pregunta = wizardData.preguntas[index]
  if (!pregunta) return

  const titulo = lang === 'en' ? pregunta.titulo_en : pregunta.titulo_es

  container.innerHTML = `
    <div class="wizard-question">
      <div class="wizard-question__progress">
        <span>${t('wizard_question')} ${index + 1} ${t('wizard_of')} 6</span>
        <div class="wizard-progress-bar">
          <div class="wizard-progress-bar__fill" style="width: ${((index + 1) / 6) * 100}%"></div>
        </div>
      </div>
      <h2 class="wizard-question__title">${titulo}</h2>
      <div class="wizard-question__options" id="wizard-options"></div>
      ${index > 0 ? `<button class="wizard-back-btn" id="wizard-back-btn">← ${t('onboarding_back')}</button>` : ''}
    </div>
  `

  const optionsEl = document.getElementById('wizard-options')
  pregunta.opciones.forEach(opcion => {
    const btn = document.createElement('button')
    btn.className = 'wizard-option'
    const label = lang === 'en' ? opcion.label_en : opcion.label_es
    btn.innerHTML = `<span class="wizard-option__icon">${opcion.icon}</span><span class="wizard-option__label">${label}</span>`
    btn.addEventListener('click', () => {
      const answers = { ...getState().wizardAnswers, [pregunta.id]: opcion.id }
      const nextStep = getState().wizardStep + 1
      setState({ wizardAnswers: answers, wizardStep: nextStep })
      renderWizard()
    })
    optionsEl.appendChild(btn)
  })

  const backBtn = document.getElementById('wizard-back-btn')
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      setState({ wizardStep: getState().wizardStep - 1 })
      renderWizard()
    })
  }
}

async function renderWizardResult(container) {
  const { wizardAnswers, lang } = getState()
  const resultado = calcularResultado(wizardAnswers)
  const top3 = resultado.slice(0, 3)
  const medals = ['🥇', '🥈', '🥉']

  container.innerHTML = `
    <div class="wizard-result">
      <h2 class="wizard-result__title">${t('wizard_result_title')}</h2>
      <div class="wizard-result__ranking" id="wizard-ranking"></div>
      <div class="wizard-result__explanation" id="wizard-explanation">
        <div class="wizard-loading">${t('thinking')}</div>
      </div>
      <div class="wizard-result__actions" id="wizard-actions"></div>
    </div>
  `

  // Render ranking
  const rankingEl = document.getElementById('wizard-ranking')
  top3.forEach((item, i) => {
    const info = distrosData[item.distro]
    const name = info?.nombre || item.distro
    const barEl = document.createElement('div')
    barEl.className = 'wizard-rank-item'
    barEl.innerHTML = `
      <span class="wizard-rank-item__medal">${medals[i]}</span>
      <span class="wizard-rank-item__name">${name}</span>
      <div class="wizard-rank-bar">
        <div class="wizard-rank-bar__fill" style="width: ${item.porcentaje}%; background: ${info?.color || 'var(--accent-green)'}"></div>
      </div>
      <span class="wizard-rank-item__score">${item.porcentaje}%</span>
    `
    rankingEl.appendChild(barEl)
  })

  // Render actions
  const topDistro = top3[0]
  const topInfo = distrosData[topDistro.distro]
  const actionsEl = document.getElementById('wizard-actions')
  actionsEl.innerHTML = `
    <button class="btn-primary wizard-action-btn" id="wizard-btn-guide">${t('wizard_guide')} ${topInfo?.nombre || topDistro.distro}</button>
    <a href="${topInfo?.descarga || '#'}" target="_blank" rel="noopener" class="btn-secondary wizard-action-btn">${t('wizard_download')} ${topInfo?.nombre || topDistro.distro} →</a>
    <button class="btn-secondary wizard-action-btn" id="wizard-btn-save">${t('wizard_save_profile')}</button>
    <button class="btn-secondary wizard-action-btn" id="wizard-btn-share">${t('wizard_share')}</button>
    <button class="btn-ghost wizard-action-btn" id="wizard-btn-restart">${t('wizard_restart')}</button>
  `

  document.getElementById('wizard-btn-guide').addEventListener('click', () => {
    setState({ distro: topDistro.distro, mode: 'guide' })
    window.dispatchEvent(new CustomEvent('linxai:switch-mode', { detail: 'guide' }))
  })

  document.getElementById('wizard-btn-save').addEventListener('click', () => {
    setState({ distro: topDistro.distro, gpu: wizardAnswers.nvidia || 'nosabe' })
    const badge = document.getElementById('badge-distro')
    if (badge) badge.textContent = topInfo?.nombre || topDistro.distro
    document.getElementById('wizard-btn-save').textContent = '✓'
    document.getElementById('wizard-btn-save').disabled = true
  })

  document.getElementById('wizard-btn-share').addEventListener('click', () => {
    const params = new URLSearchParams({
      resultado: topDistro.distro,
      score: topDistro.porcentaje
    })
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      document.getElementById('wizard-btn-share').textContent = '✓ ' + t('copied')
    })
  })

  document.getElementById('wizard-btn-restart').addEventListener('click', () => {
    setState({ wizardStep: 0, wizardAnswers: {} })
    renderWizard()
  })

  // Generate explanation with AI
  try {
    const explicacion = await generarExplicacion(wizardAnswers, resultado)
    document.getElementById('wizard-explanation').innerHTML = `<p class="wizard-explanation-text">${explicacion}</p>`
  } catch {
    document.getElementById('wizard-explanation').innerHTML = `<p class="wizard-explanation-text">${topInfo?.[lang === 'en' ? 'ideal_para_en' : 'ideal_para_es'] || ''}</p>`
  }
}

export function resetWizard() {
  setState({ wizardStep: 0, wizardAnswers: {} })
}
