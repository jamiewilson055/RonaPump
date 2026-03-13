import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutTimer from './WorkoutTimer'
import ShareImage from './ShareImage'
import StoryCard from './StoryCard'
import WorkoutEditModal from './WorkoutEditModal'
import { toSlug, formatDesc, copyToClipboard } from '../utils'

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
  const [showEditModal, setShowEditModal] = useState(false)
  const [editModalRemixing, setEditModalRemixing] = useState(false)

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

  async function addLog() {
    if (!session) { onAuthRequired(); return }
    const scoreVal = logScore.trim() || null
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

  async function handleCopyLink() {
    if (!wod) return
    const url = `https://www.ronapump.com/workout/${toSlug(wod.name)}`
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
    const { error } = await supabase.from('collection_workouts').insert({ collection_id: collId, workout_id: wod.id })
    if (error && error.code === '23505') {
      alert('Already in this collection!')
      return
    }
    if (onCollectionsChanged) onCollectionsChanged()
    setShowCollections(false)
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
  const scoreLabel = wod.score_type === 'Time' ? 'Time' : wod.score_type === 'Rounds + Reps' ? 'Score' : wod.score_type === 'Calories' ? 'Cals' : 'Result'

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

            {/* BUTTONS — matches WorkoutCard order exactly:
                Start, Complete, Favorite, Save, Remix, Similar, Instagram, Story Card, Link, Edit (admin), Delete (admin) */}
            <div className="acts">
              <button className="ab p" onClick={() => setShowTimer(true)} style={{ fontWeight: 600 }}>▶ Start Workout</button>
              <button className="ab p" onClick={() => { if (!session) { onAuthRequired(); return } setAddingLog(!addingLog) }} style={{ background: 'var(--grn-d)', color: 'var(--grn)', borderColor: 'var(--grn)' }}>{addingLog ? 'Cancel' : '✓ Complete Workout'}</button>
              {toggleFavorite && <button className={`ab ${isFav ? '' : 'g'}`} onClick={() => toggleFavorite(wod.id)}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>}
              <button className="ab" onClick={() => { if (!session) { onAuthRequired(); return } setShowCollections(!showCollections) }}>{showCollections ? 'Hide' : '📁 Save'}</button>
              <button className="ab" onClick={() => {
                if (!session) { onAuthRequired(); return }
                setEditModalRemixing(true)
                setShowEditModal(true)
              }}>🔀 Remix</button>
              <button className="ab" onClick={findSimilar}>{showSimilar ? 'Hide Similar' : '≈ Similar'}</button>
              <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
              <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
              <button className="ab" onClick={handleCopyLink}>{copied ? '✓ Copied!' : '🔗 Link'}</button>
              {isAdmin && <button className="ab p" onClick={() => {
                setEditModalRemixing(false)
                setShowEditModal(true)
              }}>Edit</button>}
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
                    window.location.href = '/workout/' + toSlug(s.name)
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
      {showTimer && <WorkoutTimer workout={wod} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={onWorkoutsChanged} />}
      {showShareImage && <ShareImage workout={wod} onClose={() => setShowShareImage(false)} />}
      {showStoryCard && <StoryCard workout={wod} score={lastLogScore} session={session} onClose={() => setShowStoryCard(false)} />}
      {showEditModal && (
        <WorkoutEditModal
          workout={wod}
          remixing={editModalRemixing}
          session={session}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { if (onWorkoutsChanged) onWorkoutsChanged() }}
        />
      )}
    </>
  )
}
