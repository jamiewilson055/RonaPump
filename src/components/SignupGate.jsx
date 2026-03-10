import { useState, useEffect } from 'react'

const GATE_THRESHOLD = 8 // Number of workout expansions before gate appears
const STORAGE_KEY = 'rp_views'

export default function SignupGate({ onSignIn }) {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Listen for workout expansions
    function handleExpand() {
      const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0') + 1
      localStorage.setItem(STORAGE_KEY, count.toString())
      if (count >= GATE_THRESHOLD && !dismissed) {
        setShow(true)
      }
    }

    window.addEventListener('rp-workout-expand', handleExpand)
    return () => window.removeEventListener('rp-workout-expand', handleExpand)
  }, [dismissed])

  function dismiss() {
    setDismissed(true)
    setShow(false)
    // Show again after 20 more views
    const current = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
    localStorage.setItem(STORAGE_KEY, (current - 20).toString())
  }

  if (!show) return null

  return (
    <div className="gate-overlay">
      <div className="gate-card">
        <div className="gate-close" onClick={dismiss}>✕</div>
        <div className="gate-emoji">🦍</div>
        <h2 className="gate-title">You're on a roll!</h2>
        <p className="gate-text">
          Create a free account to unlock the full RonaPump experience — log scores, track PRs, build collections, compete on leaderboards, and get weekly digests.
        </p>
        <div className="gate-features">
          <div className="gate-feat">✓ Log workouts & track progress</div>
          <div className="gate-feat">✓ Compete on leaderboards</div>
          <div className="gate-feat">✓ Build custom collections</div>
          <div className="gate-feat">✓ Weekly performance digest</div>
          <div className="gate-feat">✓ Workout timer with audio cues</div>
          <div className="gate-feat">✓ 100% free — no credit card</div>
        </div>
        <button className="gate-btn" onClick={() => { setShow(false); onSignIn() }}>Create Free Account</button>
        <button className="gate-dismiss" onClick={dismiss}>I'll keep browsing</button>
      </div>
    </div>
  )
}

// Call this from WorkoutCard when expanded
export function trackWorkoutView() {
  window.dispatchEvent(new Event('rp-workout-expand'))
}
