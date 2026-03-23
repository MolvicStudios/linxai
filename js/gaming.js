// gaming.js — Gaming mode (v2)
import { t } from './i18n.js'
import { getState, setState } from './state.js'
import { getDistroName } from './groq.js'

let gamingData = null

async function loadData() {
  if (!gamingData) {
    const res = await fetch('/data/gaming.json')
    gamingData = await res.json()
  }
}

export async function initGaming() {
  await loadData()
}

export function renderGaming() {
  const container = document.getElementById('gaming-content')
  if (!container) return

  const { distro, gpu, lang } = getState()
  const distroName = getDistroName(distro)
  const gpuLabel = gpu === 'si' ? 'NVIDIA' : gpu === 'amd' ? 'AMD / Intel' : '—'

  container.innerHTML = `
    <div class="gaming-header">
      <h2 class="gaming-title">${t('gaming_title')}</h2>
      <div class="gaming-badges">
        <span class="gaming-badge">${t('gaming_detected_distro')}: <strong>${distroName}</strong></span>
        <span class="gaming-badge">GPU: <strong>${gpuLabel}</strong></span>
      </div>
    </div>
    <div class="gaming-guides" id="gaming-guides"></div>
    <div class="gaming-problems" id="gaming-problems"></div>
    <div class="gaming-ask-wrap">
      <button class="btn-primary gaming-ask-btn" id="gaming-ask-btn">${t('gaming_ask')}</button>
    </div>
  `

  renderGuides(document.getElementById('gaming-guides'), distro, lang)
  renderProblems(document.getElementById('gaming-problems'), distro, lang)

  document.getElementById('gaming-ask-btn').addEventListener('click', () => {
    setState({ mode: 'chat' })
    window.dispatchEvent(new CustomEvent('linxai:switch-mode', { detail: 'chat' }))
    // Pre-fill the gaming system prompt context
    window.dispatchEvent(new CustomEvent('linxai:gaming-mode'))
  })
}

function renderGuides(container, distro, lang) {
  const guias = gamingData.guias

  guias.forEach(guia => {
    const titulo = lang === 'en' ? guia.titulo_en : guia.titulo_es
    const card = document.createElement('div')
    card.className = 'gaming-guide-card'

    let stepsHtml = ''
    if (guia.pasos?.[distro]) {
      stepsHtml = renderSteps(guia.pasos[distro], lang)
    } else if (guia.pasos_generales_es) {
      const pasos = lang === 'en' ? guia.pasos_generales_en : guia.pasos_generales_es
      stepsHtml = `<ol class="gaming-steps-general">${pasos.map(p => `<li>${p}</li>`).join('')}</ol>`
    } else if (guia.descripcion_es) {
      const desc = lang === 'en' ? guia.descripcion_en : guia.descripcion_es
      stepsHtml = `<p class="gaming-guide-desc">${desc}</p>`
      if (guia.niveles) {
        stepsHtml += `<div class="gaming-protondb-levels">${guia.niveles.map(n => `<span class="protondb-level" style="border-color:${n.color}"><strong style="color:${n.color}">${n.nivel}</strong> — ${lang === 'en' ? n.desc_en : n.desc_es}</span>`).join('')}</div>`
      }
      if (guia.url) {
        stepsHtml += `<a href="${guia.url}" target="_blank" rel="noopener" class="gaming-link">ProtonDB →</a>`
      }
    }

    card.innerHTML = `
      <div class="gaming-guide-card__header">
        <span class="gaming-guide-card__icon">${guia.icono}</span>
        <h3 class="gaming-guide-card__title">${titulo}</h3>
      </div>
      <div class="gaming-guide-card__body">${stepsHtml}</div>
    `

    // Collapsible
    const header = card.querySelector('.gaming-guide-card__header')
    const body = card.querySelector('.gaming-guide-card__body')
    body.hidden = true
    header.style.cursor = 'pointer'
    header.addEventListener('click', () => {
      body.hidden = !body.hidden
      card.classList.toggle('gaming-guide-card--open', !body.hidden)
    })

    container.appendChild(card)
  })
}

function renderSteps(pasos, lang) {
  let html = '<div class="gaming-steps">'
  pasos.forEach(paso => {
    const desc = lang === 'en' ? (paso.desc_en || paso.desc_es) : paso.desc_es
    if (paso.cmd) {
      html += `
        <div class="gaming-step">
          <p class="gaming-step__desc">${desc}</p>
          <code class="gaming-step__cmd">${escapeHtml(paso.cmd)}</code>
        </div>
      `
    } else {
      html += `<div class="gaming-step"><p class="gaming-step__desc">${desc}</p></div>`
    }
  })
  html += '</div>'
  return html
}

function renderProblems(container, distro, lang) {
  const problems = gamingData.problemas_comunes.filter(p =>
    p.distros.includes('all') || p.distros.includes(distro)
  )

  if (problems.length === 0) return

  const title = document.createElement('h3')
  title.className = 'gaming-problems-title'
  title.textContent = t('gaming_common_problems')
  container.appendChild(title)

  problems.forEach(prob => {
    const problema = lang === 'en' ? prob.problema_en : prob.problema_es
    const solucion = lang === 'en' ? prob.solucion_en : prob.solucion_es

    const el = document.createElement('details')
    el.className = 'gaming-problem'
    el.innerHTML = `
      <summary class="gaming-problem__question">${problema}</summary>
      <div class="gaming-problem__answer">${formatSolution(solucion)}</div>
    `
    container.appendChild(el)
  })
}

function formatSolution(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('sudo ') || line.startsWith('gamemoderun ')) {
      return `<code class="gaming-step__cmd">${escapeHtml(line)}</code>`
    }
    return `<p>${line}</p>`
  }).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
