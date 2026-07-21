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
  'Thruster': ['quads', 'glutes', 'shoulders', 'triceps', 'core'],
  'Burpee': ['chest', 'quads', 'shoulders', 'core', 'calves'],
  'Jump': ['quads', 'calves', 'glutes'],
  'DB Snatch': ['shoulders', 'back', 'core', 'quads'],
  'Farmers Carry': ['core', 'back', 'shoulders', 'biceps'],
  'KB Swing': ['glutes', 'hamstrings', 'core', 'shoulders'],
  'Wall Ball': ['quads', 'glutes', 'shoulders', 'core'],
}

const BODYPART_TO_MUSCLES = {
  'Upper Body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  'Lower Body': ['quads', 'hamstrings', 'glutes', 'calves'],
  'Full Body': ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'],
}

const ALL_MUSCLES = ['shoulders', 'chest', 'biceps', 'triceps', 'core', 'back', 'quads', 'hamstrings', 'glutes', 'calves']

const INJURY_RE = /(pain|hurt|injur|sore|tweak|strain|pulled|pinch|ache|tight)/i

function daysAgo(dateStr) {
  if (!dateStr) return 999
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

function toSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AICoach({ session, onAuthRequired, onWorkoutsChanged }) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [libraryWorkout, setLibraryWorkout] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [userContext, setUserContext] = useState('')
  const [goal, setGoal] = useState('')
  const [goalSaved, setGoalSaved] = useState(false)

  // Prefill training goal from profile
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('training_goal').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.training_goal) setGoal(data.training_goal) })
  }, [session])

  async function saveGoal() {
    if (!session) { onAuthRequired(); return }
    const { error: err } = await supabase.from('profiles').update({ training_goal: goal || null }).eq('id', session.user.id)
    if (!err) { setGoalSaved(true); setTimeout(() => setGoalSaved(false), 2000) }
  }

  async function analyzeAndRecommend() {
    if (!session) { onAuthRequired(); return }
    setLoading(true)
    setError('')
    setRecommendation(null)
    setLibraryWorkout(null)
    setSaved(false)

    try {
      // 1. Gather 90 days of data
      const userId = session.user.id
      const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const [logsRes, prsRes, profileRes, longevityRes, libraryRes] = await Promise.all([
        supabase.from('performance_log')
          .select('completed_at, score, notes, is_rx, workouts(id, name, equipment, movement_categories, body_parts, workout_types, score_type)')
          .eq('user_id', userId)
          .gte('completed_at', ninetyAgo)
          .order('completed_at', { ascending: false })
          .limit(120),
        supabase.from('personal_records')
          .select('movement, weight, score, type, completed_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase.from('profiles')
          .select('display_name, gorilla_rank, xp, training_goal, age, gender, vital_age, longevity_index')
          .eq('id', userId)
          .single(),
        supabase.from('longevity_scores')
          .select('marker, value, unit, tested_at')
          .eq('user_id', userId)
          .order('tested_at', { ascending: false })
          .limit(40),
        supabase.from('workouts')
          .select('id, name, movement_categories, body_parts, equipment, workout_types, estimated_duration_mins, score_type')
          .in('visibility', ['official', 'community'])
          .limit(900),
      ])

      const logs = logsRes.data || []
      const prs = prsRes.data || []
      const profile = profileRes.data
      const longevityRaw = longevityRes.data || []
      const library = libraryRes.data || []

      // 2. Muscle freshness (7-day recovery window over full history)
      const muscleLastTrained = {}
      ALL_MUSCLES.forEach(m => { muscleLastTrained[m] = 999 })
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
          const d = daysAgo(log.completed_at)
          if (d < muscleLastTrained[m]) muscleLastTrained[m] = d
        })
      })
      const freshMuscles = ALL_MUSCLES.filter(m => muscleLastTrained[m] >= 3)
      const recentMuscles = ALL_MUSCLES.filter(m => muscleLastTrained[m] < 2)

      // 3. Weekly training load over last 8 weeks (unique training days per week)
      const weekDays = Array.from({ length: 8 }, () => new Set())
      logs.forEach(l => {
        const d = daysAgo(l.completed_at)
        const w = Math.floor(d / 7)
        if (w >= 0 && w < 8) weekDays[w].add(l.completed_at)
      })
      const weeklyLoad = weekDays.map((s, i) => `W-${i}: ${s.size}`).join(', ')

      // 4. Benchmark repeats — same workout logged 2+ times with scores
      const byName = {}
      logs.forEach(l => {
        const n = l.workouts?.name
        if (!n || !l.score) return
        if (!byName[n]) byName[n] = []
        byName[n].push(l)
      })
      const benchmarks = Object.entries(byName)
        .filter(([, arr]) => arr.length >= 2)
        .slice(0, 8)
        .map(([n, arr]) => {
          const sorted = [...arr].sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''))
          const first = sorted[0], last = sorted[sorted.length - 1]
          return `${n}: ${first.score} (${first.completed_at}) -> ${last.score} (${last.completed_at})`
        })

      // 5. Injury / limitation signals from notes (last 30 days)
      const injuryNotes = logs
        .filter(l => l.notes && INJURY_RE.test(l.notes) && daysAgo(l.completed_at) <= 30)
        .slice(0, 5)
        .map(l => `${l.completed_at}: ${l.notes.slice(0, 90)}`)

      // 6. Equipment + type usage
      const eqCount = {}
      logs.forEach(l => { (l.workouts?.equipment || []).forEach(e => { eqCount[e] = (eqCount[e] || 0) + 1 }) })
      const topEquipment = Object.entries(eqCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0])
      const typeCount = {}
      logs.forEach(l => { (l.workouts?.workout_types || []).forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1 }) })
      const recentTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(t => t[0])

      // 7. Streak
      const dates = new Set(logs.map(l => l.completed_at))
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 90; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        if (dates.has(ds)) streak++
        else if (i > 0) break
      }

      // 8. Latest longevity markers (dedupe by marker, newest first)
      const seenMarkers = new Set()
      const longevity = []
      longevityRaw.forEach(r => {
        if (seenMarkers.has(r.marker)) return
        seenMarkers.add(r.marker)
        longevity.push(`${r.marker}: ${r.value}${r.unit ? ' ' + r.unit : ''} (${r.tested_at})`)
      })

      // 9. Recent sessions (last 15, one line each)
      const recentSessions = logs.slice(0, 15).map(l => {
        const bits = [l.completed_at, l.workouts?.name || '?']
        if (l.score) bits.push(l.score)
        if (l.is_rx) bits.push('Rx')
        if (l.notes) bits.push('note: ' + l.notes.slice(0, 60))
        return bits.join(' | ')
      })

      // 10. Candidate library workouts — score by fresh-muscle fit + equipment, skip recently done
      const doneRecently = new Set(logs.filter(l => daysAgo(l.completed_at) <= 30).map(l => l.workouts?.name).filter(Boolean))
      const scored = library
        .filter(w => !doneRecently.has(w.name))
        .map(w => {
          let s = 0
          const muscles = new Set()
          ;(w.movement_categories || []).forEach(mc => (MOVEMENT_TO_MUSCLES[mc] || []).forEach(m => muscles.add(m)))
          ;(w.body_parts || []).forEach(bp => (BODYPART_TO_MUSCLES[bp] || []).forEach(m => muscles.add(m)))
          muscles.forEach(m => { if (freshMuscles.includes(m)) s += 2; if (recentMuscles.includes(m)) s -= 1 })
          ;(w.equipment || []).forEach(e => { if (topEquipment.includes(e)) s += 1 })
          return { w, s }
        })
        .sort((a, b) => b.s - a.s)
        .slice(0, 25)
        .map(({ w }) => w)

      const candidateLines = scored.map((w, i) =>
        `${i + 1}. ${w.name} | mv: ${(w.movement_categories || []).join('/') || 'none'} | ${(w.body_parts || []).join('/') || '?'} | ${(w.equipment || []).join('/') || '?'} | ${w.estimated_duration_mins ? w.estimated_duration_mins + 'min' : '?'} | ${w.score_type || '?'}`
      )

      const recentWorkoutNames = logs.slice(0, 5).map(l => l.workouts?.name).filter(Boolean)
      const thisWeekCount = logs.filter(l => daysAgo(l.completed_at) < 7).length

      const analysisData = {
        recentLogs: thisWeekCount,
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

      // 11. Build the deep coaching prompt
      const trainingGoal = (goal || profile?.training_goal || '').trim()
      const prompt = `You are the RonaPump AI Coach — an elite CrossFit/HYROX/functional fitness coach. Analyze this athlete's full data and recommend exactly what they should do today. Reason like a real coach: reference their trends, benchmark progress, recovery state, goal, and any limitations.

ATHLETE PROFILE:
- Rank: ${analysisData.rank} (${profile?.xp || 0} XP)${profile?.age ? `\n- Age: ${profile.age}` : ''}${profile?.gender ? `\n- Gender: ${profile.gender}` : ''}${trainingGoal ? `\n- Training goal: ${trainingGoal}` : ''}${profile?.vital_age ? `\n- Vital Age: ${profile.vital_age}` : ''}${profile?.longevity_index ? `\n- Longevity Index: ${profile.longevity_index}` : ''}

TRAINING LOAD (unique training days per week, W-0 = this week):
${weeklyLoad}
- Current streak: ${streak} days
- Sessions in last 90 days: ${logs.length}

MUSCLE RECOVERY:
- Fresh (3+ days rest): ${freshMuscles.join(', ') || 'none — all recently trained'}
- Recently trained (last 2 days): ${recentMuscles.join(', ') || 'none'}

RECENT SESSIONS (newest first):
${recentSessions.join('\n') || 'None logged'}

BENCHMARK PROGRESS (repeat workouts, first -> latest):
${benchmarks.join('\n') || 'No repeated benchmarks in window'}

RECENT PRS:
${prs.map(p => `${p.movement}: ${p.score || ''}${p.weight ? ' @ ' + p.weight : ''}${p.completed_at ? ' (' + p.completed_at + ')' : ''}`).join('\n') || 'None'}

LONGEVITY MARKERS (latest tests):
${longevity.join('\n') || 'None recorded'}

POSSIBLE INJURY / LIMITATION SIGNALS FROM WORKOUT NOTES:
${injuryNotes.join('\n') || 'None detected'}

ATHLETE'S NOTE TO COACH TODAY:
${userContext.trim() || 'None'}

CANDIDATE LIBRARY WORKOUTS (pre-filtered to fit their recovery + equipment):
${candidateLines.join('\n')}

INSTRUCTIONS:
1. Prefer recommending a CANDIDATE LIBRARY WORKOUT when one fits today's need well — the athlete gets leaderboards and history with library workouts. Copy its name VERBATIM into "library_pick" and set "source" to "library". Only generate a custom workout when no candidate fits the day's requirements (set "source" to "generated" and fill "workout").
2. The athlete's note to coach is the highest-priority constraint. Injury signals must be respected — never program movements that load a flagged area.
3. "reasoning" must be 4-6 sentences and cite SPECIFIC data: benchmark deltas, load trend across weeks, recovery state, goal relevance.
4. If longevity markers or training load suggest something worth flagging (e.g. deload, VO2 work, grip weakness), mention it in reasoning or tips.

Respond ONLY in valid JSON, no markdown, no backticks:
{
  "reasoning": "4-6 sentences citing their specific data",
  "focus": "e.g. Lower Body Power, Engine, Full Body Conditioning",
  "intensity": "Light/Moderate/High/Max Effort",
  "source": "library",
  "library_pick": "Exact Candidate Name or null",
  "workout": null,
  "tips": ["tip 1", "tip 2"],
  "cautions": []
}

If source is "generated", "workout" must be:
{"name":"...","description":"Line 1\\n• Movement 1\\n• Movement 2","score_type":"Time","estimated_duration_mins":20,"equipment":["Bodyweight"],"workout_types":["AMRAP"],"movement_categories":["Push-Up"],"body_parts":["Full Body"],"categories":[]}
Valid equipment: Air Bike, Barbell, Bench, Bodyweight, Box, Dumbbell, Kettlebell, Medicine Ball, Pull-Up Bar, Rower, Sandbag, Ski Erg, Sled, Jump Rope, Weighted Vest
Valid workout_types: AMRAP, EMOM, For Calories, For Distance, For Time, Interval, Ladder, Rounds, Strength
Valid movement_categories: Bench Press, Burpee, DB Snatch, Deadlift, Farmers Carry, Jump, KB Swing, Lunge, Pull-Up, Push-Up, Run, Shoulder Press, Squat, Thruster, Wall Ball
Valid body_parts: Upper Body, Lower Body, Full Body`

      const response = await fetch('/api/coach', {
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

      // Resolve library pick against real candidates (verbatim or case-insensitive)
      if (data.source === 'library' && data.library_pick) {
        const pickName = String(data.library_pick).trim().toLowerCase()
        const match = scored.find(w => w.name.trim().toLowerCase() === pickName)
        if (match) {
          const { data: full } = await supabase.from('workouts')
            .select('id, name, description, score_type, estimated_duration_mins, equipment, workout_types, movement_categories, body_parts')
            .eq('id', match.id)
            .single()
          if (full) setLibraryWorkout(full)
          else data.source = data.workout ? 'generated' : 'none'
        } else {
          // Hallucinated name — fall back to generated if present
          data.source = data.workout ? 'generated' : 'none'
        }
      }

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

  const ALL_EQUIPMENT = ['Air Bike', 'Barbell', 'Bench', 'Bodyweight', 'Box', 'Dumbbell', 'Jump Rope', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Weighted Vest']
  const ALL_TYPES = ['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength']
  const ALL_BODY_PARTS = ['Upper Body', 'Lower Body', 'Full Body']
  const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

  function startEdit() {
    const w = recommendation.workout
    setEditForm({
      name: w.name || '',
      description: w.description || '',
      score_type: w.score_type || 'None',
      estimated_duration_mins: w.estimated_duration_mins || '',
      equipment: w.equipment || ['Bodyweight'],
      workout_types: w.workout_types || [],
      body_parts: w.body_parts || [],
    })
    setEditing(true)
  }

  function toggleArr(field, val) {
    setEditForm(prev => {
      const arr = [...(prev[field] || [])]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [field]: arr }
    })
  }

  function applyEdit() {
    setRecommendation(prev => ({
      ...prev,
      workout: {
        ...prev.workout,
        name: editForm.name,
        description: editForm.description,
        score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types,
        body_parts: editForm.body_parts,
      }
    }))
    setEditing(false)
    setEditForm(null)
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

  function openLibraryWorkout() {
    if (!libraryWorkout) return
    window.location.href = '/workout/' + toSlug(libraryWorkout.name)
  }

  const shownWorkout = libraryWorkout || recommendation?.workout || null

  return (
    <div className="coach-section">
      <div className="coach-hero">
        <div className="coach-hero-icon">🧠</div>
        <h2 className="coach-hero-title">AI Coach</h2>
        <p className="coach-hero-sub">I'll analyze 90 days of your training — benchmark progress, muscle recovery, PRs, longevity markers, and your goal — then tell you exactly what to do today.</p>
      </div>

      {!recommendation && !loading && (
        <div>
          <label className="ai-edit-label">🎯 Training Goal (saved to your profile)</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input className="doc-suit-input" value={goal} placeholder="e.g. HYROX Worlds — Men's Pro, June 2026"
              onChange={e => setGoal(e.target.value)} style={{ flex: 1 }} />
            <button className="doc-ctrl" onClick={saveGoal}>{goalSaved ? '✓' : 'Save'}</button>
          </div>

          <label className="ai-edit-label">📝 Anything the coach should know today? (optional)</label>
          <textarea className="doc-suit-input" value={userContext}
            placeholder="e.g. shoulder is sore, hotel gym only, 40 minutes available…"
            onChange={e => setUserContext(e.target.value)}
            style={{ minHeight: '60px', marginBottom: '12px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, resize: 'vertical', width: '100%' }} />

          <button className="coach-ask-btn" onClick={analyzeAndRecommend}>
            <span className="coach-ask-icon">🦍</span>
            <span>What Should I Do Today?</span>
          </button>
        </div>
      )}

      {loading && (
        <div className="coach-loading">
          <div className="coach-loading-steps">
            <div className="coach-step active">📊 Reading 90 days of training history...</div>
            <div className="coach-step">📈 Tracking benchmark progress...</div>
            <div className="coach-step">🦴 Checking muscle recovery...</div>
            <div className="coach-step">🧬 Reviewing longevity markers...</div>
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

            {recommendation.cautions && recommendation.cautions.length > 0 && (
              <div style={{ borderLeft: '3px solid var(--acc)', padding: '8px 12px', margin: '10px 0', fontSize: '13.5px', color: 'var(--tx)', background: 'var(--s1)', borderRadius: '6px' }}>
                {recommendation.cautions.map((c, i) => <div key={i}>⚠️ {c}</div>)}
              </div>
            )}

            {shownWorkout && (
              <div className="coach-workout">
                {libraryWorkout && <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.4px', color: 'var(--acc)', marginBottom: '4px' }}>🦍 FROM THE RONAPUMP LIBRARY</div>}
                <div className="coach-workout-name">{shownWorkout.name}</div>
                <div className="coach-workout-meta">
                  {shownWorkout.estimated_duration_mins && <span className="wdr">{shownWorkout.estimated_duration_mins}m</span>}
                  {shownWorkout.score_type && shownWorkout.score_type !== 'None' && <span className="wst">{shownWorkout.score_type}</span>}
                  {shownWorkout.workout_types?.map(t => <span key={t} className="tg tw">{t}</span>)}
                </div>
                <div className="coach-workout-tags">
                  {shownWorkout.equipment?.filter(e => e !== 'Bodyweight').map(e => <span key={e} className="tg te">{e}</span>)}
                  {shownWorkout.body_parts?.map(b => <span key={b} className="tg tb">{b}</span>)}
                </div>
                <div className="coach-workout-desc">{formatDesc(shownWorkout.description)}</div>
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
              {libraryWorkout ? (
                <>
                  <button className="doc-start-btn" onClick={openLibraryWorkout} style={{ fontSize: '14px' }}>🚀 Open Workout</button>
                  <button className="doc-ctrl sec" style={{ width: '100%' }} onClick={analyzeAndRecommend}>🔄 Get Another Recommendation</button>
                </>
              ) : !saved && !editing && recommendation.workout ? (
                <>
                  <button className="doc-ctrl" style={{ width: '100%' }} onClick={startEdit}>✏️ Edit Before Saving</button>
                  <button className="doc-start-btn" onClick={saveWorkout} style={{ fontSize: '14px' }}>💾 Save Workout</button>
                  <button className="doc-ctrl sec" style={{ width: '100%' }} onClick={analyzeAndRecommend}>🔄 Get Another Recommendation</button>
                </>
              ) : saved ? (
                <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '15px', textAlign: 'center', padding: '12px' }}>✓ Saved to My Workouts!</div>
              ) : !recommendation.workout && !libraryWorkout ? (
                <button className="doc-ctrl sec" style={{ width: '100%' }} onClick={analyzeAndRecommend}>🔄 Get Another Recommendation</button>
              ) : null}
            </div>

            {/* Edit form (generated workouts only) */}
            {editing && editForm && (
              <div className="coach-edit" style={{ marginTop: '12px', borderTop: '1px solid var(--brd)', paddingTop: '12px' }}>
                <label className="ai-edit-label">Name</label>
                <input className="doc-suit-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ marginBottom: '8px' }} />

                <label className="ai-edit-label">Description</label>
                <textarea className="doc-suit-input" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ minHeight: '140px', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, resize: 'vertical' }} />

                <label className="ai-edit-label">Score Type</label>
                <div className="cr" style={{ marginBottom: '8px' }}>
                  {SCORE_TYPES.map(t => (
                    <button key={t} className={`ch${editForm.score_type === t ? ' on' : ''}`}
                      onClick={() => setEditForm({ ...editForm, score_type: t })}>{t}</button>
                  ))}
                </div>

                <label className="ai-edit-label">Duration (minutes)</label>
                <input type="number" className="doc-suit-input" value={editForm.estimated_duration_mins}
                  onChange={e => setEditForm({ ...editForm, estimated_duration_mins: e.target.value })}
                  placeholder="e.g. 20" style={{ width: '100px', marginBottom: '8px' }} />

                <label className="ai-edit-label">Equipment</label>
                <div className="cr" style={{ marginBottom: '8px' }}>
                  {ALL_EQUIPMENT.map(eq => (
                    <button key={eq} className={`ch${editForm.equipment.includes(eq) ? ' on' : ''}`}
                      onClick={() => toggleArr('equipment', eq)}>{eq}</button>
                  ))}
                </div>

                <label className="ai-edit-label">Workout Type</label>
                <div className="cr" style={{ marginBottom: '8px' }}>
                  {ALL_TYPES.map(t => (
                    <button key={t} className={`ch${editForm.workout_types.includes(t) ? ' on' : ''}`}
                      onClick={() => toggleArr('workout_types', t)}>{t}</button>
                  ))}
                </div>

                <label className="ai-edit-label">Body Part</label>
                <div className="cr" style={{ marginBottom: '12px' }}>
                  {ALL_BODY_PARTS.map(b => (
                    <button key={b} className={`ch${editForm.body_parts.includes(b) ? ' on' : ''}`}
                      onClick={() => toggleArr('body_parts', b)}>{b}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="doc-start-btn" onClick={applyEdit} style={{ fontSize: '14px', flex: 1 }}>✓ Apply Changes</button>
                  <button className="doc-ctrl" onClick={() => { setEditing(false); setEditForm(null) }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
