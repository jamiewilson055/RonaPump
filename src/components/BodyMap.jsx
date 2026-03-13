import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Map movement categories + body parts to muscle regions
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
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

function muscleColor(daysAgo) {
  if (daysAgo === 0) return { fill: '#e01e1e', opacity: 0.85, label: 'Today', ring: '#ff4444' }
  if (daysAgo === 1) return { fill: '#e05e1e', opacity: 0.75, label: 'Yesterday', ring: '#ff7744' }
  if (daysAgo <= 2) return { fill: '#e0a01e', opacity: 0.65, label: `${daysAgo}d ago`, ring: '#ffbb44' }
  if (daysAgo <= 4) return { fill: '#4ade80', opacity: 0.5, label: `${daysAgo}d ago`, ring: '#4ade80' }
  return { fill: '#2a2a35', opacity: 0.2, label: 'Fresh', ring: '#3a3a45' }
}

export default function BodyMap({ session }) {
  const [logs, setLogs] = useState([])
  const [hovering, setHovering] = useState(null)

  useEffect(() => {
    if (session) loadRecentLogs()
  }, [session])

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

  // Compute last trained date per muscle group
  const muscleStatus = useMemo(() => {
    const status = {}
    ALL_MUSCLES.forEach(m => { status[m] = { lastTrained: null, daysAgo: 999, count: 0 } })

    logs.forEach(log => {
      const w = log.workouts
      if (!w) return
      const hitMuscles = new Set()

      // From movement categories
      ;(w.movement_categories || []).forEach(mc => {
        const mapped = MOVEMENT_TO_MUSCLES[mc]
        if (mapped) mapped.forEach(m => hitMuscles.add(m))
      })

      // From body parts
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
  }, [logs])

  function mc(muscle) {
    return muscleColor(muscleStatus[muscle]?.daysAgo ?? 999)
  }

  const trainedCount = ALL_MUSCLES.filter(m => muscleStatus[m].daysAgo <= 7).length
  const hoveredMuscle = hovering ? muscleStatus[hovering] : null
  const hoveredColor = hovering ? mc(hovering) : null

  return (
    <div className="bodymap">
      <div className="bodymap-header">
        <div className="bodymap-title">Muscle Map</div>
        <div className="bodymap-trained">{trainedCount}/{ALL_MUSCLES.length} trained this week</div>
      </div>

      <div className="bodymap-container">
        <svg viewBox="0 0 200 380" className="bodymap-svg">
          {/* Head */}
          <ellipse cx="100" cy="28" rx="18" ry="22" fill="var(--s2)" stroke="var(--brd)" strokeWidth="1" />

          {/* Neck */}
          <rect x="92" y="48" width="16" height="14" rx="4" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />

          {/* Shoulders */}
          <ellipse cx="58" cy="72" rx="20" ry="12"
            fill={mc('shoulders').fill} opacity={mc('shoulders').opacity}
            stroke={mc('shoulders').ring} strokeWidth={hovering === 'shoulders' ? 2 : 0.5}
            onMouseEnter={() => setHovering('shoulders')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <ellipse cx="142" cy="72" rx="20" ry="12"
            fill={mc('shoulders').fill} opacity={mc('shoulders').opacity}
            stroke={mc('shoulders').ring} strokeWidth={hovering === 'shoulders' ? 2 : 0.5}
            onMouseEnter={() => setHovering('shoulders')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Chest */}
          <path d="M 70 68 Q 100 62 130 68 L 128 100 Q 100 106 72 100 Z"
            fill={mc('chest').fill} opacity={mc('chest').opacity}
            stroke={mc('chest').ring} strokeWidth={hovering === 'chest' ? 2 : 0.5}
            onMouseEnter={() => setHovering('chest')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Core */}
          <rect x="76" y="102" width="48" height="50" rx="6"
            fill={mc('core').fill} opacity={mc('core').opacity}
            stroke={mc('core').ring} strokeWidth={hovering === 'core' ? 2 : 0.5}
            onMouseEnter={() => setHovering('core')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Biceps */}
          <ellipse cx="46" cy="108" rx="10" ry="22"
            fill={mc('biceps').fill} opacity={mc('biceps').opacity}
            stroke={mc('biceps').ring} strokeWidth={hovering === 'biceps' ? 2 : 0.5}
            onMouseEnter={() => setHovering('biceps')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <ellipse cx="154" cy="108" rx="10" ry="22"
            fill={mc('biceps').fill} opacity={mc('biceps').opacity}
            stroke={mc('biceps').ring} strokeWidth={hovering === 'biceps' ? 2 : 0.5}
            onMouseEnter={() => setHovering('biceps')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Triceps (slightly behind biceps, shown as outer arm) */}
          <ellipse cx="38" cy="104" rx="7" ry="18"
            fill={mc('triceps').fill} opacity={mc('triceps').opacity}
            stroke={mc('triceps').ring} strokeWidth={hovering === 'triceps' ? 2 : 0.5}
            onMouseEnter={() => setHovering('triceps')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <ellipse cx="162" cy="104" rx="7" ry="18"
            fill={mc('triceps').fill} opacity={mc('triceps').opacity}
            stroke={mc('triceps').ring} strokeWidth={hovering === 'triceps' ? 2 : 0.5}
            onMouseEnter={() => setHovering('triceps')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Forearms */}
          <rect x="38" y="130" width="14" height="36" rx="5" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />
          <rect x="148" y="130" width="14" height="36" rx="5" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />

          {/* Glutes */}
          <ellipse cx="86" cy="162" rx="14" ry="10"
            fill={mc('glutes').fill} opacity={mc('glutes').opacity}
            stroke={mc('glutes').ring} strokeWidth={hovering === 'glutes' ? 2 : 0.5}
            onMouseEnter={() => setHovering('glutes')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <ellipse cx="114" cy="162" rx="14" ry="10"
            fill={mc('glutes').fill} opacity={mc('glutes').opacity}
            stroke={mc('glutes').ring} strokeWidth={hovering === 'glutes' ? 2 : 0.5}
            onMouseEnter={() => setHovering('glutes')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Quads */}
          <rect x="72" y="174" width="22" height="64" rx="8"
            fill={mc('quads').fill} opacity={mc('quads').opacity}
            stroke={mc('quads').ring} strokeWidth={hovering === 'quads' ? 2 : 0.5}
            onMouseEnter={() => setHovering('quads')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <rect x="106" y="174" width="22" height="64" rx="8"
            fill={mc('quads').fill} opacity={mc('quads').opacity}
            stroke={mc('quads').ring} strokeWidth={hovering === 'quads' ? 2 : 0.5}
            onMouseEnter={() => setHovering('quads')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Hamstrings (back of thigh — shown slightly offset) */}
          <rect x="68" y="184" width="10" height="48" rx="4"
            fill={mc('hamstrings').fill} opacity={mc('hamstrings').opacity}
            stroke={mc('hamstrings').ring} strokeWidth={hovering === 'hamstrings' ? 2 : 0.5}
            onMouseEnter={() => setHovering('hamstrings')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <rect x="122" y="184" width="10" height="48" rx="4"
            fill={mc('hamstrings').fill} opacity={mc('hamstrings').opacity}
            stroke={mc('hamstrings').ring} strokeWidth={hovering === 'hamstrings' ? 2 : 0.5}
            onMouseEnter={() => setHovering('hamstrings')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Knees */}
          <circle cx="83" cy="244" r="7" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />
          <circle cx="117" cy="244" r="7" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />

          {/* Calves */}
          <ellipse cx="82" cy="282" rx="11" ry="28"
            fill={mc('calves').fill} opacity={mc('calves').opacity}
            stroke={mc('calves').ring} strokeWidth={hovering === 'calves' ? 2 : 0.5}
            onMouseEnter={() => setHovering('calves')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />
          <ellipse cx="118" cy="282" rx="11" ry="28"
            fill={mc('calves').fill} opacity={mc('calves').opacity}
            stroke={mc('calves').ring} strokeWidth={hovering === 'calves' ? 2 : 0.5}
            onMouseEnter={() => setHovering('calves')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Back (shown as overlay behind torso) */}
          <rect x="72" y="70" width="56" height="28" rx="6"
            fill={mc('back').fill} opacity={mc('back').opacity * 0.5}
            stroke="none"
            onMouseEnter={() => setHovering('back')} onMouseLeave={() => setHovering(null)}
            style={{ cursor: 'pointer', transition: 'all .2s' }} />

          {/* Feet */}
          <ellipse cx="82" cy="318" rx="10" ry="5" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />
          <ellipse cx="118" cy="318" rx="10" ry="5" fill="var(--s2)" stroke="var(--brd)" strokeWidth="0.5" />
        </svg>

        {/* Legend + hover info */}
        <div className="bodymap-info">
          {hovering ? (
            <div className="bodymap-hover">
              <div className="bodymap-hover-name" style={{ color: hoveredColor?.fill }}>{MUSCLE_LABELS[hovering]}</div>
              <div className="bodymap-hover-status">{hoveredColor?.label}</div>
              {hoveredMuscle?.count > 0 && <div className="bodymap-hover-count">{hoveredMuscle.count}x this week</div>}
            </div>
          ) : (
            <div className="bodymap-hint">Hover a muscle group</div>
          )}

          <div className="bodymap-legend">
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#e01e1e' }}></span> Today</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#e0a01e' }}></span> 1-2 days</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#4ade80' }}></span> 3-4 days</div>
            <div className="bodymap-legend-item"><span className="bodymap-dot" style={{ background: '#2a2a35' }}></span> 5+ days</div>
          </div>

          {/* Quick muscle list */}
          <div className="bodymap-muscle-list">
            {ALL_MUSCLES.map(m => {
              const s = muscleStatus[m]
              const c = muscleColor(s.daysAgo)
              return (
                <div key={m} className={`bodymap-muscle-row${hovering === m ? ' active' : ''}`}
                  onMouseEnter={() => setHovering(m)} onMouseLeave={() => setHovering(null)}>
                  <span className="bodymap-dot" style={{ background: c.fill }}></span>
                  <span className="bodymap-muscle-name">{MUSCLE_LABELS[m]}</span>
                  <span className="bodymap-muscle-ago">{c.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
