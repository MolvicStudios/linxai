// comparator.js — Distro comparator (v2)
import { t } from './i18n.js'
import { getState } from './state.js'

let distrosData = null

const CATEGORIAS = [
  { id: 'facilidad',       label_es: 'Facilidad para principiantes', label_en: 'Beginner friendly' },
  { id: 'gaming',          label_es: 'Gaming y Steam',               label_en: 'Gaming & Steam' },
  { id: 'ofimatica',       label_es: 'Ofimática y trabajo',          label_en: 'Office & work' },
  { id: 'programacion',    label_es: 'Programación',                 label_en: 'Development' },
  { id: 'rendimiento',     label_es: 'Rendimiento / RAM usada',      label_en: 'Performance / RAM' },
  { id: 'comunidad',       label_es: 'Comunidad y soporte',          label_en: 'Community & support' },
  { id: 'actualizacion',   label_es: 'Frecuencia actualizaciones',   label_en: 'Update frequency' },
  { id: 'personalizacion', label_es: 'Personalización',              label_en: 'Customization' }
]

async function loadData() {
  if (!distrosData) {
    const res = await fetch('/data/distros-v2.json')
    distrosData = await res.json()
  }
}

export async function initComparator() {
  await loadData()
}

export function renderComparator() {
  const container = document.getElementById('comparator-content')
  if (!container) return

  renderSelector(container)
}

function renderSelector(container) {
  const lang = getState().lang

  container.innerHTML = `
    <div class="comparator-selector">
      <h2 class="comparator-title">${t('comparator_title')}</h2>
      <p class="comparator-subtitle">${t('comparator_select')}</p>
      <div class="comparator-distro-grid" id="comparator-grid"></div>
      <button class="btn-primary comparator-btn" id="comparator-compare-btn" disabled>${t('comparator_compare')}</button>
    </div>
    <div id="comparator-table-wrap"></div>
  `

  const grid = document.getElementById('comparator-grid')
  const selected = new Set()

  Object.keys(distrosData).forEach(key => {
    const d = distrosData[key]
    const btn = document.createElement('button')
    btn.className = 'comparator-distro-chip'
    btn.dataset.distro = key
    btn.innerHTML = `<span class="comparator-distro-chip__dot" style="background:${d.color}"></span>${d.nombre}`
    btn.addEventListener('click', () => {
      if (selected.has(key)) {
        selected.delete(key)
        btn.classList.remove('comparator-distro-chip--active')
      } else {
        if (selected.size >= 3) return
        selected.add(key)
        btn.classList.add('comparator-distro-chip--active')
      }
      document.getElementById('comparator-compare-btn').disabled = selected.size < 2
    })
    grid.appendChild(btn)
  })

  document.getElementById('comparator-compare-btn').addEventListener('click', () => {
    if (selected.size >= 2) {
      renderTable(document.getElementById('comparator-table-wrap'), [...selected])
    }
  })
}

function renderStars(score) {
  let html = ''
  for (let i = 1; i <= 5; i++) {
    html += i <= score ? '★' : '☆'
  }
  return html
}

function renderTable(wrap, distroKeys) {
  const lang = getState().lang

  let headerCells = `<th></th>`
  distroKeys.forEach(key => {
    const d = distrosData[key]
    headerCells += `<th style="color:${d.color}">${d.nombre}</th>`
  })

  let rows = ''

  // Category scores
  CATEGORIAS.forEach(cat => {
    const label = lang === 'en' ? cat.label_en : cat.label_es
    let cells = `<td class="comparator-cat-label">${label}</td>`
    distroKeys.forEach(key => {
      const score = distrosData[key].scores[cat.id] || 0
      cells += `<td class="comparator-stars">${renderStars(score)}</td>`
    })
    rows += `<tr>${cells}</tr>`
  })

  // Extra info rows
  const extraRows = [
    { label_es: 'RAM mínima', label_en: 'Min RAM', fn: d => `${d.ram_min_mb} MB` },
    { label_es: 'Escritorio', label_en: 'Desktop', fn: d => d.escritorio },
    { label_es: 'Gestor paquetes', label_en: 'Package mgr', fn: d => d.gestor },
    { label_es: 'Tipo release', label_en: 'Release type', fn: d => d.tipo_release },
  ]

  extraRows.forEach(row => {
    const label = lang === 'en' ? row.label_en : row.label_es
    let cells = `<td class="comparator-cat-label">${label}</td>`
    distroKeys.forEach(key => {
      cells += `<td>${row.fn(distrosData[key])}</td>`
    })
    rows += `<tr class="comparator-info-row">${cells}</tr>`
  })

  // Pros/Cons
  const prosLabel = t('comparator_pros')
  const consLabel = t('comparator_cons')
  const idealLabel = t('comparator_ideal')

  let prosRow = `<td class="comparator-cat-label">${prosLabel}</td>`
  let consRow = `<td class="comparator-cat-label">${consLabel}</td>`
  let idealRow = `<td class="comparator-cat-label">${idealLabel}</td>`

  distroKeys.forEach(key => {
    const d = distrosData[key]
    const pros = lang === 'en' ? d.pros_en : d.pros_es
    const cons = lang === 'en' ? d.contras_en : d.contras_es
    const ideal = lang === 'en' ? d.ideal_para_en : d.ideal_para_es
    prosRow += `<td class="comparator-list-cell"><ul>${pros.map(p => `<li>${p}</li>`).join('')}</ul></td>`
    consRow += `<td class="comparator-list-cell"><ul>${cons.map(c => `<li>${c}</li>`).join('')}</ul></td>`
    idealRow += `<td class="comparator-ideal-cell">${ideal}</td>`
  })

  // Calculate recommendation based on total score
  let bestKey = distroKeys[0]
  let bestTotal = 0
  distroKeys.forEach(key => {
    const total = Object.values(distrosData[key].scores).reduce((a, b) => a + b, 0)
    if (total > bestTotal) {
      bestTotal = total
      bestKey = key
    }
  })

  wrap.innerHTML = `
    <div class="comparator-table-container">
      <table class="comparator-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>
          ${rows}
          <tr class="comparator-pros-row">${prosRow}</tr>
          <tr class="comparator-cons-row">${consRow}</tr>
          <tr class="comparator-ideal-row">${idealRow}</tr>
        </tbody>
      </table>
      <div class="comparator-recommendation">
        <strong>${t('comparator_recommendation')}</strong> 
        <span style="color:${distrosData[bestKey].color}">${distrosData[bestKey].nombre}</span>
      </div>
    </div>
  `
}
