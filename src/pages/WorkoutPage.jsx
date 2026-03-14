import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WorkoutTimer from '../components/WorkoutTimer'
import ShareImage from '../components/ShareImage'
import StoryCard from '../components/StoryCard'
import '../App.css'

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

function SimilarCard({ workout: s }) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState(s.description || null)

  useEffect(() => {
    if (open && !desc) {
      supabase.from('workouts').select('description').eq('id', s.id).single().then(({ data }) => {
        if (data) setDesc(data.description || '')
      })
    }
  }, [open, desc, s.id])

  return (
    <div className={`similar-card${open ? ' open' : ''}`}>
      <div className="similar-hd" onClick={() => setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name || 'Unnamed'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tx2)', marginTop: '2px' }}>
            {s.equipment?.filter(e => e !== 'Bodyweight').slice(0, 3).join(', ')}
            {s.estimated_duration_mins ? ` · ${s.estimated_duration_mins}m` : ''}
            {s.score_type && s.score_type !== 'None' ? ` · ${s.score_type}` : ''}
          </div>
        </div>
        <span style={{ color: 'var(--tx3)', fontSize: '10px', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="similar-body">
          <div className="dsc" style={{ fontSize: '12px', padding: '8px 0 4px' }}>{desc ? formatDesc(desc) : <span style={{ color: 'var(--tx3)' }}>Loading...</span>}</div>
          <div className="wtg" style={{ padding: '4px 0' }}>
            {s.equipment?.filter(q => q !== 'Bodyweight').map(q => <span key={q} className="tg te">{q}</span>)}
            {s.movement_categories?.filter(m => !['General', 'Cardio'].includes(m)).slice(0, 4).map(m => <span key={m} className="tg tm">{m}</span>)}
            {s.workout_types?.filter(t => t !== 'General').map(t => <span key={t} className="tg tw">{t}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkoutPage() {
  const { slug } = useParams()
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showShareImage, setShowShareImage] = useState(false)
  const [showStoryCard, setShowStoryCard] = useState(false)
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')
  const [logRx, setLogRx] = useState(true)
  const [lastLogScore, setLastLogScore] = useState(null)
  const [isFav, setIsFav] = useState(false)
  const [similar, setSimilar] = useState([])
  const [showSimilar, setShowSimilar] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [collections, setCollections] = useState([])
  const [editing, setEditing] = useState(false)
  const [remixing, setRemixing] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const isAdmin = profile?.is_admin || false

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    const { data: colls } = await supabase.from('user_collections').select('*').eq('user_id', userId).order('name')
    if (colls) setCollections(colls)
  }

  useEffect(() => { loadWorkout() }, [slug])
  useEffect(() => { if (session && workout) checkFavorite() }, [session, workout])

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
    const scoreVal = logScore.trim() || null
    await supabase.from('performance_log').insert({
      user_id: session.user.id, workout_id: workout.id,
      completed_at: logDate, score: scoreVal,
      notes: logNotes.trim() || null, is_rx: logRx,
    })
    setLastLogScore(scoreVal)
    setAddingLog(false); setLogScore(''); setLogNotes(''); setLogRx(true)
    setShowStoryCard(true)
    loadWorkout()
  }

  function copyLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    })
  }

  function startEdit() {
    setEditForm({
      name: workout.name || '', description: workout.description || '', score_type: workout.score_type || 'None',
      estimated_duration_mins: workout.estimated_duration_mins || '',
      equipment: [...(workout.equipment || [])], workout_types: [...(workout.workout_types || [])],
      categories: [...(workout.categories || [])], movement_categories: [...(workout.movement_categories || [])],
      body_parts: [...(workout.body_parts || [])],
    })
    setRemixing(false)
    setEditing(true)
  }

  function startRemix() {
    if (!session) return
    setEditForm({
      name: (workout.name || 'Unnamed') + ' (My Version)', description: workout.description || '', score_type: workout.score_type || 'None',
      estimated_duration_mins: workout.estimated_duration_mins || '',
      equipment: [...(workout.equipment || [])], workout_types: [...(workout.workout_types || [])],
      categories: [...(workout.categories || [])], movement_categories: [...(workout.movement_categories || [])],
      body_parts: [...(workout.body_parts || [])],
    })
    setRemixing(true)
    setEditing(true)
  }

  function toggleEditArray(field, val) {
    setEditForm(prev => {
      const arr = [...prev[field]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [field]: arr }
    })
  }

  async function saveEdit() {
    if (!editForm.description.trim()) { alert('Description is required.'); return }
    if (remixing) {
      const { error } = await supabase.from('workouts').insert({
        name: editForm.name.trim() || null, description: editForm.description.trim(), score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['For Time'],
        categories: editForm.categories, movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
        body_parts: editForm.body_parts || [], created_by: session.user.id, visibility: 'private', source: 'remix-of-' + workout.id,
      })
      if (error) { alert('Error saving: ' + error.message); return }
    } else {
      const { error } = await supabase.from('workouts').update({
        name: editForm.name.trim() || null, description: editForm.description.trim(), score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['General'],
        categories: editForm.categories, movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
        body_parts: editForm.body_parts || [], auto_named: false,
      }).eq('id', workout.id)
      if (error) { alert('Error saving: ' + error.message); return }
    }
    setEditing(false); setEditForm(null); setRemixing(false)
    loadWorkout()
  }

  async function deleteWorkout() {
    if (!confirm('Permanently delete this workout? This cannot be undone.')) return
    await supabase.from('workouts').delete().eq('id', workout.id)
    window.location.href = '/'
  }

  async function addToCollection(collId) {
    if (!session || !workout) return
    const { error } = await supabase.from('collection_workouts').insert({ collection_id: collId, workout_id: workout.id })
    if (error && error.code === '23505') { alert('Already in this collection!'); return }
    setShowCollections(false)
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
  const scoreLabel = w.score_type === 'Time' ? 'Time' : w.score_type === 'Rounds + Reps' ? 'Score' : w.score_type === 'Calories' ? 'Cals' : 'Result'

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

        {/* Performance Log */}
        <div className="plog">
          <div className="plog-hdr">
            <h4>Leaderboard {w.score_type !== 'None' && <span className="st-badge">{w.score_type}</span>}</h4>
            <span className="plog-add" onClick={() => { if (!session) return; setAddingLog(!addingLog) }}>{addingLog ? 'Cancel' : '+ Log Result'}</span>
          </div>
          {w.performance_log?.filter(p => p.score).length > 0 && (
            <table className="plog-table">
              <thead><tr><th>Athlete</th><th>Date</th><th>{scoreLabel}</th></tr></thead>
              <tbody>
                {w.performance_log
                  .filter(p => p.score)
                  .sort((a, b) => w.score_type === 'Time' ? (a.score || '').localeCompare(b.score || '') : (b.score || '').localeCompare(a.score || ''))
                  .slice(0, 10)
                  .map((p, i) => (
                    <tr key={p.id}>
                      <td className="lb-name">
                        {i === 0 && <span className="lb-medal">🥇</span>}
                        {i === 1 && <span className="lb-medal">🥈</span>}
                        {i === 2 && <span className="lb-medal">🥉</span>}
                        {p.profiles?.display_name || 'Anonymous'}
                      </td>
                      <td>{p.completed_at || '—'}</td>
                      <td>
                        {p.score}
                        {p.is_rx === true && <span className="rx-tag">Rx</span>}
                        {p.is_rx === false && <span className="scaled-tag">Scaled</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {addingLog && session && (
            <div className="plog-form" style={{ marginTop: '6px' }}>
              <input placeholder={`${scoreLabel} (optional)`} value={logScore} onChange={e => setLogScore(e.target.value)} />
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
              <input placeholder="Notes (optional)" value={logNotes} onChange={e => setLogNotes(e.target.value)} />
              <label className="rx-toggle" title="Rx = prescribed weights/movements">
                <input type="checkbox" checked={logRx} onChange={e => setLogRx(e.target.checked)} />
                <span className={logRx ? 'rx-on' : 'rx-off'}>Rx</span>
              </label>
              <button className="ab p" onClick={saveLog}>Save</button>
            </div>
          )}
        </div>

        {/* BUTTONS — identical order to WODCard and WorkoutCard:
            Start, Complete, Favorite, Save, Remix, Similar, Instagram, Story Card, Link, Edit (admin), Delete (admin) */}
        <div className="acts">
          <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontWeight: 600 }}>▶ Start Workout</button>
          <button className="ab p" onClick={() => { if (!session) return; setAddingLog(!addingLog) }} style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)' }}>{addingLog ? 'Cancel' : '✓ Complete Workout'}</button>
          <button className={`ab ${isFav ? '' : 'g'}`} onClick={toggleFavorite}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>
          <button className="ab" onClick={() => { if (!session) return; setShowCollections(!showCollections) }}>{showCollections ? 'Hide' : '📁 Save'}</button>
          <button className="ab" onClick={startRemix}>🔀 Remix</button>
          <button className="ab" onClick={() => setShowSimilar(!showSimilar)}>{showSimilar ? 'Hide Similar' : '≈ Similar'}</button>
          <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
          <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
          <button className="ab" onClick={copyLink}>{copied ? '✓ Copied!' : '🔗 Link'}</button>
          {isAdmin && <button className="ab p" onClick={startEdit}>Edit</button>}
          {isAdmin && <button className="ab del" onClick={deleteWorkout}>Delete</button>}
        </div>

        {/* Collections picker */}
        {showCollections && (
          <div className="coll-picker">
            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' }}>Add to collection:</div>
            {collections.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No collections yet. Create one from the Collections tab.</div>
            ) : collections.map(c => (
              <button key={c.id} className="ab" onClick={() => addToCollection(c.id)}>📁 {c.name}</button>
            ))}
          </div>
        )}

        {/* Similar workouts — expandable cards matching WODCard and WorkoutCard */}
        {showSimilar && (
          <div className="similar-section">
            <h4 style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', marginBottom: '6px' }}>Similar Workouts</h4>
            {similar.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No similar workouts found.</div>
            ) : similar.map(s => (
              <SimilarCard key={s.id} workout={s} />
            ))}
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

      {showTimer && <WorkoutTimer workout={w} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={loadWorkout} />}
      {showShareImage && <ShareImage workout={w} onClose={() => setShowShareImage(false)} />}
      {showStoryCard && <StoryCard workout={w} score={lastLogScore} session={session} onClose={() => setShowStoryCard(false)} />}

      {editing && editForm && (
        <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) { setEditing(false); setEditForm(null); setRemixing(false) } }}>
          <div className="mc">
            <h2>{remixing ? '🔀 Remix Workout' : 'Edit Workout'}</h2>
            {remixing && <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px', lineHeight: 1.5 }}>Modify this workout to fit your equipment or preferences. It'll be saved as a private copy.</div>}
            <label>Name</label>
            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. The Grind" />
            <label>Description / Details</label>
            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />
            <label>Score Type</label>
            <div className="st-sel">
              {['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None'].map(t => (
                <button key={t} className={`st-opt${editForm.score_type === t ? ' on' : ''}`} onClick={() => setEditForm({ ...editForm, score_type: t })}>{t}</button>
              ))}
            </div>
            <label>Duration (minutes)</label>
            <input type="number" value={editForm.estimated_duration_mins} onChange={e => setEditForm({ ...editForm, estimated_duration_mins: e.target.value })} placeholder="e.g. 30" />
            <label>Equipment</label>
            <div className="cr">
              {['Barbell', 'Bench', 'Bike (Assault/Echo)', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Speed Rope', 'Weighted Vest'].map(eq => (
                <button key={eq} className={`ch${editForm.equipment.includes(eq) ? ' on' : ''}`} onClick={() => toggleEditArray('equipment', eq)}>{eq}</button>
              ))}
            </div>
            <label>Workout Type</label>
            <div className="cr">
              {['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength'].map(t => (
                <button key={t} className={`ch${editForm.workout_types.includes(t) ? ' on' : ''}`} onClick={() => toggleEditArray('workout_types', t)}>{t}</button>
              ))}
            </div>
            <label>Category</label>
            <div className="cr">
              {['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home Gym', 'Hotel Workouts', 'HYROX', 'Murph', 'Outdoor', 'Track Workouts'].map(c => (
                <button key={c} className={`ch${editForm.categories.includes(c) ? ' on' : ''}`} onClick={() => toggleEditArray('categories', c)}>{c}</button>
              ))}
            </div>
            <label>Movement Type</label>
            <div className="cr">
              {['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat'].map(m => (
                <button key={m} className={`ch${editForm.movement_categories.includes(m) ? ' on' : ''}`} onClick={() => toggleEditArray('movement_categories', m)}>{m}</button>
              ))}
            </div>
            <label>Body Part</label>
            <div className="cr">
              {['Upper Body', 'Lower Body', 'Full Body'].map(b => (
                <button key={b} className={`ch${editForm.body_parts.includes(b) ? ' on' : ''}`} onClick={() => toggleEditArray('body_parts', b)}>{b}</button>
              ))}
            </div>
            <div className="mf">
              <button className="ab" onClick={() => { setEditing(false); setEditForm(null); setRemixing(false) }}>Cancel</button>
              <button className="ab p" onClick={saveEdit}>{remixing ? '🔀 Save My Version' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
