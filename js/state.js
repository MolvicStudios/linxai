// state.js — Observable global state (no dependencies)
const state = {
  lang: localStorage.getItem('linxai_lang') || 'es',
  distro: localStorage.getItem('linxai_distro') || 'ubuntu',
  level: localStorage.getItem('linxai_level') || 'beginner',
  mode: 'chat',       // 'chat' | 'terminal' | 'guide'
  session: [],         // messages for current session
  sessionId: null,     // current session id
  loading: false,
  onboardingDone: !!localStorage.getItem('linxai_onboarding_done'),
  terminalHistory: [], // last 20 translated commands
  guideLesson: null,   // current lesson id
}

const listeners = {}

export function getState() {
  return { ...state }
}

export function setState(patch) {
  Object.assign(state, patch)
  // Persist relevant keys to localStorage
  if ('lang' in patch) localStorage.setItem('linxai_lang', patch.lang)
  if ('distro' in patch) localStorage.setItem('linxai_distro', patch.distro)
  if ('level' in patch) localStorage.setItem('linxai_level', patch.level)
  // Notify listeners
  Object.keys(patch).forEach(key => {
    if (listeners[key]) {
      listeners[key].forEach(fn => fn(state[key], key))
    }
  })
}

export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = []
  listeners[key].push(fn)
  return () => {
    listeners[key] = listeners[key].filter(f => f !== fn)
  }
}
