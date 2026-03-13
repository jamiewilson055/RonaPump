import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutTimer from './WorkoutTimer'
import WorkoutComments from './WorkoutComments'
import PublicProfile from '../pages/PublicProfile'
import { trackWorkoutView } from './SignupGate'
import ShareImage from './ShareImage'
import StoryCard from './StoryCard'

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

function cleanDesc(w) {
  let d = w.description || ''
  if (w.name) {
    const nm = w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const p1 = new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi')
    d = d.replace(p1, '')
    d = d.replace(/^\s*[\n\r]+/, '').replace(/^\s*[-:]\s*/, '')
  }
  // Clean stray braces and trailing whitespace
  d = d.replace(/[\{\}]/g, '').trim()
  return d
}

function formatDesc(text) {
  function renderBold(str) {
    const parts = str.split(/\*\*(.*?)\*\*/)
    if (parts.length === 1) return str
    return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
  }
  return text.split('\n').map((line, i) => {
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{renderBold(line.slice(4))}</div>
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
    if (line.startsWith('--- ')) return <div key={i} className="desc-section">{renderBold(line.slice(4))}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{renderBold(line)}</div>
  })
}

function bestScore(w) {
  const pl = w.performance_log || []
  if (!pl.length) return null
  if (w.score_type === 'Time') {
    return pl.reduce((b, e) => (!b || (e.score && e.score < b)) ? e.score : b, null)
  }
  return pl.reduce((b, e) => (!b || (e.score && e.score > b)) ? e.score : b, null)
}

