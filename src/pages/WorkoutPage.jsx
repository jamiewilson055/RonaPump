import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WorkoutTimer from '../components/WorkoutTimer'

function formatDesc(text) {
  return (text || '').split('\n').map((line, i) => {
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{line.slice(2)}</div>
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{line.slice(4)}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{line}</div>
  })
}

export default function WorkoutPage() {
  const { slug } = useParams()
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState(null)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')
  const [logRx, setLogRx] = useState(true)
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { loadWorkout() }, [slug])

  async function loadWorkout() {
    setLoading(true)
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .order('original_date', { ascending: false, nullsFirst: false })

    if (data) {
      const match = data.find(w => {
        if (!w.name) return false
        const wSlug = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        return wSlug === slug
      })
      const idMatch = !match ? data.find(w => w.legacy_id?.toString() === slug || w.id === slug) : null
      if (match) setWorkout(match)
      else if (idMatch) setWorkout(idMatch)
      else setNotFound(true)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  async function saveLog() {
    if (!session) return
    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: workout.id,
      completed_at: logDate,
      score: logScore.trim() || null,
      notes: logNotes.trim() || null,
      is_rx: logRx,
    })
    setLogged(true)
    setAddingLog(false)
    setLogScore('')
    setLogNotes('')
  }

  function shareWorkout() {
    const w = workout
    let text = ''
    if (w.name) text += w.name + '\n\n'
    text += w.description || ''
    if (w.estimated_duration_mins) text += `\n\n⏱ ${w.estimated_duration_mins} min`
    if (w.equipment?.filter(e => e !== 'Bodyweight').length) text += `\n🏋 ${w.equipment.filter(e => e !== 'Bodyweight').join(', ')}`
    text += `\n\n🦍 — RonaPump | ${window.location.href}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <div className="app"><div className="loading">Loading workout...</div></div>

  if (notFound) {
    return (
      <div className="app">
        <div className="wp-header"><Link to="/" className="wp-back">← Back to RonaPump</Link></div>
        <div className="pr-empty" style={{ marginTop: '20px' }}>
          <h3>Workout not found 🦍</h3>
          <p style={{ marginTop: '8px' }}>This workout may have been removed or the link is incorrect.</p>
          <Link to="/" className="ab p" style={{ display: 'inline-block', marginTop: '12px', textDecoration: 'none' }}>Browse All Workouts</Link>
        </div>
      </div>
    )
  }

  const w = workout
  const durDisplay = w.estimated_duration_mins
    ? `${w.estimated_duration_mins}m`
    : (w.estimated_duration_min && w.estimated_duration_max)
      ? `${w.estimated_duration_min}-${w.estimated_duration_max}m`
      : null

  return (
    <div className="app">
      <div className="wp-header">
        <Link to="/" className="wp-back">← Back to RonaPump</Link>
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}><b>RONA</b>PUMP</div>
      </div>

      <div className="wp-card">
        <div className="wp-title-row">
          <h1 className="wp-title">{w.name || 'Unnamed Workout'}</h1>
          {w.auto_named && <span className="auto-tag">auto</span>}
        </div>

        <div className="wp-meta">
          {durDisplay && <span className="wdr">{durDisplay}</span>}
          {w.score_type !== 'None' && <span className="wst">{w.score_type}</span>}
        </div>

        <div className="wp-tags">
          {w.equipment?.filter(q => q !== 'Bodyweight').map(q => <span key={q} className="tg te">{q}</span>)}
          {w.movement_categories?.filter(m => !['General', 'Cardio'].includes(m)).slice(0, 8).map(m => <span key={m} className="tg tm">{m}</span>)}
          {w.categories?.map(c => <span key={c} className="tg tc">{c}</span>)}
          {w.workout_types?.filter(t => t !== 'General').map(t => <span key={t} className="tg tw">{t}</span>)}
          {w.body_parts?.map(b => <span key={b} className="tg tb">{b}</span>)}
        </div>

        <div className="wp-desc">{formatDesc(w.description)}</div>

        <div className="wp-info">
          <span>Equipment: {w.equipment?.join(', ') || 'Bodyweight'}</span>
          {w.movement_categories?.length > 0 && <span>Movements: {w.movement_categories.join(', ')}</span>}
        </div>

        <div className="wp-actions">
          <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontSize: '14px', padding: '10px 20px' }}>▶ Start Workout</button>
          {session && (
            <button className="ab p" onClick={() => setAddingLog(!addingLog)}
              style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)', fontSize: '14px', padding: '10px 20px' }}>
              {logged ? '✓ Logged!' : addingLog ? 'Cancel' : '✓ Complete Workout'}
            </button>
          )}
          <button className="ab" onClick={shareWorkout}>{copied ? '✓ Copied!' : '↗ Share Text'}</button>
          <button className="ab" onClick={copyLink}>{copied ? '✓ Copied!' : '🔗 Copy Link'}</button>
        </div>

        {addingLog && session && (
          <div className="plog-form" style={{ marginTop: '10px' }}>
            <input placeholder="Score (optional)" value={logScore} onChange={e => setLogScore(e.target.value)} />
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
            <input placeholder="Notes (optional)" value={logNotes} onChange={e => setLogNotes(e.target.value)} />
            <label className="rx-toggle" title="Rx = prescribed weights/movements">
              <input type="checkbox" checked={logRx} onChange={e => setLogRx(e.target.checked)} />
              <span className={logRx ? 'rx-on' : 'rx-off'}>Rx</span>
            </label>
            <button className="ab p" onClick={saveLog}>Save</button>
          </div>
        )}

        {!session && (
          <div className="wp-cta">
            <p>Want to track your scores, build collections, and compete on the leaderboard?</p>
            <Link to="/" className="ab p" style={{ textDecoration: 'none', display: 'inline-block' }}>Join RonaPump 🦍</Link>
          </div>
        )}
      </div>

      <div className="wp-footer">
        <a href="https://www.instagram.com/ronapump/" target="_blank" rel="noopener noreferrer">📸 @ronapump</a>
        <span>•</span>
        <Link to="/">www.ronapump.com</Link>
      </div>

      {showTimer && <WorkoutTimer workout={w} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={() => { setLogged(true) }} />}
    </div>
  )
}
