import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const MOVEMENT_TO_MUSCLES = {
  'Push-Up': ['chest', 'triceps', 'shoulders'],
  'Bench Press': ['chest', 'triceps', 'shoulders'],
  'Pull-Up': ['back', 'biceps', 'core'],
  'Squat': ['quads', 'glutes', 'core'],
  'Deadlift': ['hamstrings', 'back', 'glutes', 'core'],
  'Lunge': ['quads', 'glutes', 'hamstrings'],
  'Run': ['quads', 'calves', 'hamstrings'],
  'Shoulder Press': ['shoulders', 'triceps', 'core'],
  'Burpee': ['chest', 'quads', 'shoulders', 'core', 'calves'],
  'Jump': ['quads', 'calves', 'glutes'],
  'DB Snatch': ['shoulders', 'back', 'core', 'quads'],
  'Farmers Carry': ['core', 'back', 'shoulders', 'biceps'],
}

const BODYPART_TO_MUSCLES = {
  'Upper Body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  'Lower Body': ['quads', 'hamstrings', 'glutes', 'calves'],
  'Full Body': ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'],
}

const ALL_MUSCLES = ['shoulders', 'chest', 'biceps', 'triceps', 'core', 'back', 'quads', 'hamstrings', 'glutes', 'calves']

const MUSCLE_LABELS = {
  shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps',
  core: 'Core', back: 'Back', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves',
}

