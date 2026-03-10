import { useState, useEffect } from 'react'

const GATE_THRESHOLD = 8
const STORAGE_KEY = 'rp_views'

export default function SignupGate({ onSignIn }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function handleExpand() {
      const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0') + 1
      localStorage.setItem(STORAGE_KEY, count.toString())
      if (count >= GATE_THRESHOLD) {
        setShow(true)
      }
    }

    // Also check on mount in case they already hit the threshold
    const current = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
    if (current >= GATE_THRESHOLD) setShow(true)

    window.addEventListener('rp-workout-expand', handleExpand)
    return () => window.removeEventListener('rp-workout-expand', handleExpand)
  }, [])

  if (!show) return null

  return (
    <div className="gate-overlay">
      <div className="gate-card">
        <div className="gate-emoji">🦍</div>
        <h2 className="gate-title">Join the Pack</h2>
        <p className="gate-text">
          Create a free account to keep browsing and unlock the full RonaPump experience.
        </p>
        <div className="gate-features">
          <div className="gate-feat">✓ Browse 800+ workouts</div>
          <div className="gate-feat">✓ Log scores & track progress</div>
          <div className="gate-feat">✓ Compete on leaderboards</div>
          <div className="gate-feat">✓ Build custom collections</div>
          <div className="gate-feat">✓ Workout timer with audio cues</div>
          <div className="gate-feat">✓ 100% free — no credit card</div>
        </div>
        <button className="gate-btn" onClick={() => { setShow(false); onSignIn() }}>Create Free Account</button>
        <p className="gate-sub">Already have an account? <span className="gate-link" onClick={() => { setShow(false); onSignIn() }}>Sign In</span></p>
      </div>
    </div>
  )
}

export function trackWorkoutView() {
  window.dispatchEvent(new Event('rp-workout-expand'))
}
