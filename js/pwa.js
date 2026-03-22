// pwa.js — PWA install prompt + service worker registration

export function initPWA() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err)
    })
  }

  // Install prompt
  let deferredPrompt = null
  const btnInstall = document.getElementById('btn-install-pwa')

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e
    if (btnInstall) btnInstall.style.display = 'flex'
  })

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted' && btnInstall) {
        btnInstall.style.display = 'none'
      }
      deferredPrompt = null
    })
  }

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none'
  })
}