function SimilarCard({ workout: s }) {
  const [open, setOpen] = useState(false)
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
          <div className="dsc" style={{ fontSize: '12px', padding: '8px 0 4px' }}>{formatDesc(s.description || '')}</div>
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

export default function WorkoutCard({ workout: w, isFav, toggleFavorite, session, isAdmin, onAuthRequired, onWorkoutsChanged, getSimilar, collections, onCollectionsChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [copied, setCopied] = useState(false)
  const [logSort, setLogSort] = useState('date') // date, score
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogForm, setEditLogForm] = useState(null)
  const [showSimilar, setShowSimilar] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [remixing, setRemixing] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [viewingProfile, setViewingProfile] = useState(null)
  const [logRx, setLogRx] = useState(true)
  const [showShareImage, setShowShareImage] = useState(false)
  const [showStoryCard, setShowStoryCard] = useState(false)
  const [lastLogScore, setLastLogScore] = useState(null)

  function shareWorkout() {
    let text = ''
    if (w.name) text += w.name + '\n\n'
    text += w.description || ''
    if (w.estimated_duration_mins) text += `\n\n⏱ ${w.estimated_duration_mins} min`
    else if (w.estimated_duration_min && w.estimated_duration_max) text += `\n\n⏱ ${w.estimated_duration_min}-${w.estimated_duration_max} min`
    if (w.equipment?.filter(e => e !== 'Bodyweight').length) text += `\n🏋 ${w.equipment.filter(e => e !== 'Bodyweight').join(', ')}`
    const slug = w.name ? w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : w.id
    text += `\n\n🦍 — RonaPump | www.ronapump.com/workout/${slug}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyLink() {
    const slug = w.name ? w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : w.id
    navigator.clipboard.writeText(`www.ronapump.com/workout/${slug}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasDone = w.my_log_count > 0
  const bs = bestScore(w)
  const pl = w.performance_log || []
  // Leaderboard shows all completions
  const leaderboardPl = pl.filter(p => p.notes !== 'Quick logged')
  const totalLoggers = new Set(leaderboardPl.map(p => p.user_id)).size

  // Sort performance logs: PR always on top, then by selected sort
  const sortedPl = useMemo(() => {
    const sorted = [...leaderboardPl]
    if (logSort === 'score') {
      if (w.score_type === 'Time') {
        sorted.sort((a, b) => (a.score || '').localeCompare(b.score || ''))
      } else {
        sorted.sort((a, b) => (b.score || '').localeCompare(a.score || ''))
      }
    } else {
      sorted.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    }
    // Move PR to top
    if (bs && sorted.length > 1) {
      const prIdx = sorted.findIndex(e => e.score === bs)
      if (prIdx > 0) {
        const [pr] = sorted.splice(prIdx, 1)
        sorted.unshift(pr)
      }
    }
    return sorted
  }, [leaderboardPl, logSort, bs, w.score_type])

  const scoreLabel = w.score_type === 'Time' ? 'Time' : w.score_type === 'Rounds + Reps' ? 'Score' : w.score_type === 'Calories' ? 'Cals' : w.score_type === 'Reps' ? 'Reps' : w.score_type === 'Distance' ? 'Distance' : w.score_type === 'Load' ? 'Weight' : 'Result'

  // Duration display
  const durDisplay = w.estimated_duration_mins
    ? `${w.estimated_duration_mins}m`
    : (w.estimated_duration_min && w.estimated_duration_max)
      ? `${w.estimated_duration_min}-${w.estimated_duration_max}m`
      : null

  async function addLog() {
    if (!session) { onAuthRequired(); return }
    const scoreVal = logScore.trim() || null
    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: w.id,
      completed_at: logDate,
      score: scoreVal,
      notes: logNotes.trim() || null,
      is_rx: logRx,
    })
    setLastLogScore(scoreVal)
    setAddingLog(false)
    setLogScore('')
    setLogNotes('')
    setLogRx(true)
    setShowStoryCard(true)
    onWorkoutsChanged()
  }

  async function deleteLog(logId) {
    if (!confirm('Delete this log entry?')) return
    await supabase.from('performance_log').delete().eq('id', logId)
    onWorkoutsChanged()
  }

  function startEditLog(entry) {
    setEditingLogId(entry.id)
    setEditLogForm({ score: entry.score || '', completed_at: entry.completed_at || '', notes: entry.notes || '' })
  }

  async function saveEditLog() {
    if (!editLogForm || !editingLogId) return
    await supabase.from('performance_log').update({
      score: editLogForm.score.trim() || null,
      completed_at: editLogForm.completed_at,
      notes: editLogForm.notes.trim() || null,
    }).eq('id', editingLogId)
    setEditingLogId(null)
    setEditLogForm(null)
    onWorkoutsChanged()
  }

  function startEdit() {
    setEditForm({
      name: w.name || '',
      description: w.description || '',
      score_type: w.score_type || 'None',
      estimated_duration_mins: w.estimated_duration_mins || '',
      estimated_duration_min: w.estimated_duration_min || '',
      estimated_duration_max: w.estimated_duration_max || '',
      equipment: [...(w.equipment || [])],
      workout_types: [...(w.workout_types || [])],
      categories: [...(w.categories || [])],
      movement_categories: [...(w.movement_categories || [])],
      body_parts: [...(w.body_parts || [])],
    })
    setRemixing(false)
    setEditing(true)
  }

  function startRemix() {
    if (!session) { onAuthRequired(); return }
    setEditForm({
      name: (w.name || 'Unnamed') + ' (My Version)',
      description: w.description || '',
      score_type: w.score_type || 'None',
      estimated_duration_mins: w.estimated_duration_mins || '',
      estimated_duration_min: w.estimated_duration_min || '',
      estimated_duration_max: w.estimated_duration_max || '',
      equipment: [...(w.equipment || [])],
      workout_types: [...(w.workout_types || [])],
      categories: [...(w.categories || [])],
      movement_categories: [...(w.movement_categories || [])],
      body_parts: [...(w.body_parts || [])],
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
      // Create a new private copy
      const { error } = await supabase.from('workouts').insert({
        name: editForm.name.trim() || null,
        description: editForm.description.trim(),
        score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        estimated_duration_min: editForm.estimated_duration_min ? parseInt(editForm.estimated_duration_min) : null,
        estimated_duration_max: editForm.estimated_duration_max ? parseInt(editForm.estimated_duration_max) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['For Time'],
        categories: editForm.categories,
        movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
        body_parts: editForm.body_parts || [],
        created_by: session.user.id,
        visibility: 'private',
        source: 'remix-of-' + w.id,
      })
      if (error) { alert('Error saving: ' + error.message); return }
    } else {
      // Normal edit (update in place)
      const { error } = await supabase
        .from('workouts')
        .update({
          name: editForm.name.trim() || null,
          description: editForm.description.trim(),
          score_type: editForm.score_type,
          estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
          estimated_duration_min: editForm.estimated_duration_min ? parseInt(editForm.estimated_duration_min) : null,
          estimated_duration_max: editForm.estimated_duration_max ? parseInt(editForm.estimated_duration_max) : null,
          equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
          workout_types: editForm.workout_types.length ? editForm.workout_types : ['General'],
          categories: editForm.categories,
          movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
          body_parts: editForm.body_parts || [],
          auto_named: false,
        })
        .eq('id', w.id)
      if (error) { alert('Error saving: ' + error.message); return }
    }

    setEditing(false)
    setEditForm(null)
    setRemixing(false)
    onWorkoutsChanged()
  }

  async function deleteWorkout() {
    const label = w.name ? `"${w.name}"` : 'this workout'
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return
    await supabase.from('workouts').delete().eq('id', w.id)
    onWorkoutsChanged()
  }

  return (
    <>
    <div className={`wc${expanded ? ' exp' : ''} wc-${w.visibility || 'official'}`} id={`wc-${w.id}`} onClick={(e) => {
      // Don't toggle if editing or any modal is open
      if (editing || addingLog || editingLogId || showCollections || showShareImage) return
      // Don't toggle if text is selected
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return
      // Don't toggle if click was on an interactive element inside expanded area
      if (expanded && e.target.closest('.det')) return
      if (!expanded && !session) trackWorkoutView()
      setExpanded(!expanded)
    }} style={{ cursor: 'pointer' }}>
      <div className="wc-top">
        <div className={`dot ${hasDone ? 'y' : 'n'}`}></div>
        <button className={`wf ${isFav ? 'y' : 'n'}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(w.id) }}>
          {isFav ? '★' : '☆'}
        </button>
        <div className={`wn${!w.name ? ' u' : ''}${w.auto_named ? ' auto' : ''}`}>
          {w.name || 'Unnamed Workout'}
          {w.auto_named && <span className="auto-tag">auto</span>}
          {w.visibility === 'official' && <span className="vis-tag official">🦍</span>}
          {w.visibility === 'community' && <span className="vis-tag community">👤</span>}
          {w.visibility === 'private' && <span className="vis-tag private">🔒</span>}
          {w.visibility === 'pending' && <span className="vis-tag pending">⏳</span>}
          {w.created_at && (Date.now() - new Date(w.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 && <span className="new-tag">NEW</span>}
        </div>
        {durDisplay && <span className="wdr">{durDisplay}</span>}
        {w.score_type !== 'None' && <span className="wst">{w.score_type}</span>}
        {bs && <span className="wbs">{bs}</span>}
        {w.original_date_display && <span className="wdt">{w.original_date_display}</span>}
      </div>

      <div className="wtg">
        {w.equipment?.filter(q => q !== 'Bodyweight').map(q => <span key={q} className="tg te">{q}</span>)}
        {w.movement_categories?.filter(m => !['General', 'Cardio'].includes(m)).slice(0, 6).map(m => <span key={m} className="tg tm">{m}</span>)}
        {w.categories?.map(c => <span key={c} className="tg tc">{c}</span>)}
        {w.workout_types?.filter(t => t !== 'General').map(t => <span key={t} className="tg tw">{t}</span>)}
      </div>

      {expanded && (
        <div className="det" onClick={e => e.stopPropagation()}>
          <div className="dsc">{formatDesc(cleanDesc(w))}</div>

          <div className="plog">
            <div className="plog-hdr">
              <h4>Leaderboard {w.score_type !== 'None' && <span className="st-badge">{w.score_type}</span>}
                {totalLoggers > 0 && <span className="st-badge" style={{ background: 'var(--grn-d)', color: 'var(--grn)' }}>{totalLoggers} athlete{totalLoggers !== 1 ? 's' : ''}</span>}
              </h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {leaderboardPl.length > 1 && (
                  <select className="ssel" value={logSort} onChange={e => setLogSort(e.target.value)} style={{ width: 'auto', fontSize: '10px', padding: '3px 6px' }}>
                    <option value="date">By Date</option>
                    <option value="score">By {w.score_type === 'Time' ? 'Time' : 'Score'}</option>
                  </select>
                )}
                <span className="plog-add" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }}>{addingLog ? 'Cancel' : '+ Log Result'}</span>
              </div>
            </div>
            {sortedPl.length > 0 && (
              <table className="plog-table">
                <thead><tr><th>Athlete</th><th>Date</th><th>{scoreLabel}</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {sortedPl.map((e, idx) => {
                    const isBest = e.score === bs && leaderboardPl.length > 1
                    const isEditingThis = editingLogId === e.id
                    const rank = logSort === 'score' ? idx + 1 : null

                    if (isEditingThis && editLogForm) {
                      return (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600, color: 'var(--tx2)', fontSize: '11px' }}>{e.display_name}</td>
                          <td><input type="date" value={editLogForm.completed_at} onChange={ev => setEditLogForm({ ...editLogForm, completed_at: ev.target.value })} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '3px', color: 'var(--tx)', padding: '2px 4px', fontSize: '11px', width: '100%' }} /></td>
                          <td><input value={editLogForm.score} onChange={ev => setEditLogForm({ ...editLogForm, score: ev.target.value })} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '3px', color: 'var(--tx)', padding: '2px 4px', fontSize: '11px', width: '100%' }} /></td>
                          <td><input value={editLogForm.notes} onChange={ev => setEditLogForm({ ...editLogForm, notes: ev.target.value })} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '3px', color: 'var(--tx)', padding: '2px 4px', fontSize: '11px', width: '100%' }} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="del-entry" onClick={saveEditLog} style={{ color: 'var(--grn)', marginRight: '4px' }}>✓</span>
                            <span className="del-entry" onClick={() => { setEditingLogId(null); setEditLogForm(null) }}>✕</span>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={e.id} className={e.is_mine ? 'my-log' : ''}>
                        <td className="lb-name">
                          {rank && isBest && <span className="lb-medal">🥇</span>}
                          {rank === 2 && <span className="lb-medal">🥈</span>}
                          {rank === 3 && <span className="lb-medal">🥉</span>}
                          <span className="lb-clickable" style={{ fontWeight: e.is_mine ? 700 : 500 }} onClick={(ev) => { ev.stopPropagation(); setViewingProfile(e.user_id) }}>{e.display_name}</span>
                        </td>
                        <td>{e.completed_at || '—'}</td>
                        <td className={isBest ? 'best' : ''}>
                          {e.score ? e.score : '✓'}{isBest ? ' ★' : ''}
                          {e.is_rx === false && <span className="scaled-tag">Scaled</span>}
                          {e.is_rx === true && e.score && <span className="rx-tag">Rx</span>}
                        </td>
                        <td style={{ fontFamily: "'DM Sans'", fontSize: '11px' }}>{e.notes || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {e.is_mine && <span className="del-entry" onClick={(ev) => { ev.stopPropagation(); startEditLog(e) }} style={{ marginRight: '4px' }} title="Edit">✎</span>}
                          {e.is_mine && <span className="del-entry" onClick={(ev) => { ev.stopPropagation(); deleteLog(e.id) }}>✕</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {addingLog && (
              <div className="plog-form">
                <input placeholder={`${scoreLabel} (optional)`} value={logScore} onChange={e => setLogScore(e.target.value)} />
                <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
                <input placeholder="Notes (optional)" value={logNotes} onChange={e => setLogNotes(e.target.value)} />
                <label className="rx-toggle" title="Rx = prescribed weights/movements">
                  <input type="checkbox" checked={logRx} onChange={e => setLogRx(e.target.checked)} />
                  <span className={logRx ? 'rx-on' : 'rx-off'}>Rx</span>
                </label>
                <button className="ab p" onClick={addLog}>Save</button>
              </div>
            )}
          </div>

          <div className="inf">
            <span>Equipment: {w.equipment?.join(', ')}</span>
            <span>Movements: {w.movement_categories?.join(', ')}</span>
            {w.body_parts?.length > 0 && <span>Focus: {w.body_parts.join(', ')}</span>}
          </div>

          <WorkoutComments workoutId={w.id} session={session} onAuthRequired={onAuthRequired} />

          <div className="acts">
            <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontWeight: 600 }}>▶ Start Workout</button>
            <button className="ab p" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }} style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)' }}>{addingLog ? 'Cancel' : '✓ Complete Workout'}</button>
            <button className={`ab ${isFav ? '' : 'g'}`} onClick={() => toggleFavorite(w.id)}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>
            <button className="ab" onClick={() => { if (!session) { onAuthRequired(); return } setShowCollections(!showCollections) }}>{showCollections ? 'Hide' : '📁 Save'}</button>
            {session && w.created_by !== session?.user?.id && (
              <button className="ab" onClick={startRemix}>🔀 Remix</button>
            )}
            <button className="ab" onClick={() => setShowSimilar(!showSimilar)}>{showSimilar ? 'Hide Similar' : '≈ Similar'}</button>
            <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
            <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
            <button className="ab" onClick={copyLink}>🔗 Link</button>
            {isAdmin && <button className="ab p" onClick={startEdit}>Edit</button>}
            {isAdmin && <button className="ab del" onClick={deleteWorkout}>Delete</button>}
            {!isAdmin && w.created_by === session?.user?.id && w.visibility === 'private' && (
              <>
                <button className="ab" onClick={startEdit}>Edit</button>
                <button className="ab del" onClick={deleteWorkout}>Delete</button>
              </>
            )}
            {!isAdmin && w.visibility === 'private' && w.created_by === session?.user?.id && (
              <button className="ab p" onClick={async () => {
                await supabase.from('workouts').update({ visibility: 'pending', submitted_at: new Date().toISOString() }).eq('id', w.id)
                onWorkoutsChanged()
              }}>📤 Submit to Community</button>
            )}
            {!isAdmin && w.visibility === 'pending' && w.created_by === session?.user?.id && (
              <span style={{ fontSize: '11px', color: 'var(--ylw)', padding: '4px 0' }}>⏳ Pending review</span>
            )}
          </div>

          {showCollections && collections && (
            <div className="coll-picker">
              <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' }}>Add to collection:</div>
              {collections.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No collections yet. Create one from the Collections tab.</div>
              ) : (
                collections.map(c => (
                  <button key={c.id} className="coll-opt" onClick={async () => {
                    const { supabase } = await import('../lib/supabase')
                    const { error } = await supabase.from('collection_workouts').insert({
                      collection_id: c.id, workout_id: w.id
                    })
                    if (error && error.code === '23505') {
                      alert('Already in this collection!')
                    } else if (error) {
                      alert('Error: ' + error.message)
                    } else {
                      setShowCollections(false)
                      if (onCollectionsChanged) onCollectionsChanged()
                    }
                  }}>📁 {c.name}</button>
                ))
              )}
            </div>
          )}

          {showSimilar && getSimilar && (
            <div className="similar-section">
              <h4 style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', marginBottom: '6px' }}>Similar Workouts</h4>
              {getSimilar(w).length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No similar workouts found.</div>
              ) : (
                getSimilar(w).map(s => (
                  <SimilarCard key={s.id} workout={s} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {editing && editForm && (
      <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) { setEditing(false); setEditForm(null); setRemixing(false) } }}>
        <div className="mc">
          <h2>{remixing ? '🔀 Remix Workout' : 'Edit Workout'}</h2>
          {remixing && (
            <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px', lineHeight: 1.5 }}>
              Modify this workout to fit your equipment or preferences. It'll be saved as a private copy in My Workouts.
            </div>
          )}
          <label>Name</label>
          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. The Grind" />

          <label>Description / Details</label>
          <div className="fmt-bar">
            <button type="button" className="fmt-btn" onClick={() => {
              const ta = document.getElementById('wk-edit-desc')
              if (!ta) return
              const start = ta.selectionStart
              const before = editForm.description.slice(0, start)
              const after = editForm.description.slice(start)
              const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
              setEditForm({ ...editForm, description: before + nl + '• ' + after })
              setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 2 }, 0)
            }}>• Bullet</button>
            <button type="button" className="fmt-btn" onClick={() => {
              const ta = document.getElementById('wk-edit-desc')
              if (!ta) return
              const start = ta.selectionStart
              const before = editForm.description.slice(0, start)
              const after = editForm.description.slice(start)
              const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
              setEditForm({ ...editForm, description: before + nl + '  • ' + after })
              setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 4 }, 0)
            }}>  ◦ Sub-bullet</button>
            <button type="button" className="fmt-btn" onClick={() => {
              const ta = document.getElementById('wk-edit-desc')
              if (!ta) return
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const selected = editForm.description.slice(start, end)
              if (selected) {
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(end)
                setEditForm({ ...editForm, description: before + '**' + selected + '**' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = start; ta.selectionEnd = end + 4 }, 0)
              } else {
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(start)
                setEditForm({ ...editForm, description: before + '****' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + 2 }, 0)
              }
            }}><b>B</b> Bold</button>
            <button type="button" className="fmt-btn" onClick={() => {
              const ta = document.getElementById('wk-edit-desc')
              if (!ta) return
              const start = ta.selectionStart
              const before = editForm.description.slice(0, start)
              const after = editForm.description.slice(start)
              const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
              setEditForm({ ...editForm, description: before + nl + '--- ' + after })
              setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 4 }, 0)
            }}>— Section</button>
          </div>
          <textarea id="wk-edit-desc" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />

          <label>Score Type</label>
          <div className="st-sel">
            {SCORE_TYPES.map(t => (
              <button key={t} className={`st-opt${editForm.score_type === t ? ' on' : ''}`}
                onClick={() => setEditForm({ ...editForm, score_type: t })}>{t}</button>
            ))}
          </div>

          <label>Duration (exact minutes, if known)</label>
          <input type="number" value={editForm.estimated_duration_mins} onChange={e => setEditForm({ ...editForm, estimated_duration_mins: e.target.value })} placeholder="e.g. 30" />

          <label>Duration Range (if exact is unknown)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" value={editForm.estimated_duration_min} onChange={e => setEditForm({ ...editForm, estimated_duration_min: e.target.value })} placeholder="Min" style={{ width: '80px' }} />
            <span style={{ color: 'var(--tx3)' }}>–</span>
            <input type="number" value={editForm.estimated_duration_max} onChange={e => setEditForm({ ...editForm, estimated_duration_max: e.target.value })} placeholder="Max" style={{ width: '80px' }} />
            <span style={{ color: 'var(--tx3)', fontSize: '12px' }}>minutes</span>
          </div>

          <label>Equipment</label>
          <div className="cr">
            {['Barbell', 'Bench', 'Bike (Assault/Echo)', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Speed Rope', 'Weighted Vest'].map(eq => (
              <button key={eq} className={`ch${editForm.equipment.includes(eq) ? ' on' : ''}`}
                onClick={() => toggleEditArray('equipment', eq)}>{eq}</button>
            ))}
          </div>

          <label>Workout Type</label>
          <div className="cr">
            {['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength'].map(t => (
              <button key={t} className={`ch${editForm.workout_types.includes(t) ? ' on' : ''}`}
                onClick={() => toggleEditArray('workout_types', t)}>{t}</button>
            ))}
          </div>

          <label>Category</label>
          <div className="cr">
            {['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home Gym', 'Hotel Workouts', 'HYROX', 'Murph', 'Outdoor', 'Track Workouts'].map(c => (
              <button key={c} className={`ch${editForm.categories.includes(c) ? ' on' : ''}`}
                onClick={() => toggleEditArray('categories', c)}>{c}</button>
            ))}
          </div>

          <label>Movement Type</label>
          <div className="cr">
            {['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat'].map(m => (
              <button key={m} className={`ch${editForm.movement_categories.includes(m) ? ' on' : ''}`}
                onClick={() => toggleEditArray('movement_categories', m)}>{m}</button>
            ))}
          </div>

          <label>Body Part</label>
          <div className="cr">
            {['Upper Body', 'Lower Body', 'Full Body'].map(b => (
              <button key={b} className={`ch${editForm.body_parts.includes(b) ? ' on' : ''}`}
                onClick={() => toggleEditArray('body_parts', b)}>{b}</button>
            ))}
          </div>

          <div className="mf">
            <button className="ab" onClick={() => { setEditing(false); setEditForm(null); setRemixing(false) }}>Cancel</button>
            <button className="ab p" onClick={saveEdit}>{remixing ? '🔀 Save My Version' : 'Save'}</button>
          </div>
        </div>
      </div>
    )}

    {showTimer && <WorkoutTimer workout={w} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={onWorkoutsChanged} />}
    {viewingProfile && <PublicProfile userId={viewingProfile} onClose={() => setViewingProfile(null)} session={session} />}
    {showShareImage && <ShareImage workout={w} onClose={() => setShowShareImage(false)} />}
    {showStoryCard && <StoryCard workout={w} score={lastLogScore} session={session} onClose={() => setShowStoryCard(false)} />}
    </>
  )
}
