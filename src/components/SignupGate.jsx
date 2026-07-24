const GATE_THRESHOLD = 5
const STORAGE_KEY = 'rp_views'
const VIEWED_KEY = 'rp_viewed_ids'

// Overlay retired — gating now happens via inline blur on workout content.
export default function SignupGate() {
  return null
}

export function trackWorkoutView() {
  window.dispatchEvent(new Event('rp-workout-expand'))
}

// Returns true if this workout may be shown in full to a signed-out visitor.
// The first GATE_THRESHOLD distinct workouts are free; previously viewed ones stay free.
export function previewWorkout(id) {
  try {
    const viewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]')
    if (viewed.includes(id)) return true
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
    if (count >= GATE_THRESHOLD) return false
    viewed.push(id)
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed))
    localStorage.setItem(STORAGE_KEY, String(count + 1))
    return true
  } catch { return true }
}
