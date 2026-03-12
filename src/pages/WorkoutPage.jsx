import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WorkoutTimer from '../components/WorkoutTimer'
import ShareImage from '../components/ShareImage'

function formatDesc(text) {
  function renderBold(str) {
    const parts = str.split(/\*\*(.*?)\*\*/)
    if (parts.length === 1) return str
    return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
  }
  return (text || '').split('\n').map((line, i) => {
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{renderBold(line.slice(4))}</div>
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
    if (line.startsWith('--- ')) return <div key={i} className="desc-section">{renderBold(line.slice(4))}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{renderBold(line)}</div>
  })
}

export default function WorkoutPage() {
  const { slug } = useParams()
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState(null)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')
  const [logRx, setLogRx] = useState(true)
  const [logged, setLogged] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [similar, setSimilar] = useState([])
  const [showSimilar, setShowSimilar] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadWorkout()
  }, [slug])

  useEffect(() => {
    if (session && workout) checkFavorite()
  }, [session, workout])

  async function loadWorkout() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workouts')
      .select('*, performance_log(*, profiles(display_name))')
      .order('completed_at', { referencedTable: 'performance_log', ascending: false })

    if (error || !data) { setNotFound(true); setLoading(false); return }

    const match = data.find(w => {
      if (!w.name) return false
      const s = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return s === slug
    })

    if (!match) { setNotFound(true); setLoading(false); return }
    setWorkout(match)

    // Find similar
    const sim = data.filter(w => w.id !== match.id && w.name && w.visibility === 'official').filter(w => {
      let score = 0
      if (match.equipment?.some(e => w.equipment?.includes(e))) score++
      if (match.workout_types?.some(t => w.workout_types?.includes(t))) score++
      if (match.movement_categories?.some(m => w.movement_categories?.includes(m))) score++
      if (match.body_parts?.some(b => w.body_parts?.includes(b))) score++
      return score >= 2
    }).slice(0, 5)
    setSimilar(sim)

    setLoading(false)
  }

  async function checkFavorite() {
    const { data } = await supabase.from('user_favorites').select('workout_id')
      .eq('user_id', session.user.id).eq('workout_id', workout.id).single()
    setIsFav(!!data)
  }

  async function toggleFavorite() {
    if (!session) return
    if (isFav) {
      await supabase.from('user_favorites').delete().eq('user_id', session.user.id).eq('workout_id', workout.id)
      setIsFav(false)
    } else {
      await supabase.from('user_favorites').insert({ user_id: session.user.id, workout_id: workout.id })
      setIsFav(true)
    }
  }

  async function saveLog() {
    if (!session || !workout) return
    await supabase.from('performance_log').insert({
      user_id: session.user.id, workout_id: workout.id,
      completed_at: logDate, score: logScore.trim() || null,
      notes: logNotes.trim() || null, is_rx: logRx,
    })
    setAddingLog(false); setLogScore(''); setLogNotes(''); setLogged(true)
  }

  function shareWorkout() {
    const text = `${workout.name}\n\n${workout.description?.slice(0, 200)}${workout.description?.length > 200 ? '...' : ''}\n\n🦍 ronapump.com`
    navigator.share?.({ title: workout.name, text }) || navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function remixWorkout() {
    // Navigate to home with remix intent
    window.location.href = '/?remix=' + workout.id
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
        </div>

        {/* Secondary actions */}
        <div className="wp-actions-secondary">
          {session && (
            <button className={`ab${isFav ? ' p' : ''}`} onClick={toggleFavorite}>
              {isFav ? '★ Favorited' : '☆ Favorite'}
            </button>
          )}
          <button className="ab" onClick={() => setShowShare(!showShare)}>📸 Instagram</button>
          <button className="ab" onClick={shareWorkout}>{copied ? '✓ Copied!' : '↗ Share'}</button>
          <button className="ab" onClick={copyLink}>🔗 Link</button>
          {session && w.created_by !== session.user.id && (
            <button className="ab" onClick={remixWorkout}>🔀 Remix</button>
          )}
          <button className="ab" onClick={() => setShowSimilar(!showSimilar)}>
            🔍 Similar {similar.length > 0 ? `(${similar.length})` : ''}
          </button>
        </div>

        {showShare && <ShareImage workout={w} />}

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

        {/* Leaderboard */}
        {w.performance_log?.length > 0 && (
          <div className="wp-leaderboard">
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', marginBottom: '8px' }}>Leaderboard</h4>
            <table className="plog-table">
              <thead><tr><th></th><th>Athlete</th><th>{w.score_type === 'Time' ? 'Time' : 'Score'}</th></tr></thead>
              <tbody>
                {w.performance_log
                  .filter(p => p.score)
                  .sort((a, b) => w.score_type === 'Time' ? (a.score || '').localeCompare(b.score || '') : (b.score || '').localeCompare(a.score || ''))
                  .slice(0, 10)
                  .map((p, i) => (
                    <tr key={p.id}>
                      <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</td>
                      <td>{p.profiles?.display_name || 'Anonymous'}</td>
                      <td>{p.score}{p.is_rx === true ? ' Rx' : p.is_rx === false ? ' Scaled' : ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Similar workouts */}
        {showSimilar && similar.length > 0 && (
          <div className="wp-similar">
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', marginBottom: '8px' }}>Similar Workouts</h4>
            {similar.map(s => {
              const sSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
              return (
                <Link key={s.id} to={`/workout/${sSlug}`} className="wp-similar-item" onClick={() => window.scrollTo(0, 0)}>
                  <span className="wp-similar-name">{s.name}</span>
                  <span className="wp-similar-meta">
                    {s.estimated_duration_mins && <span className="wdr">{s.estimated_duration_mins}m</span>}
                    {s.score_type !== 'None' && <span className="wst">{s.score_type}</span>}
                  </span>
                </Link>
              )
            })}
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
