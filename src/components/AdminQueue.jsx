import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatDesc(text) {
  return (text || '').split('\n').map((line, i) => {
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{line.slice(2)}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{line}</div>
  })
}

export default function AdminQueue({ onWorkoutsChanged }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [rejectionNote, setRejectionNote] = useState('')

  useEffect(() => { loadPending() }, [])

  async function loadPending() {
    setLoading(true)
    const { data } = await supabase
      .from('workouts')
      .select('*, profiles!created_by(display_name)')
      .eq('visibility', 'pending')
      .order('submitted_at', { ascending: true })
    if (data) setPending(data)
    setLoading(false)
  }

  async function approve(id) {
    await supabase.from('workouts').update({
      visibility: 'community',
      rejection_note: null,
    }).eq('id', id)
    loadPending()
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  async function reject(id) {
    await supabase.from('workouts').update({
      visibility: 'private',
      rejection_note: rejectionNote.trim() || 'Did not meet community standards.',
    }).eq('id', id)
    setRejectionNote('')
    setExpandedId(null)
    loadPending()
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!pending.length) return (
    <div className="pr-empty" style={{ marginBottom: '16px' }}>
      No pending submissions. When users submit workouts for community review, they'll appear here.
    </div>
  )

  return (
    <div className="admin-queue">
      <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', marginBottom: '10px' }}>
        Pending Review <span className="cn">{pending.length}</span>
      </h3>
      {pending.map(w => {
        const isExp = expandedId === w.id
        const author = w.profiles?.display_name || 'Unknown'
        return (
          <div key={w.id} className="aq-card">
            <div className="aq-header" onClick={() => setExpandedId(isExp ? null : w.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>
                  {w.name || 'Unnamed'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tx3)', marginTop: '2px' }}>
                  by {author} · {w.submitted_at ? new Date(w.submitted_at).toLocaleDateString() : ''}
                </div>
              </div>
              <span style={{ color: 'var(--tx3)', fontSize: '10px' }}>{isExp ? '▾' : '▸'}</span>
            </div>

            {isExp && (
              <div className="aq-body">
                <div className="dsc" style={{ fontSize: '13px', padding: '8px 0' }}>{formatDesc(w.description)}</div>
                <div className="wtg" style={{ padding: '4px 0' }}>
                  {w.equipment?.filter(q => q !== 'Bodyweight').map(q => <span key={q} className="tg te">{q}</span>)}
                  {w.workout_types?.map(t => <span key={t} className="tg tw">{t}</span>)}
                  {w.movement_categories?.map(m => <span key={m} className="tg tm">{m}</span>)}
                </div>
                {w.score_type !== 'None' && <div style={{ fontSize: '11px', color: 'var(--tx3)', padding: '4px 0' }}>Score type: {w.score_type}</div>}
                {w.estimated_duration_mins && <div style={{ fontSize: '11px', color: 'var(--tx3)' }}>Duration: {w.estimated_duration_mins}m</div>}

                <div style={{ marginTop: '10px' }}>
                  <input
                    value={rejectionNote}
                    onChange={e => setRejectionNote(e.target.value)}
                    placeholder="Rejection note (optional)"
                    style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '5px', padding: '6px 8px', color: 'var(--tx)', fontSize: '12px', width: '100%', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ab p" onClick={() => approve(w.id)}>✓ Approve</button>
                    <button className="ab del" onClick={() => reject(w.id)}>✕ Reject</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
