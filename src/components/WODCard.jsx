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

export default function WODCard({ workouts, session, onAuthRequired, onWorkoutsChanged, favorites, toggleFavorite }) {
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
              <button className="ab" onClick={() => setShowShareImage(true)}>📸 Instagram</button>
              <button className="ab" onClick={() => setShowStoryCard(true)}>📱 Story Card</button>
              <button className="ab" onClick={copyLink}>{copied ? '✓ Copied!' : '🔗 Link'}</button>
              <button className="ab" onClick={shareWorkout}>↗ Share Text</button>
            </div>
          </div>
        )}
      </div>
      {showTimer && <WorkoutTimer workout={wod} onClose={() => setShowTimer(false)} session={session} onWorkoutsChanged={onWorkoutsChanged} />}
      {showShareImage && <ShareImage workout={wod} onClose={() => setShowShareImage(false)} />}
      {showStoryCard && <StoryCard workout={wod} score={lastLogScore} session={session} onClose={() => setShowStoryCard(false)} />}
    </>
  )
}
