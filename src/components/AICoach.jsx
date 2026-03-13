import { useState, useEffect } from 'react'
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

function daysAgo(dateStr) {
  if (!dateStr) return 999
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

export default function AICoach({ session, onAuthRequired, onWorkoutsChanged }) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function analyzeAndRecommend() {
    if (!session) { onAuthRequired(); return }
    setLoading(true)
    setError('')
    setRecommendation(null)
    setSaved(false)

    try {
      // 1. Gather user data
      const userId = session.user.id
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const [logsRes, prsRes, profileRes] = await Promise.all([
        supabase.from('performance_log')
          .select('completed_at, score, workouts(name, equipment, movement_categories, body_parts, workout_types, score_type)')
          .eq('user_id', userId)
          .gte('completed_at', weekAgo)
          .order('completed_at', { ascending: false })
          .limit(10),
        supabase.from('personal_records')
          .select('movement, weight, score, type')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('profiles')
          .select('display_name, gorilla_rank, xp')
          .eq('id', userId)
          .single(),
      ])

      const recentLogs = logsRes.data || []
      const prs = prsRes.data || []
      const profile = profileRes.data

      // 2. Compute muscle freshness
      const muscleLastTrained = {}
      ALL_MUSCLES.forEach(m => { muscleLastTrained[m] = 999 })

      recentLogs.forEach(log => {
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
          const d = daysAgo(log.completed_at)
          if (d < muscleLastTrained[m]) muscleLastTrained[m] = d
        })
      })

      const freshMuscles = ALL_MUSCLES.filter(m => muscleLastTrained[m] >= 3).map(m => m)
      const recentMuscles = ALL_MUSCLES.filter(m => muscleLastTrained[m] < 2).map(m => m)

      // 3. Most used equipment
      const eqCount = {}
      recentLogs.forEach(l => {
        ;(l.workouts?.equipment || []).forEach(e => { eqCount[e] = (eqCount[e] || 0) + 1 })
      })
      const topEquipment = Object.entries(eqCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])

      // 4. Recent workout types
      const typeCount = {}
      recentLogs.forEach(l => {
        ;(l.workouts?.workout_types || []).forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1 })
      })
      const recentTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(t => t[0])

      // 5. Compute streak
      const dates = new Set(recentLogs.map(l => l.completed_at))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 30; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        if (dates.has(ds)) streak++
        else if (i > 0) break
      }

      const recentWorkoutNames = recentLogs.slice(0, 5).map(l => l.workouts?.name).filter(Boolean)

      // Store analysis for display
      const analysisData = {
        recentLogs: recentLogs.length,
        freshMuscles,
        recentMuscles,
        topEquipment,
        recentTypes,
        streak,
        prs: prs.slice(0, 5),
        rank: profile?.gorilla_rank || 'Baby Gorilla',
        recentWorkoutNames,
      }
      setAnalysis(analysisData)

      // 6. Build prompt for AI
      const prompt = `You are an expert fitness coach for RonaPump. Analyze this athlete's data and recommend what they should do today.

ATHLETE DATA:
- Rank: ${analysisData.rank}
- Current streak: ${streak} days
- Workouts this week: ${recentLogs.length}
- Recent workouts: ${recentWorkoutNames.join(', ') || 'None'}
- Muscles that need work (3+ days rest): ${freshMuscles.join(', ') || 'All fresh'}
- Muscles recently trained (last 2 days): ${recentMuscles.join(', ') || 'None'}
- Favorite equipment: ${topEquipment.join(', ') || 'Bodyweight'}
- Recent workout types: ${recentTypes.join(', ') || 'Mixed'}
- Recent PRs: ${prs.slice(0, 3).map(p => `${p.movement}: ${p.score}${p.weight ? ' @ ' + p.weight : ''}`).join(', ') || 'None'}

Respond ONLY in valid JSON, no markdown, no backticks:
{
  "reasoning": "2-3 sentences explaining WHY you recommend this based on their muscle freshness, recent activity, and balance",
  "focus": "e.g. Upper Body Push, Lower Body, Full Body Conditioning",
  "intensity": "Light/Moderate/High/Max Effort",
  "workout": {
    "name": "Workout Name",
    "description": "Line 1\\n• Movement 1\\n• Movement 2",
    "score_type": "Time",
    "estimated_duration_mins": 20,
    "equipment": ["Bodyweight"],
    "workout_types": ["AMRAP"],
    "movement_categories": ["Push-Up", "Squat"],
    "body_parts": ["Upper Body"],
    "categories": []
  },
  "tips": ["Quick tip 1", "Quick tip 2"]
}`

      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch {
        setError('Failed to parse AI response')
        setLoading(false)
        return
      }

      if (data.error) { setError(data.error); setLoading(false); return }
      setRecommendation(data)
    } catch (err) {
      setError('Error: ' + (err.message || 'Please try again'))
    }
    setLoading(false)
  }

  async function saveWorkout() {
    if (!session || !recommendation?.workout) return
    const w = recommendation.workout
    const { error: err } = await supabase.from('workouts').insert({
      name: w.name,
      description: w.description,
      score_type: w.score_type || 'None',
      estimated_duration_mins: w.estimated_duration_mins || null,
      equipment: w.equipment || ['Bodyweight'],
      workout_types: w.workout_types || [],
      movement_categories: w.movement_categories || [],
      body_parts: w.body_parts || [],
      categories: w.categories || [],
      visibility: 'private',
      created_by: session.user.id,
      source: 'ai-coach',
    })
    if (err) { setError('Error saving: ' + err.message); return }
    setSaved(true)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  function renderBold(str) {
    const parts = str.split(/\*\*(.*?)\*\*/)
    if (parts.length === 1) return str
    return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
  }

  function formatDesc(text) {
    return (text || '').split('\n').map((line, i) => {
      if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
      if (line.trim() === '') return <br key={i} />
      return <div key={i}>{renderBold(line)}</div>
    })
  }

  return (
    <div className="coach-section">
      <div className="coach-hero">
        <div className="coach-hero-icon">🧠</div>
        <h2 className="coach-hero-title">AI Coach</h2>
        <p className="coach-hero-sub">I'll analyze your recent workouts, muscle recovery, PRs, and equipment to tell you exactly what to do today.</p>
      </div>

      {!recommendation && !loading && (
        <button className="coach-ask-btn" onClick={analyzeAndRecommend}>
          <span className="coach-ask-icon">🦍</span>
          <span>What Should I Do Today?</span>
        </button>
      )}

      {loading && (
        <div className="coach-loading">
          <div className="coach-loading-steps">
            <div className="coach-step active">📊 Analyzing your workout history...</div>
            <div className="coach-step">🦴 Checking muscle recovery...</div>
            <div className="coach-step">🏋️ Reviewing your equipment...</div>
            <div className="coach-step">🧠 Building your recommendation...</div>
          </div>
          <div className="ai-loading-spinner">🦍</div>
        </div>
      )}

      {error && <div className="coach-error">{error}</div>}

      {analysis && recommendation && (
        <div className="coach-result">
          {/* Analysis Summary */}
          <div className="coach-analysis">
            <div className="coach-analysis-title">📊 Your Analysis</div>
            <div className="coach-analysis-grid">
              <div className="coach-stat">
                <div className="coach-stat-n">{analysis.recentLogs}</div>
                <div className="coach-stat-l">This Week</div>
              </div>
              <div className="coach-stat">
                <div className="coach-stat-n">🔥{analysis.streak}</div>
                <div className="coach-stat-l">Streak</div>
              </div>
              <div className="coach-stat">
                <div className="coach-stat-n">{analysis.freshMuscles.length}</div>
                <div className="coach-stat-l">Fresh Muscles</div>
              </div>
            </div>
            {analysis.freshMuscles.length > 0 && (
              <div className="coach-fresh">
                <span className="coach-fresh-label">Needs work:</span>
                {analysis.freshMuscles.map(m => (
                  <span key={m} className="coach-fresh-tag">{m}</span>
                ))}
              </div>
            )}
            {analysis.recentMuscles.length > 0 && (
              <div className="coach-recent">
                <span className="coach-recent-label">Recently hit:</span>
                {analysis.recentMuscles.map(m => (
                  <span key={m} className="coach-recent-tag">{m}</span>
                ))}
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="coach-rec">
            <div className="coach-rec-header">
              <div className="coach-rec-label">🧠 Today's Recommendation</div>
              <div className="coach-rec-meta">
                <span className="coach-focus">{recommendation.focus}</span>
                <span className={`coach-intensity ${(recommendation.intensity || '').toLowerCase().replace(' ', '-')}`}>{recommendation.intensity}</span>
              </div>
            </div>

            <div className="coach-reasoning">{recommendation.reasoning}</div>

            {recommendation.workout && (
              <div className="coach-workout">
                <div className="coach-workout-name">{recommendation.workout.name}</div>
                <div className="coach-workout-meta">
                  {recommendation.workout.estimated_duration_mins && <span className="wdr">{recommendation.workout.estimated_duration_mins}m</span>}
                  {recommendation.workout.score_type && recommendation.workout.score_type !== 'None' && <span className="wst">{recommendation.workout.score_type}</span>}
                  {recommendation.workout.workout_types?.map(t => <span key={t} className="tg tw">{t}</span>)}
                </div>
                <div className="coach-workout-tags">
                  {recommendation.workout.equipment?.filter(e => e !== 'Bodyweight').map(e => <span key={e} className="tg te">{e}</span>)}
                  {recommendation.workout.body_parts?.map(b => <span key={b} className="tg tb">{b}</span>)}
                </div>
                <div className="coach-workout-desc">{formatDesc(recommendation.workout.description)}</div>
              </div>
            )}

            {recommendation.tips && recommendation.tips.length > 0 && (
              <div className="coach-tips">
                <div className="coach-tips-label">💡 Coach Tips</div>
                {recommendation.tips.map((tip, i) => (
                  <div key={i} className="coach-tip">{tip}</div>
                ))}
              </div>
            )}

            <div className="coach-actions">
              {!saved ? (
                <>
                  <button className="doc-start-btn" onClick={saveWorkout} style={{ fontSize: '14px' }}>💾 Save Workout</button>
                  <button className="doc-ctrl" style={{ width: '100%' }} onClick={analyzeAndRecommend}>🔄 Get Another Recommendation</button>
                </>
              ) : (
                <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '15px', textAlign: 'center', padding: '12px' }}>✓ Saved to My Workouts!</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
