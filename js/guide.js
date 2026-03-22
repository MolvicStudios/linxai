// guide.js — Interactive guide / lessons module
import { t } from './i18n.js'
import { getState, setState, subscribe } from './state.js'
import { askGroq, buildGuidePrompt } from './groq.js'

let guideContainer = null
let lessonsData = null
let lessonMessages = []

export async function initGuide() {
  guideContainer = document.getElementById('guide-content')
  try {
    const res = await fetch('/data/lessons.json')
    lessonsData = await res.json()
  } catch {
    lessonsData = {}
  }
  renderLessons()
}

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem('linxai_progress')) || { completadas: [], en_progreso: null, puntos: 0 }
  } catch {
    return { completadas: [], en_progreso: null, puntos: 0 }
  }
}

function saveProgress(progress) {
  localStorage.setItem('linxai_progress', JSON.stringify(progress))
}

export function renderLessons() {
  if (!guideContainer || !lessonsData) return

  const { distro, level, lang } = getState()
  const progress = getProgress()

  const distroKey = distro === 'arch' ? 'arch' : 'ubuntu'
  const lessons = lessonsData[distroKey]?.[level] || []

  guideContainer.innerHTML = ''

  // Points display
  if (progress.puntos > 0) {
    const points = document.createElement('div')
    points.className = 'guide-points'
    points.innerHTML = `⭐ ${t('guide_progress')}: <span class="guide-points__value">${progress.puntos}</span>`
    guideContainer.appendChild(points)
  }

  if (lessons.length === 0) {
    guideContainer.innerHTML += `<p style="color:var(--text-secondary);text-align:center;padding:var(--space-2xl)">${lang === 'es' ? 'No hay lecciones disponibles para esta combinación.' : 'No lessons available for this combination.'}</p>`
    return
  }

  // Grid
  const grid = document.createElement('div')
  grid.className = 'guide-grid'

  lessons.forEach(lesson => {
    const isCompleted = progress.completadas.includes(lesson.id)
    const isInProgress = progress.en_progreso === lesson.id
    let statusClass = ''
    let badgeClass = ''
    let badgeText = ''

    if (isCompleted) {
      statusClass = 'lesson-card--completed'
      badgeClass = 'lesson-card__badge--completed'
      badgeText = `✓ ${t('guide_completed')}`
    } else if (isInProgress) {
      statusClass = 'lesson-card--in-progress'
      badgeClass = 'lesson-card__badge--in-progress'
      badgeText = `● ${t('guide_in_progress')}`
    }

    const title = lang === 'es' ? lesson.titulo_es : lesson.titulo_en
    const desc = lang === 'es' ? lesson.descripcion_es : lesson.descripcion_en

    const card = document.createElement('div')
    card.className = `lesson-card ${statusClass}`
    card.innerHTML = `
      <span class="lesson-card__badge ${badgeClass}">${badgeText}</span>
      <h3 class="lesson-card__title">${title}</h3>
      <p class="lesson-card__desc">${desc}</p>
      <div class="lesson-card__commands">
        ${lesson.comandos.map(c => `<span class="lesson-card__cmd-tag">${escapeHtml(c)}</span>`).join('')}
      </div>
      <div class="lesson-card__meta">
        <span>${lesson.pasos} ${t('guide_steps')}</span>
      </div>
      <button class="lesson-card__btn ${isInProgress ? 'lesson-card__btn--continue' : ''}">
        ${isCompleted ? t('guide_start') : isInProgress ? t('guide_continue') : t('guide_start')}
      </button>
    `

    card.querySelector('.lesson-card__btn').addEventListener('click', (e) => {
      e.stopPropagation()
      openLesson(lesson)
    })
    card.addEventListener('click', () => openLesson(lesson))

    grid.appendChild(card)
  })

  guideContainer.appendChild(grid)
}

function openLesson(lesson) {
  const { lang } = getState()
  const progress = getProgress()
  const title = lang === 'es' ? lesson.titulo_es : lesson.titulo_en
  const desc = lang === 'es' ? lesson.descripcion_es : lesson.descripcion_en

  // Mark as in progress
  if (!progress.completadas.includes(lesson.id)) {
    progress.en_progreso = lesson.id
    saveProgress(progress)
  }

  setState({ guideLesson: lesson.id })
  lessonMessages = []

  guideContainer.innerHTML = ''

  const detail = document.createElement('div')
  detail.className = 'lesson-detail'

  // Back button
  const back = document.createElement('button')
  back.className = 'lesson-detail__back'
  back.textContent = t('guide_back_to_lessons')
  back.addEventListener('click', () => {
    setState({ guideLesson: null })
    lessonMessages = []
    renderLessons()
  })
  detail.appendChild(back)

  // Header
  const header = document.createElement('div')
  header.className = 'lesson-detail__header'
  header.innerHTML = `
    <h2 class="lesson-detail__title">${title}</h2>
    <p class="lesson-detail__desc">${desc}</p>
    <div class="lesson-detail__progress" id="lesson-progress">
      ${Array.from({ length: lesson.pasos }, (_, i) => `<div class="lesson-detail__progress-step"></div>`).join('')}
    </div>
  `
  detail.appendChild(header)

  // Chat area
  const chat = document.createElement('div')
  chat.className = 'lesson-chat'
  chat.id = 'lesson-chat'
  detail.appendChild(chat)

  guideContainer.appendChild(detail)

  // Start the lesson by sending initial message to AI
  startLessonChat(lesson, title)
}

