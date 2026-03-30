import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutTimer from './WorkoutTimer'
import ShareImage from './ShareImage'
import StoryCard from './StoryCard'

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

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

function bestScore(w) {
  const pl = w.performance_log || []
  if (!pl.length) return null
  if (w.score_type === 'Time') {
    return pl.reduce((b, e) => (!b || (e.score && e.score < b)) ? e.score : b, null)
  }
  return pl.reduce((b, e) => (!b || (e.score && e.score > b)) ? e.score : b, null)
}

export default function WODCard({ workouts, session, onAuthRequired, onWorkoutsChanged, favorites, toggleFavorite, isAdmin, collections, onCollectionsChanged }) {
  const [wod, setWod] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [copied, setCopied] = useState(false)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')
  const [logRx, setLogRx] = useState(true)
  const [showShareImage, setShowShareImage] = useState(false)
  const [showStoryCard, setShowStoryCard] = useState(false)
  const [lastLogScore, setLastLogScore] = useState(null)
  const [showCollections, setShowCollections] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)
  const [similarResults, setSimilarResults] = useState([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [remixing, setRemixing] = useState(false)
  const [loadedCollections, setLoadedCollections] = useState(null)
  const [logSort, setLogSort] = useState('date')
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogForm, setEditLogForm] = useState(null)

  const pick = useCallback(() => {
    const pool = workouts.filter(w => w.description && w.description.length > 40 && w.visibility !== 'private')
    if (pool.length) setWod(pool[Math.floor(Math.random() * pool.length)])
  }, [workouts])

  useEffect(() => {
    if (workouts.length && !wod) pick()
  }, [workouts, wod, pick])

  // Sync local wod with refreshed workouts data
  useEffect(() => {
    if (wod && workouts.length) {
      const fresh = workouts.find(w => w.id === wod.id)
      if (fresh && fresh !== wod) setWod(fresh)
    }
  }, [workouts])

  function handleShuffle(e) {
    e.stopPropagation()
    e.preventDefault()
    setSpinning(true)
    setExpanded(false)
    pick()
    setTimeout(() => setSpinning(false), 400)
  }

  function shareWorkout() {
    if (!wod) return
    let text = ''
    if (wod.name) text += wod.name + '\n\n'
    text += wod.description || ''
    if (wod.estimated_duration_mins) text += `\n\n⏱ ${wod.estimated_duration_mins} min`
    if (wod.equipment?.filter(e => e !== 'Bodyweight').length) text += `\n🏋 ${wod.equipment.filter(e => e !== 'Bodyweight').join(', ')}`
    text += '\n\n🦍 — RonaPump | www.ronapump.com'
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function addLog() {
    if (!session) { onAuthRequired(); return }
    if (!logScore.trim()) return
    const scoreVal = logScore.trim()
    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: wod.id,
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
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  function startEditLog(entry) {
    setEditingLogId(entry.id)
    setEditLogForm({ score: entry.score || '', completed_at: entry.completed_at || '', notes: entry.notes || '', is_rx: entry.is_rx !== false })
  }

  async function saveEditLog() {
    if (!editLogForm || !editingLogId) return
    await supabase.from('performance_log').update({
      score: editLogForm.score.trim() || null,
      completed_at: editLogForm.completed_at,
      notes: editLogForm.notes.trim() || null,
      is_rx: editLogForm.is_rx,
    }).eq('id', editingLogId)
    setEditingLogId(null)
    setEditLogForm(null)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  async function deleteLog(logId) {
    if (!confirm('Delete this log entry?')) return
    await supabase.from('performance_log').delete().eq('id', logId)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  function copyLink() {
    if (!wod) return
    const slug = (wod.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    navigator.clipboard.writeText(`https://www.ronapump.com/workout/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function findSimilar() {
    if (!wod || !workouts) return
    setShowSimilar(!showSimilar)
    if (showSimilar) return
    const eq = new Set(wod.equipment || [])
    const types = new Set(wod.workout_types || [])
    const results = workouts.filter(w => w.id !== wod.id && w.visibility !== 'private').map(w => {
      let score = 0
      ;(w.equipment || []).forEach(e => { if (eq.has(e)) score += 2 })
      ;(w.workout_types || []).forEach(t => { if (types.has(t)) score += 3 })
      if (w.body_parts?.some(b => (wod.body_parts || []).includes(b))) score += 2
      return { ...w, matchScore: score }
    }).filter(w => w.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore).slice(0, 4)
    setSimilarResults(results)
  }

  async function addToCollection(collId) {
    if (!session || !wod) return
    await supabase.from('collection_workouts').insert({ collection_id: collId, workout_id: wod.id })
    if (onCollectionsChanged) onCollectionsChanged()
    setShowCollections(false)
  }

  function startEdit() {
    setEditForm({
      name: wod.name || '',
      description: wod.description || '',
      score_type: wod.score_type || 'None',
      estimated_duration_mins: wod.estimated_duration_mins || '',
      estimated_duration_min: wod.estimated_duration_min || '',
      estimated_duration_max: wod.estimated_duration_max || '',
      equipment: [...(wod.equipment || [])],
      workout_types: [...(wod.workout_types || [])],
      categories: [...(wod.categories || [])],
      movement_categories: [...(wod.movement_categories || [])],
      body_parts: [...(wod.body_parts || [])],
    })
    setRemixing(false)
    setEditing(true)
  }

  function startRemix() {
    if (!session) { onAuthRequired(); return }
    setEditForm({
      name: (wod.name || 'Unnamed') + ' (My Version)',
      description: wod.description || '',
      score_type: wod.score_type || 'None',
      estimated_duration_mins: wod.estimated_duration_mins || '',
      estimated_duration_min: wod.estimated_duration_min || '',
      estimated_duration_max: wod.estimated_duration_max || '',
      equipment: [...(wod.equipment || [])],
      workout_types: [...(wod.workout_types || [])],
      categories: [...(wod.categories || [])],
      movement_categories: [...(wod.movement_categories || [])],
      body_parts: [...(wod.body_parts || [])],
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
        source: 'remix-of-' + wod.id,
      })
      if (error) { alert('Error saving: ' + error.message); return }
    } else {
      const { error } = await supabase.from('workouts').update({
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
      }).eq('id', wod.id)
      if (error) { alert('Error saving: ' + error.message); return }
    }
    setEditing(false)
    setEditForm(null)
    setRemixing(false)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  async function deleteWorkout() {
    if (!confirm('Delete this workout?')) return
    await supabase.from('workouts').delete().eq('id', wod.id)
    if (onWorkoutsChanged) onWorkoutsChanged()
    pick()
  }

  if (!wod) return null

  const isFav = favorites?.has(wod.id)
  const pl = wod.performance_log || []
  const bs = bestScore(wod)
  const leaderboardPl = pl.filter(p => p.notes !== 'Quick logged')
  const totalLoggers = new Set(leaderboardPl.map(p => p.user_id)).size
  const scoreLabel = wod.score_type === 'Time' ? 'Time' : wod.score_type === 'Rounds + Reps' ? 'Score' : wod.score_type === 'Calories' ? 'Cals' : wod.score_type === 'Reps' ? 'Reps' : wod.score_type === 'Distance' ? 'Distance' : wod.score_type === 'Load' ? 'Weight' : 'Result'

  const sortedPl = (() => {
    const sorted = [...leaderboardPl]
    if (logSort === 'score') {
      if (wod.score_type === 'Time') {
        sorted.sort((a, b) => (a.score || '').localeCompare(b.score || ''))
      } else {
        sorted.sort((a, b) => (b.score || '').localeCompare(a.score || ''))
      }
    } else {
      sorted.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    }
    if (bs && sorted.length > 1) {
      const prIdx = sorted.findIndex(e => e.score === bs)
      if (prIdx > 0) {
        const [pr] = sorted.splice(prIdx, 1)
        sorted.unshift(pr)
      }
    }
    return sorted
  })()

  return (
    <>
      <div className={`wod-card${expanded ? ' wod-exp' : ''}`} onMouseDown={(e) => { e._clickX = e.clientX; e._clickY = e.clientY }} onClick={(e) => {
        if (e._clickX !== undefined && (Math.abs(e.clientX - e._clickX) > 5 || Math.abs(e.clientY - e._clickY) > 5)) return
        const sel = window.getSelection()
        if (sel && sel.toString().length > 0) return
        setExpanded(!expanded)
      }} style={{ cursor: 'pointer' }}>
        <div className="wod-top">
          <div className="wod-label-inline">WOD</div>
          <div className="wod-name">{wod.name || 'Unnamed Workout'}</div>
          {wod.estimated_duration_mins && <span className="wdr">{wod.estimated_duration_mins}m</span>}
          <button
            className={`wod-roll${spinning ? ' spin' : ''}`}
            onClick={handleShuffle}
            onTouchEnd={(e) => { e.preventDefault(); handleShuffle(e) }}
            title="Shuffle"
          >↻</button>
        </div>

        {!expanded && (
          <>
            <div className="wod-desc">{wod.description?.slice(0, 140)}{wod.description?.length > 140 ? '...' : ''}</div>
            <div className="wod-tags">
              {wod.equipment?.filter(q => q !== 'Bodyweight').slice(0, 4).map(q => <span key={q} className="tg te">{q}</span>)}
              {wod.workout_types?.filter(t => t !== 'General').slice(0, 3).map(t => <span key={t} className="tg tw">{t}</span>)}
            </div>
          </>
        )}

        {expanded && (
          <div className="det" onClick={e => e.stopPropagation()}>
            <div className="dsc">{formatDesc(wod.description)}</div>

            <div className="wtg" style={{ padding: '4px 0 8px' }}>
              {wod.equipment?.filter(q => q !== 'Bodyweight').map(q => <span key={q} className="tg te">{q}</span>)}
              {wod.movement_categories?.filter(m => !['General', 'Cardio'].includes(m)).slice(0, 6).map(m => <span key={m} className="tg tm">{m}</span>)}
              {wod.categories?.map(c => <span key={c} className="tg tc">{c}</span>)}
              {wod.workout_types?.filter(t => t !== 'General').map(t => <span key={t} className="tg tw">{t}</span>)}
            </div>

            {/* Leaderboard — matches WorkoutCard */}
            <div className="plog">
              <div className="plog-hdr">
                <h4>Leaderboard {wod.score_type !== 'None' && <span className="st-badge">{wod.score_type}</span>}
                  {totalLoggers > 0 && <span className="st-badge" style={{ background: 'var(--grn-d)', color: 'var(--grn)' }}>{totalLoggers} athlete{totalLoggers !== 1 ? 's' : ''}</span>}
                </h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {leaderboardPl.length > 1 && (
                    <select className="ssel" value={logSort} onChange={e => setLogSort(e.target.value)} style={{ width: 'auto', fontSize: '10px', padding: '3px 6px' }}>
                      <option value="date">By Date</option>
                      <option value="score">By {wod.score_type === 'Time' ? 'Time' : 'Score'}</option>
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
                              <label className="rx-toggle" style={{ fontSize: '10px', gap: '2px', marginRight: '6px' }}>
                                <input type="checkbox" checked={editLogForm.is_rx} onChange={ev => setEditLogForm({ ...editLogForm, is_rx: ev.target.checked })} />
                                <span className={editLogForm.is_rx ? 'rx-on' : 'rx-off'}>Rx</span>
                              </label>
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
                            <span style={{ fontWeight: e.is_mine ? 700 : 500 }}>{e.display_name}</span>
                          </td>
                          <td>{e.completed_at || '—'}</td>
                          <td className={isBest ? 'best' : ''}>
                            {e.score ? e.score : '✓'}{isBest ? ' ★' : ''}
                            {e.is_rx === false && <span className="scaled-tag">Scaled</span>}
                            {e.is_rx === true && e.score && <span className="rx-tag">Rx</span>}
                          </td>
                          <td style={{ fontFamily: "'DM Sans'", fontSize: '11px' }}>{e.notes || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {(e.is_mine || isAdmin) && <span className="del-entry" onClick={(ev) => { ev.stopPropagation(); startEditLog(e) }} style={{ marginRight: '4px' }} title="Edit">✎</span>}
                            {(e.is_mine || isAdmin) && <span className="del-entry" onClick={(ev) => { ev.stopPropagation(); deleteLog(e.id) }}>✕</span>}
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

            <div className="acts">
              <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontWeight: 600 }}>▶ Start Workout</button>
              <button className="ab p" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }} style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)' }}>{addingLog ? 'Cancel' : '✓ Complete Workout'}</button>
              {toggleFavorite && <button className={`ab ${isFav ? '' : 'g'}`} onClick={() => toggleFavorite(wod.id)}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>}
              <button className="ab" onClick={async () => {
                if (!session) { onAuthRequired(); return }
                if (showCollections) { setShowCollections(false); return }
                if (collections) { setLoadedCollections(collections) }
                else {
                  const { data } = await supabase.from('user_collections').select('*').eq('user_id', session.user.id).order('name')
                  setLoadedCollections(data || [])
                }
                setShowCollections(true)
              }}>{showCollections ? 'Hide' : '📁 Save'}</button>
              <button className="ab" onClick={startRemix}>🔀 Remix</button>
              <button className="ab" onClick={findSimilar}>{showSimilar ? 'Hide Similar' : '≈ Similar'}</button>
              <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
              <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
              <button className="ab" onClick={copyLink}>{copied ? '✓ Copied!' : '🔗 Link'}</button>
              {isAdmin && <button className="ab p" onClick={startEdit}>Edit</button>}
              {isAdmin && <button className="ab del" onClick={deleteWorkout}>Delete</button>}
            </div>

            {/* Collections picker */}
            {showCollections && loadedCollections && (
              <div className="coll-picker">
                <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' }}>Add to collection:</div>
                {loadedCollections.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No collections yet. Create one from the Collections tab.</div>
                ) : loadedCollections.map(c => (
                  <button key={c.id} className="coll-pick-btn" onClick={() => addToCollection(c.id)}>📁 {c.name}</button>
                ))}
              </div>
            )}

            {/* Similar workouts */}
            {showSimilar && (
              <div className="similar-section">
                <h4 style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', marginBottom: '6px' }}>Similar Workouts</h4>
                {similarResults.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No similar workouts found.</div>
                ) : similarResults.map(s => (
                  <div key={s.id} className="similar-card" onClick={() => {
                    const slug = (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    window.location.href = '/workout/' + slug
                  }} style={{ cursor: 'pointer' }}>
                    <div className="wn" style={{ fontSize: '12px' }}>{s.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx3)' }}>{s.description?.slice(0, 100)}...</div>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '3px', flexWrap: 'wrap' }}>
                      {s.equipment?.filter(e => e !== 'Bodyweight').slice(0, 3).map(e => <span key={e} className="tg te">{e}</span>)}
                    </div>
                  </div>
                ))}
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
                const ta = document.getElementById('wod-edit-desc')
                if (!ta) return
                const start = ta.selectionStart
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(start)
                const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
                setEditForm({ ...editForm, description: before + nl + '• ' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 2 }, 0)
              }}>• Bullet</button>
              <button type="button" className="fmt-btn" onClick={() => {
                const ta = document.getElementById('wod-edit-desc')
                if (!ta) return
                const start = ta.selectionStart
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(start)
                const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
                setEditForm({ ...editForm, description: before + nl + '  • ' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 4 }, 0)
              }}>  ◦ Sub-bullet</button>
              <button type="button" className="fmt-btn" onClick={() => {
                const ta = document.getElementById('wod-edit-desc')
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
                const ta = document.getElementById('wod-edit-desc')
                if (!ta) return
                const start = ta.selectionStart
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(start)
                const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
                setEditForm({ ...editForm, description: before + nl + '--- ' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 4 }, 0)
              }}>— Section</button>
            </div>
            <textarea id="wod-edit-desc" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />

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
              {['Air Bike', 'Barbell', 'Bench', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Speed Rope', 'Weighted Vest'].map(eq => (
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
              {['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'KB Swing', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat', 'Thruster'].map(m => (
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

      {showTimer && <WorkoutTimer workout={wod} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={onWorkoutsChanged} />}
      {showShareImage && <ShareImage workout={wod} onClose={() => setShowShareImage(false)} />}
      {showStoryCard && <StoryCard workout={wod} score={lastLogScore} session={session} onClose={() => setShowStoryCard(false)} />}
    </>
  )
}