function daysAgo(dateStr) {
  if (!dateStr) return 999
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

function muscleColor(days) {
  if (days === 0) return { fill: '#e01e1e', opacity: 0.85, label: 'Today', ring: '#ff4444' }
  if (days === 1) return { fill: '#e05e1e', opacity: 0.75, label: 'Yesterday', ring: '#ff7744' }
  if (days <= 2) return { fill: '#e0a01e', opacity: 0.65, label: `${days}d ago`, ring: '#ffbb44' }
  if (days <= 4) return { fill: '#4ade80', opacity: 0.5, label: `${days}d ago`, ring: '#4ade80' }
  return { fill: '#2a2a35', opacity: 0.25, label: '5+ days', ring: '#3a3a45' }
}

// Demo data for non-signed-in preview
const DEMO_STATUS = {
  shoulders: { daysAgo: 1, count: 2 }, chest: { daysAgo: 0, count: 1 },
  biceps: { daysAgo: 3, count: 1 }, triceps: { daysAgo: 1, count: 2 },
  core: { daysAgo: 0, count: 3 }, back: { daysAgo: 2, count: 1 },
  quads: { daysAgo: 4, count: 1 }, hamstrings: { daysAgo: 6, count: 0 },
  glutes: { daysAgo: 4, count: 1 }, calves: { daysAgo: 6, count: 0 },
}

export default function BodyMap({ session, preview }) {
  const [logs, setLogs] = useState([])
  const [hovering, setHovering] = useState(null)

  useEffect(() => {
    if (session && !preview) loadRecentLogs()
  }, [session, preview])

  async function loadRecentLogs() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('performance_log')
      .select('completed_at, workouts(movement_categories, body_parts)')
      .eq('user_id', session.user.id)
      .gte('completed_at', weekAgo)
      .order('completed_at', { ascending: false })
    if (data) setLogs(data)
  }

  const muscleStatus = useMemo(() => {
    if (preview) return DEMO_STATUS

    const status = {}
    ALL_MUSCLES.forEach(m => { status[m] = { lastTrained: null, daysAgo: 999, count: 0 } })

    logs.forEach(log => {
      const w = log.workouts
      if (!w) return
      const hitMuscles = new Set()
      ;(w.movement_categories || []).forEach(mc => {
        const mapped = MOVEMENT_TO_MUSCLES[mc]
        if (mapped) mapped.forEach(m => hitMuscles.add(m))
      })
      ;(w.body_parts || []).forEach(bp => {
        const mapped = BODYPART_TO_MUSCLES[bp]
        if (mapped) mapped.forEach(m => hitMuscles.add(m))
      })
      hitMuscles.forEach(m => {
        if (status[m]) {
          status[m].count++
          const d = daysAgo(log.completed_at)
          if (d < status[m].daysAgo) {
            status[m].daysAgo = d
            status[m].lastTrained = log.completed_at
          }
        }
      })
    })
    return status
  }, [logs, preview])

  function mc(muscle) {
    const days = muscleStatus[muscle]?.daysAgo ?? 999
    return muscleColor(days)
  }

  function hover(muscle) { setHovering(muscle) }

  const trainedCount = ALL_MUSCLES.filter(m => (muscleStatus[m]?.daysAgo ?? 999) <= 7).length
  const hoveredMuscle = hovering ? muscleStatus[hovering] : null
  const hoveredColor = hovering ? mc(hovering) : null

  // Shared SVG props per muscle (no onMouseLeave on individual shapes)
  function mp(muscle) {
    return {
      fill: mc(muscle).fill,
      opacity: mc(muscle).opacity,
      stroke: hovering === muscle ? mc(muscle).ring : 'none',
      strokeWidth: hovering === muscle ? 2.5 : 0,
      onMouseEnter: () => hover(muscle),
      style: { cursor: 'pointer', transition: 'opacity .15s, stroke .15s' },
    }
  }

  return (
    <div className={`bodymap${preview ? ' bodymap-preview' : ''}`}>
      <div className="bodymap-header">
        <div className="bodymap-title">Muscle Map</div>
        <div className="bodymap-trained">{trainedCount}/{ALL_MUSCLES.length} this week</div>
      </div>

      <div className="bodymap-container">
        {/* SVG with single onMouseLeave to prevent twitching */}
        <svg viewBox="0 0 200 340" className="bodymap-svg" onMouseLeave={() => setHovering(null)}>
          {/* Head - not interactive */}
          <ellipse cx="100" cy="22" rx="16" ry="19" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />
          {/* Neck */}
          <rect x="93" y="40" width="14" height="10" rx="3" fill="var(--s2)" />

          {/* BACK (behind torso, rendered first so it's underneath) */}
          <rect x="73" y="54" width="54" height="24" rx="6" {...mp('back')} />

          {/* Shoulders - separated from chest with gap */}
          <ellipse cx="54" cy="62" rx="18" ry="11" {...mp('shoulders')} />
          <ellipse cx="146" cy="62" rx="18" ry="11" {...mp('shoulders')} />

          {/* Chest - inset from shoulders */}
          <rect x="74" y="56" width="52" height="34" rx="6" {...mp('chest')} />

          {/* Core */}
          <rect x="78" y="94" width="44" height="48" rx="5" {...mp('core')} />

          {/* Triceps (outer arms) */}
          <ellipse cx="34" cy="96" rx="7" ry="20" {...mp('triceps')} />
          <ellipse cx="166" cy="96" rx="7" ry="20" {...mp('triceps')} />

          {/* Biceps (inner arms) */}
          <ellipse cx="46" cy="100" rx="8" ry="22" {...mp('biceps')} />
          <ellipse cx="154" cy="100" rx="8" ry="22" {...mp('biceps')} />

          {/* Forearms - not interactive */}
          <rect x="36" y="122" width="12" height="32" rx="5" fill="var(--s2)" />
          <rect x="152" y="122" width="12" height="32" rx="5" fill="var(--s2)" />

          {/* Glutes */}
          <ellipse cx="87" cy="150" rx="13" ry="9" {...mp('glutes')} />
          <ellipse cx="113" cy="150" rx="13" ry="9" {...mp('glutes')} />

          {/* Hamstrings (back of thigh, rendered behind quads) */}
          <rect x="66" y="162" width="12" height="52" rx="5" {...mp('hamstrings')} />
          <rect x="122" y="162" width="12" height="52" rx="5" {...mp('hamstrings')} />

          {/* Quads */}
          <rect x="74" y="160" width="20" height="58" rx="7" {...mp('quads')} />
          <rect x="106" y="160" width="20" height="58" rx="7" {...mp('quads')} />

          {/* Knees - not interactive */}
          <circle cx="84" cy="224" r="6" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.3" />
          <circle cx="116" cy="224" r="6" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.3" />

          {/* Calves - made taller and wider for easier hovering */}
          <ellipse cx="83" cy="264" rx="12" ry="32" {...mp('calves')} />
          <ellipse cx="117" cy="264" rx="12" ry="32" {...mp('calves')} />

          {/* Feet - not interactive */}
          <ellipse cx="83" cy="304" rx="11" ry="5" fill="var(--s2)" />
          <ellipse cx="117" cy="304" rx="11" ry="5" fill="var(--s2)" />
        </svg>

        {/* Info panel */}
        <div className="bodymap-info">
          {hovering ? (
            <div className="bodymap-hover">
              <div className="bodymap-hover-name" style={{ color: hoveredColor?.fill }}>{MUSCLE_LABELS[hovering]}</div>
              <div className="bodymap-hover-status">{hoveredColor?.label}</div>
              {(hoveredMuscle?.count || 0) > 0 && <div className="bodymap-hover-count">{hoveredMuscle.count}x this week</div>}
            </div>
          ) : (
            <div className="bodymap-hint">Hover a muscle group</div>
          )}

          <div className="bodymap-legend">
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#e01e1e' }}></span> Today</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#e0a01e' }}></span> 1-2d</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#4ade80' }}></span> 3-4d</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#2a2a35', border: '1px solid #3a3a45' }}></span> 5+d</div>
          </div>

          <div className="bodymap-muscle-list">
            {ALL_MUSCLES.map(m => {
              const days = muscleStatus[m]?.daysAgo ?? 999
              const c = muscleColor(days)
              return (
                <div key={m} className={`bodymap-muscle-row${hovering === m ? ' active' : ''}`}
                  onMouseEnter={() => hover(m)} onMouseLeave={() => setHovering(null)}>
                  <span className="bodymap-dot" style={{ background: c.fill }}></span>
                  <span className="bodymap-muscle-name">{MUSCLE_LABELS[m]}</span>
                  <span className="bodymap-muscle-ago">{c.label}</span>
                </div>
              )
            })}
          </div>

          {preview && (
            <div className="bodymap-preview-cta">Sign in to track your muscles</div>
          )}
        </div>
      </div>
    </div>
  )
}
