import { useState, useEffect } from 'react'

export default function WODCard({ workouts }) {
  const [wod, setWod] = useState(null)

  useEffect(() => {
    pick()
  }, [workouts])

  function pick() {
    const pool = workouts.filter(w => !w.original_date && (!w.performance_log || w.performance_log.length === 0) && w.description.length > 40)
    if (pool.length) setWod(pool[Math.floor(Math.random() * pool.length)])
  }

  if (!wod) return null

  return (
    <div className="wod-card">
      <div className="wod-label">WORKOUT OF THE DAY</div>
      <div className="wod-body" onClick={() => {}}>
        <div className="wod-name">{wod.name || 'Unnamed Workout'}</div>
        <div className="wod-desc">{wod.description?.slice(0, 140)}{wod.description?.length > 140 ? '...' : ''}</div>
        <div className="wod-tags">
          {wod.equipment?.filter(q => q !== 'Bodyweight').slice(0, 4).map(q => <span key={q} className="tg te">{q}</span>)}
          {wod.workout_types?.filter(t => t !== 'General').slice(0, 3).map(t => <span key={t} className="tg tw">{t}</span>)}
          {wod.estimated_duration_mins && <span className="wdr">{wod.estimated_duration_mins}m</span>}
        </div>
      </div>
      <button className="wod-roll" onClick={(e) => { e.stopPropagation(); pick() }} title="Shuffle">↻</button>
    </div>
  )
}
