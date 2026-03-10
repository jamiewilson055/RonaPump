import { useState, useEffect, useCallback } from 'react'
import WorkoutTimer from './WorkoutTimer'

export default function WODCard({ workouts }) {
  const [wod, setWod] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [showTimer, setShowTimer] = useState(false)

  const pick = useCallback(() => {
    const pool = workouts.filter(w => !w.original_date && (!w.performance_log || w.performance_log.length === 0) && w.description && w.description.length > 40)
    if (pool.length) setWod(pool[Math.floor(Math.random() * pool.length)])
  }, [workouts])

  useEffect(() => {
    if (workouts.length && !wod) pick()
  }, [workouts, wod, pick])

  function handleShuffle(e) {
    e.stopPropagation()
    e.preventDefault()
    setSpinning(true)
    pick()
    setTimeout(() => setSpinning(false), 400)
  }

  if (!wod) return null

  return (
    <>
      <div className="wod-card" onClick={() => setShowTimer(true)} style={{ cursor: 'pointer' }}>
        <div className="wod-top">
          <div className="wod-label-inline">WOD</div>
          <div className="wod-name">{wod.name || 'Unnamed Workout'}</div>
          <button className="wod-start" onClick={(e) => { e.stopPropagation(); setShowTimer(true) }}>▶ Start</button>
          <button
            className={`wod-roll${spinning ? ' spin' : ''}`}
            onClick={handleShuffle}
            onTouchEnd={(e) => { e.preventDefault(); handleShuffle(e) }}
            title="Shuffle"
          >↻</button>
        </div>
        <div className="wod-desc">{wod.description?.slice(0, 140)}{wod.description?.length > 140 ? '...' : ''}</div>
        <div className="wod-tags">
          {wod.equipment?.filter(q => q !== 'Bodyweight').slice(0, 4).map(q => <span key={q} className="tg te">{q}</span>)}
          {wod.workout_types?.filter(t => t !== 'General').slice(0, 3).map(t => <span key={t} className="tg tw">{t}</span>)}
          {wod.estimated_duration_mins && <span className="wdr">{wod.estimated_duration_mins}m</span>}
        </div>
      </div>
      {showTimer && <WorkoutTimer workout={wod} onClose={() => setShowTimer(false)} />}
    </>
  )
}
