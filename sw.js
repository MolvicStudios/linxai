const CACHE_NAME = 'linxai-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/chat.css',
  '/css/terminal.css',
  '/css/guide.css',
  '/css/onboarding.css',
  '/css/dark.css',
  '/js/app.js',
  '/js/state.js',
  '/js/groq.js',
  '/js/chat.js',
  '/js/terminal.js',
  '/js/guide.js',
  '/js/history.js',
  '/js/i18n.js',
  '/js/onboarding.js',
  '/js/pwa.js',
  '/js/settings.js',
  '/data/distros.json',
  '/data/commands.json',
  '/data/lessons.json',
  '/manifest.json'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Never cache Groq API calls
  if (e.request.url.includes('groq.com')) return

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        // Only cache successful GET requests
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return response
      })
    }).catch(() => {
      // Offline fallback: return cached index for navigation requests
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html')
      }
    })
  )
})
