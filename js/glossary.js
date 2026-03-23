// glossary.js — Windows→Linux glossary (v2)
import { t } from './i18n.js'
import { getState } from './state.js'

let glossaryData = null

async function loadData() {
  if (!glossaryData) {
    const res = await fetch('/data/glossary.json')
    glossaryData = await res.json()
  }
}

export async function initGlossary() {
  await loadData()
}

export function renderGlossary() {
  const container = document.getElementById('glossary-content')
  if (!container) return

  const lang = getState().lang
  const distro = getState().distro

  container.innerHTML = `
    <div class="glossary-header">
      <h2 class="glossary-title">${t('glossary_title')}</h2>
      <input type="text" class="glossary-search" id="glossary-search" placeholder="${t('glossary_search')}">
      <div class="glossary-filters" id="glossary-filters"></div>
    </div>
    <div class="glossary-list" id="glossary-list"></div>
  `

  // Render filter buttons
  const filtersEl = document.getElementById('glossary-filters')
  let activeFilter = 'all'

  const allBtn = document.createElement('button')
  allBtn.className = 'glossary-filter glossary-filter--active'
  allBtn.textContent = t('glossary_filter_all')
  allBtn.dataset.cat = 'all'
  filtersEl.appendChild(allBtn)

  glossaryData.categorias.forEach(cat => {
    const btn = document.createElement('button')
    btn.className = 'glossary-filter'
    btn.textContent = lang === 'en' ? cat.label_en : cat.label_es
    btn.dataset.cat = cat.id
    filtersEl.appendChild(btn)
  })

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.glossary-filter')
    if (!btn) return
    activeFilter = btn.dataset.cat
    filtersEl.querySelectorAll('.glossary-filter').forEach(b => b.classList.remove('glossary-filter--active'))
    btn.classList.add('glossary-filter--active')
    renderItems()
  })

  // Search
  const searchInput = document.getElementById('glossary-search')
  searchInput.addEventListener('input', () => renderItems())

  function renderItems() {
    const query = searchInput.value.toLowerCase().trim()
    const listEl = document.getElementById('glossary-list')
    listEl.innerHTML = ''

    let items = glossaryData.terminos

    // Filter by category
    if (activeFilter !== 'all') {
      items = items.filter(item => item.categoria === activeFilter)
    }

    // Filter by search
    if (query) {
      items = items.filter(item => {
        const winTerm = (item.windows || '').toLowerCase()
        const winTermEn = (item.windows_en || '').toLowerCase()
        const linuxTerm = (item.linux_general || '').toLowerCase()
        const linuxTermEn = (item.linux_general_en || '').toLowerCase()
        return winTerm.includes(query) || winTermEn.includes(query) ||
               linuxTerm.includes(query) || linuxTermEn.includes(query)
      })
    }

    if (items.length === 0) {
      listEl.innerHTML = `<div class="glossary-empty">${t('history_no_results')}</div>`
      return
    }

    items.forEach(item => {
      const winLabel = lang === 'en' ? (item.windows_en || item.windows) : item.windows
      const linuxLabel = lang === 'en' ? (item.linux_general_en || item.linux_general) : item.linux_general
      const desc = lang === 'en' ? (item.descripcion_en || '') : (item.descripcion_es || '')
      const distroSpecific = item.por_distro?.[distro] || ''

      const card = document.createElement('div')
      card.className = 'glossary-item'

      let html = `
        <div class="glossary-item__header">
          <span class="glossary-item__windows">${escapeHtml(winLabel)}</span>
          <span class="glossary-item__arrow">→</span>
          <span class="glossary-item__linux">${escapeHtml(linuxLabel)}</span>
        </div>
      `

      if (distroSpecific) {
        html += `<div class="glossary-item__distro"><span class="glossary-item__distro-label">${t('glossary_your_distro')}:</span> ${escapeHtml(distroSpecific)}</div>`
      }

      if (desc) {
        html += `<div class="glossary-item__desc">${escapeHtml(desc)}</div>`
      }

      if (item.cmd) {
        html += `<div class="glossary-item__cmd"><span class="glossary-item__cmd-label">${t('glossary_command')}:</span> <code>${escapeHtml(item.cmd)}</code></div>`
      }

      card.innerHTML = html
      listEl.appendChild(card)
    })
  }

  renderItems()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
