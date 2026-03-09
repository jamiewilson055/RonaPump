import { useState } from 'react'
import { supabase } from '../lib/supabase'

function cleanDesc(w) {
  let d = w.description || ''
  if (w.name) {
    const nm = w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const p1 = new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi')
    d = d.replace(p1, '')
    d = d.replace(/^\s*[\n\r]+/, '').replace(/^\s*[-:]\s*/, '')
  }
  return d
}

function formatDesc(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{line.slice(2)}</div>
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{line.slice(4)}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{line}</div>
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

export default function WorkoutCard({ workout: w, isFav, toggleFavorite, session, onAuthRequired, onWorkoutsChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [addingLog, setAddingLog] = useState(false)
  const [logScore, setLogScore] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNotes, setLogNotes] = useState('')

  const hasDone = w.original_date || (w.performance_log && w.performance_log.length > 0)
  const bs = bestScore(w)
  const pl = w.performance_log || []

  const scoreLabel = w.score_type === 'Time' ? 'Time' : w.score_type === 'Rounds + Reps' ? 'Score' : w.score_type === 'Calories' ? 'Cals' : w.score_type === 'Reps' ? 'Reps' : w.score_type === 'Distance' ? 'Distance' : w.score_type === 'Load' ? 'Weight' : 'Result'

  async function addLog() {
    if (!session) { onAuthRequired(); return }
    if (!logScore.trim()) return
    await supabase.from('performance_log').insert({
      user_id: session.user.id,
      workout_id: w.id,
      completed_at: logDate,
      score: logScore.trim(),
      notes: logNotes.trim() || null
    })
    setAddingLog(false)
    setLogScore('')
    setLogNotes('')
    onWorkoutsChanged()
  }

  async function deleteLog(logId) {
    if (!confirm('Delete this log entry?')) return
    await supabase.from('performance_log').delete().eq('id', logId)
    onWorkoutsChanged()
  }

  return (
    <div className={`wc${expanded ? ' exp' : ''}`}>
      <div className="wc-top" onClick={() => setExpanded(!expanded)}>
        <div className={`dot ${hasDone ? 'y' : 'n'}`}></div>
        <button className={`wf ${isFav ? 'y' : 'n'}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(w.id) }}>
          {isFav ? '★' : '☆'}
        </button>
        <div className={`wn${!w.name ? ' u' : ''}${w.auto_named ? ' auto' : ''}`}>
          {w.name || 'Unnamed Workout'}
          {w.auto_named && <span className="auto-tag">auto</span>}
        </div>
        {w.estimated_duration_mins && <span className="wdr">{w.estimated_duration_mins}m</span>}
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
        <div className="det">
          <div className="dsc">{formatDesc(cleanDesc(w))}</div>

          {/* Performance Log */}
          <div className="plog">
            <div className="plog-hdr">
              <h4>Performance Log {w.score_type !== 'None' && <span className="st-badge">Scored by: {w.score_type}</span>}</h4>
              <span className="plog-add" onClick={() => setAddingLog(!addingLog)}>{addingLog ? 'Cancel' : '+ Log Result'}</span>
            </div>
            {pl.length > 0 && (
              <table className="plog-table">
                <thead><tr><th>Date</th><th>{scoreLabel}</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {pl.map((e) => {
                    const isBest = e.score === bs && pl.length > 1
                    return (
                      <tr key={e.id}>
                        <td>{e.completed_at || '—'}</td>
                        <td className={isBest ? 'best' : ''}>{e.score}{isBest ? ' ★' : ''}</td>
                        <td style={{ fontFamily: "'DM Sans'", fontSize: '11px' }}>{e.notes || '—'}</td>
                        <td><span className="del-entry" onClick={(ev) => { ev.stopPropagation(); deleteLog(e.id) }}>✕</span></td>
                      </tr>
                    )
                  })}
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

          <div className="inf">
            <span>Equipment: {w.equipment?.join(', ')}</span>
            <span>Movements: {w.movement_categories?.join(', ')}</span>
          </div>
          <div className="acts">
            <button className={`ab ${isFav ? '' : 'g'}`} onClick={() => toggleFavorite(w.id)}>{isFav ? '★ Unfavorite' : '☆ Favorite'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
