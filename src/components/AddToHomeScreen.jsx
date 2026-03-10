import { useState, useEffect } from 'react'

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (localStorage.getItem('rp_a2hs_dismissed')) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Detect iOS
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream
    setIsIOS(ios)

    // Android/Chrome install prompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show iOS prompt after 5 seconds
    if (ios) {
      const t = setTimeout(() => setShow(true), 5000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler) }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    }
    dismiss()
  }

  function dismiss() {
    setShow(false)
    localStorage.setItem('rp_a2hs_dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="a2hs">
      <div className="a2hs-inner">
        <span className="a2hs-icon">🦍</span>
        <div className="a2hs-text">
          {isIOS ? (
            <>
              <strong>Add RonaPump to Home Screen</strong>
              <span>Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong></span>
            </>
          ) : (
            <>
              <strong>Install RonaPump</strong>
              <span>Add to your home screen for quick access</span>
            </>
          )}
        </div>
        {!isIOS && <button className="a2hs-btn" onClick={handleInstall}>Install</button>}
        <button className="a2hs-close" onClick={dismiss}>✕</button>
      </div>
    </div>
  )
}