async function startLessonChat(lesson, title) {
  const chatEl = document.getElementById('lesson-chat')
  if (!chatEl) return

  setState({ loading: true })

  // Show typing
  chatEl.innerHTML = `
    <div class="msg msg--ai msg--typing">
      <div class="msg__avatar">🐧</div>
      <div class="msg__bubble">
        <span class="typing-dots"><span></span><span></span><span></span></span>
      </div>
    </div>
  `

  const { lang } = getState()
  const startMsg = lang === 'es'
    ? `Empecemos la lección "${title}". Introduce el tema y dame el primer paso.`
    : `Let's start the lesson "${title}". Introduce the topic and give me the first step.`

  try {
    const systemPrompt = buildGuidePrompt(title)
    const messages = [{ role: 'user', content: startMsg }]
    const reply = await askGroq(messages, systemPrompt)

    lessonMessages = [
      { role: 'user', content: startMsg },
      { role: 'assistant', content: reply }
    ]

    chatEl.innerHTML = ''
    appendGuideMessage('assistant', reply, chatEl)
    setState({ loading: false })
  } catch (err) {
    chatEl.innerHTML = `<p style="color:var(--accent-red);padding:var(--space-md)">${t('error_api')}</p>`
    setState({ loading: false })
  }
}

export async function sendGuideMessage(text) {
  const state = getState()
  if (state.loading || !state.guideLesson) return

  const chatEl = document.getElementById('lesson-chat')
  if (!chatEl) return

  // Append user message
  appendGuideMessage('user', text, chatEl)
  lessonMessages.push({ role: 'user', content: text })

  setState({ loading: true })

  // Show typing
  const typingEl = document.createElement('div')
  typingEl.className = 'msg msg--ai msg--typing'
  typingEl.id = 'guide-typing'
  typingEl.innerHTML = `
    <div class="msg__avatar">🐧</div>
    <div class="msg__bubble">
      <span class="typing-dots"><span></span><span></span><span></span></span>
    </div>
  `
  chatEl.appendChild(typingEl)
  chatEl.scrollTop = chatEl.scrollHeight

  try {
    const { lang } = getState()
    const title = '' // We use the stored lesson context
    const systemPrompt = buildGuidePrompt(text)
    const apiMessages = lessonMessages.map(m => ({ role: m.role, content: m.content }))
    const reply = await askGroq(apiMessages, systemPrompt)

    const typing = document.getElementById('guide-typing')
    if (typing) typing.remove()

    lessonMessages.push({ role: 'assistant', content: reply })
    appendGuideMessage('assistant', reply, chatEl)

    setState({ loading: false })
  } catch {
    const typing = document.getElementById('guide-typing')
    if (typing) typing.remove()
    appendGuideMessage('error', t('error_api'), chatEl)
    setState({ loading: false })
  }
}

function appendGuideMessage(role, content, container) {
  const msgEl = document.createElement('div')

  if (role === 'user') {
    msgEl.className = 'msg msg--user'
    msgEl.innerHTML = `<div class="msg__bubble">${escapeHtml(content)}</div>`
  } else if (role === 'error') {
    msgEl.className = 'msg msg--ai msg--error'
    msgEl.innerHTML = `
      <div class="msg__avatar">⚠️</div>
      <div class="msg__content">
        <div class="msg__bubble">${escapeHtml(content)}</div>
      </div>
    `
  } else {
    msgEl.className = 'msg msg--ai'
    msgEl.innerHTML = `
      <div class="msg__avatar">🐧</div>
      <div class="msg__content">
        <div class="msg__bubble">${renderMarkdown(content)}</div>
      </div>
    `
  }

  container.appendChild(msgEl)

  // Add copy buttons
  msgEl.querySelectorAll('pre').forEach(pre => {
    if (!pre.querySelector('.btn-copy')) {
      const btn = document.createElement('button')
      btn.className = 'btn-copy'
      btn.textContent = t('copy')
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code')
        const text = code ? code.textContent : pre.textContent
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = t('copied')
          btn.classList.add('btn-copy--copied')
          setTimeout(() => {
            btn.textContent = t('copy')
            btn.classList.remove('btn-copy--copied')
          }, 2000)
        })
      })
      pre.appendChild(btn)
    }
  })

  container.scrollTop = container.scrollHeight
}

// Basic markdown reuse
function renderMarkdown(text) {
  let html = escapeHtml(text)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trim()}</code></pre>`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/\n\n/g, '</p><p>')
  if (!html.startsWith('<')) html = '<p>' + html + '</p>'
  html = html.replace(/(?<!<\/li>|<\/ul>|<\/ol>|<\/pre>|<\/code>)\n(?!<)/g, '<br>')
  return html
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
