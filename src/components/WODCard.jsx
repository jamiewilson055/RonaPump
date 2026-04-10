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
    if (/^[\w].*:$/.test(line.trim())) return <div key={i} style={{ fontWeight: 700, color: 'var(--acc)', textTransform: 'uppercase', padding: '4px 0 0' }}>{renderBold(line.trim())}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{renderBold(line)}</div>
  })
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapConstraints, setSwapConstraints] = useState([])
  const [swapLoading, setSwapLoading] = useState(false)
  const EMOJI_CATEGORIES = [
    { label: '💪 Fitness', emojis: ['💪', '🏋️', '🏃', '🔥', '⏱', '🦍', '💀', '😤', '🫡', '🎯', '🏆', '⚡', '🧨', '💣', '🚀', '👊', '✅', '❌', '⬆️', '⬇️'] },
    { label: '🔢 Numbers', emojis: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🔟', '💯', '0️⃣'] },
    { label: '⚙️ Gear', emojis: ['🏋️‍♂️', '🏋️‍♀️', '🚴', '🚣', '🏊', '⛷️', '🧗', '🤸', '🏃‍♂️', '🏃‍♀️', '🥇', '🥈', '🥉', '🎽'] },
    { label: '😀 Faces', emojis: ['😀', '😎', '🤯', '😈', '🥵', '😮‍💨', '🫠', '💀', '👀', '🙌', '👏', '🤝', '✊', '🤘'] },
    { label: '📝 Misc', emojis: ['📌', '📝', '📊', '🗓️', '⭐', '💡', '🔄', '⏩', '▶️', '⏸️', '🟢', '🔴', '🟡', '⚪', '🔵', '➡️', '⬅️'] },
  ]

  const pick = useCallback(() => {
    const pool = workouts.filter(w => w.description && w.description.length > 40 && w.visibility !== 'private')
    if (pool.length) setWod(pool[Math.floor(Math.random() * pool.length)])
  }, [workouts])

  useEffect(() => {
    if (workouts.length && !wod) pick()
  }, [workouts, wod, pick])

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
    else if (wod.estimated_duration_min && wod.estimated_duration_max) text += `\n\n⏱ ${wod.estimated_duration_min}-${wod.estimated_duration_max} min`
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

  async function deleteWorkout() {
    if (!confirm('Delete this workout?')) return
    await supabase.from('workouts').delete().eq('id', wod.id)
    if (onWorkoutsChanged) onWorkoutsChanged()
    pick()
  }

  function startEdit() {
    setEditForm({
      name: wod.name || '', description: wod.description || '', score_type: wod.score_type || 'None',
      estimated_duration_mins: wod.estimated_duration_mins || '',
      estimated_duration_min: wod.estimated_duration_min || '',
      estimated_duration_max: wod.estimated_duration_max || '',
      equipment: [...(wod.equipment || [])], workout_types: [...(wod.workout_types || [])],
      categories: [...(wod.categories || [])], movement_categories: [...(wod.movement_categories || [])],
      body_parts: [...(wod.body_parts || [])],
    })
    setRemixing(false)
    setEditing(true)
  }

  function startRemix() {
    if (!session) { onAuthRequired(); return }
    setEditForm({
      name: (wod.name || 'Unnamed') + ' (My Version)', description: wod.description || '', score_type: wod.score_type || 'None',
      estimated_duration_mins: wod.estimated_duration_mins || '',
      estimated_duration_min: wod.estimated_duration_min || '',
      estimated_duration_max: wod.estimated_duration_max || '',
      equipment: [...(wod.equipment || [])], workout_types: [...(wod.workout_types || [])],
      categories: [...(wod.categories || [])], movement_categories: [...(wod.movement_categories || [])],
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

  function insertEmoji(emoji) {
    const ta = document.getElementById('wod-edit-desc')
    if (!ta) return
    const start = ta.selectionStart
    const before = editForm.description.slice(0, start)
    const after = editForm.description.slice(start)
    setEditForm({ ...editForm, description: before + emoji + after })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + emoji.length }, 0)
  }

  function toggleSwapConstraint(c) {
    setSwapConstraints(prev => {
      if (c === 'Bodyweight Only') return prev.includes(c) ? prev.filter(x => x !== c) : [c]
      const next = prev.filter(x => x !== 'Bodyweight Only')
      return next.includes(c) ? next.filter(x => x !== c) : [...next, c]
    })
  }

  async function doSwap() {
    if (!swapConstraints.length || swapLoading) return
    setSwapLoading(true)
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'swap',
          description: editForm.description,
          constraints: swapConstraints,
          name: editForm.name,
          equipment: editForm.equipment,
        })
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      if (data.description) {
        setEditForm(prev => ({ ...prev, description: data.description }))
        if (data.equipment) setEditForm(prev => ({ ...prev, equipment: data.equipment }))
      }
      setSwapOpen(false)
      setSwapConstraints([])
    } catch (err) {
      alert('Swap failed — try again')
    }
    setSwapLoading(false)
  }

  async function saveEdit() {
    if (!editForm.description.trim()) { alert('Description is required.'); return }
    if (remixing) {
      const { error } = await supabase.from('workouts').insert({
        name: editForm.name.trim() || null, description: editForm.description.trim(), score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        estimated_duration_min: editForm.estimated_duration_min ? parseInt(editForm.estimated_duration_min) : null,
        estimated_duration_max: editForm.estimated_duration_max ? parseInt(editForm.estimated_duration_max) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['For Time'],
        categories: editForm.categories, movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
        body_parts: editForm.body_parts || [], created_by: session.user.id, visibility: 'private', source: 'remix-of-' + wod.id,
      })
      if (error) { alert('Error saving: ' + error.message); return }
    } else {
      const { error } = await supabase.from('workouts').update({
        name: editForm.name.trim() || null, description: editForm.description.trim(), score_type: editForm.score_type,
        estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
        estimated_duration_min: editForm.estimated_duration_min ? parseInt(editForm.estimated_duration_min) : null,
        estimated_duration_max: editForm.estimated_duration_max ? parseInt(editForm.estimated_duration_max) : null,
        equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['General'],
        categories: editForm.categories, movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
        body_parts: editForm.body_parts || [], auto_named: false,
      }).eq('id', wod.id)
      if (error) { alert('Error saving: ' + error.message); return }
    }
    setEditing(false); setEditForm(null); setRemixing(false); setShowEmojiPicker(false); setSwapOpen(false); setSwapConstraints([])
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  if (!wod) return null

  const isFav = favorites?.has(wod.id)
  const pl = wod.performance_log || []
  const scoreLabel = wod.score_type === 'Time' ? 'Time' : wod.score_type === 'Rounds + Reps' ? 'Score' : wod.score_type === 'Calories' ? 'Cals' : 'Result'

  const durDisplay = wod.estimated_duration_mins
    ? `${wod.estimated_duration_mins}m`
    : (wod.estimated_duration_min && wod.estimated_duration_max)
      ? `${wod.estimated_duration_min}-${wod.estimated_duration_max}m`
      : null

  const myBest = session ? (() => {
    const my = pl.filter(e => e.user_id === session.user.id && e.score)
    if (!my.length) return null
    if (wod.score_type === 'Time') return my.reduce((b, e) => (!b || e.score < b) ? e.score : b, null)
    return my.reduce((b, e) => (!b || e.score > b) ? e.score : b, null)
  })() : null

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
          {durDisplay && <span className="wdr">{durDisplay}</span>}
          {wod.score_type !== 'None' && <span className="wst">{wod.score_type}</span>}
          {myBest && <span className="wbs">{myBest}</span>}
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

            {/* Performance Log */}
            <div className="plog">
              <div className="plog-hdr">
                <h4>Performance Log {wod.score_type !== 'None' && <span className="st-badge">Scored by: {wod.score_type}</span>}</h4>
                <span className="plog-add" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }}>{addingLog ? 'Cancel' : '+ Log Result'}</span>
              </div>
              {pl.length > 0 && (
                <table className="plog-table">
                  <thead><tr><th>Date</th><th>{scoreLabel}</th><th>Notes</th></tr></thead>
                  <tbody>
                    {pl.map(e => (
                      <tr key={e.id}>
                        <td>{e.completed_at || '—'}</td>
                        <td>{e.score || '—'}</td>
                        <td style={{ fontFamily: "'DM Sans'", fontSize: '11px' }}>{e.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {addingLog && (
                <div className="plog-form">
                  <input placeholder={scoreLabel} value={logScore} onChange={e => setLogScore(e.target.value)} />
                  <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
                  <input placeholder="Notes (optional)" value={logNotes} onChange={e => setLogNotes(e.target.value)} />
                  <button className="ab p" onClick={addLog}>Save</button>
                </div>
              )}
            </div>

            <div className="acts">
              <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontWeight: 600 }}>▶ Start Workout</button>
              <button className="ab p" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }} style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)' }}>{addingLog ? 'Cancel' : '✓ Complete Workout'}</button>
              {toggleFavorite && <button className={`ab ${isFav ? '' : 'g'}`} onClick={() => toggleFavorite(wod.id)}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>}
              <button className="ab" onClick={() => { if (!session) { onAuthRequired(); return } setShowCollections(!showCollections) }}>{showCollections ? 'Hide' : '📁 Save'}</button>
              <button className="ab" onClick={startRemix}>🔀 Remix</button>
              <button className="ab" onClick={findSimilar}>{showSimilar ? 'Hide Similar' : '≈ Similar'}</button>
              <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
              <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
              <button className="ab" onClick={copyLink}>{copied ? '✓ Copied!' : '🔗 Link'}</button>
              {isAdmin && <button className="ab p" onClick={startEdit}>Edit</button>}
              {isAdmin && <button className="ab del" onClick={deleteWorkout}>Delete</button>}
            </div>

            {/* Collections picker */}
            {showCollections && collections && (
              <div className="coll-picker">
                <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' }}>Add to collection:</div>
                {collections.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>No collections yet. Create one from the Collections tab.</div>
                ) : collections.map(c => (
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
        <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) { setEditing(false); setEditForm(null); setRemixing(false); setShowEmojiPicker(false); setSwapOpen(false); setSwapConstraints([]) } }}>
          <div className="mc">
            <h2>{remixing ? '🔀 Remix Workout' : 'Edit Workout'}</h2>
            {remixing && <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px', lineHeight: 1.5 }}>Modify this workout to fit your equipment or preferences. It'll be saved as a private copy.</div>}
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
                const before = editForm.description.slice(0, start)
                const after = editForm.description.slice(start)
                const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
                setEditForm({ ...editForm, description: before + nl + '--- ' + after })
                setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + 4 }, 0)
              }}>— Section</button>
              <button type="button" className={`fmt-btn${swapOpen ? ' fmt-active' : ''}`} onClick={() => { setSwapOpen(!swapOpen); if (swapOpen) setSwapConstraints([]) }}>🔄 Swap</button>
              <button type="button" className="fmt-btn" style={showEmojiPicker ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : {}} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😀 Emoji</button>
            </div>
            {swapOpen && (
              <div className="swap-panel">
                <div className="swap-hint">Remove equipment you don't have — AI rewrites the workout</div>
                <div className="cr">
                  {editForm.equipment.filter(e => e !== 'Bodyweight').map(eq => (
                    <button key={eq} className={`ch${swapConstraints.includes('No ' + eq) ? ' on' : ''}`}
                      onClick={() => toggleSwapConstraint('No ' + eq)}>✕ {eq}</button>
                  ))}
                  {editForm.description.toLowerCase().match(/\brun\b/) && (
                    <button className={`ch${swapConstraints.includes('No Running') ? ' on' : ''}`}
                      onClick={() => toggleSwapConstraint('No Running')}>✕ Running</button>
                  )}
                  <button className={`ch${swapConstraints.includes('Bodyweight Only') ? ' on' : ''}`}
                    onClick={() => toggleSwapConstraint('Bodyweight Only')}>💪 Bodyweight Only</button>
                </div>
                <button className="ab p swap-go" disabled={!swapConstraints.length || swapLoading} onClick={doSwap}>
                  {swapLoading ? '⏳ Rewriting...' : `🔄 Apply ${swapConstraints.length ? '(' + swapConstraints.length + ')' : ''}`}
                </button>
              </div>
            )}
            {showEmojiPicker && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '8px', marginBottom: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {EMOJI_CATEGORIES.map(cat => (
                  <div key={cat.label} style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>{cat.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                      {cat.emojis.map((em, i) => (
                        <button key={i} type="button" onClick={() => insertEmoji(em)} style={{ background: 'none', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.borderColor = 'var(--brd)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
                        >{em}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <textarea id="wod-edit-desc" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />
            <label>Score Type</label>
            <div className="st-sel">
              {['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None'].map(t => (
                <button key={t} className={`st-opt${editForm.score_type === t ? ' on' : ''}`} onClick={() => setEditForm({ ...editForm, score_type: t })}>{t}</button>
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
              {['Air Bike', 'Barbell', 'Bench', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Jump Rope', 'Weighted Vest'].map(eq => (
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
              {['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home Gym', 'Hotel Workouts', 'HYROX', 'Murph', 'Partner', 'Track Workouts'].map(c => (
                <button key={c} className={`ch${editForm.categories.includes(c) ? ' on' : ''}`} onClick={() => toggleEditArray('categories', c)}>{c}</button>
              ))}
            </div>
            <label>Movement Type</label>
            <div className="cr">
              {['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'KB Swing', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat', 'Thruster', 'Wall Ball'].map(m => (
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
              <button className="ab" onClick={() => { setEditing(false); setEditForm(null); setRemixing(false); setShowEmojiPicker(false); setSwapOpen(false); setSwapConstraints([]) }}>Cancel</button>
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
