import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Collections({ session, onAuthRequired, workouts }) {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [collectionWorkouts, setCollectionWorkouts] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    if (session) loadCollections()
    else setLoading(false)
  }, [session])

  async function loadCollections() {
    setLoading(true)
    const { data } = await supabase
      .from('user_collections')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setCollections(data)
    setLoading(false)
  }

  async function loadCollectionWorkouts(collId) {
    const { data } = await supabase
      .from('collection_workouts')
      .select('workout_id')
      .eq('collection_id', collId)
    if (data) {
      const wIds = data.map(d => d.workout_id)
      const wks = workouts.filter(w => wIds.includes(w.id))
      setCollectionWorkouts(prev => ({ ...prev, [collId]: wks }))
    }
  }

  async function createCollection() {
    if (!newName.trim()) return
    if (!session) { onAuthRequired(); return }
    const { error } = await supabase.from('user_collections').insert({
      user_id: session.user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    })
    if (error) { alert('Error: ' + error.message); return }
    setNewName('')
    setNewDesc('')
    setCreating(false)
    loadCollections()
  }

  async function deleteCollection(id) {
    if (!confirm('Delete this collection and remove all workouts from it?')) return
    await supabase.from('user_collections').delete().eq('id', id)
    setCollectionWorkouts(prev => { const n = { ...prev }; delete n[id]; return n })
    loadCollections()
  }

  async function removeFromCollection(collId, workoutId) {
    await supabase.from('collection_workouts').delete()
      .eq('collection_id', collId)
      .eq('workout_id', workoutId)
    loadCollectionWorkouts(collId)
  }

  async function saveEdit() {
    if (!editForm || !editingId) return
    if (!editForm.name.trim()) { alert('Name is required.'); return }
    await supabase.from('user_collections').update({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
    }).eq('id', editingId)
    setEditingId(null)
    setEditForm(null)
    loadCollections()
  }

  function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      if (!collectionWorkouts[id]) loadCollectionWorkouts(id)
    }
  }

  if (!session) {
    return (
      <div className="pr-section">
        <div className="pr-empty">
          <b>Sign in</b> to create workout collections.
          <br /><button className="ab p" style={{ marginTop: '12px' }} onClick={onAuthRequired}>Sign In</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pr-section">
      <div className="pr-header">
        <h3>Collections</h3>
        <button className="nbtn" onClick={() => setCreating(!creating)} style={{ padding: '7px 14px', fontSize: '12px' }}>
          {creating ? 'Cancel' : '+ New Collection'}
        </button>
      </div>

      {creating && (
        <div className="coll-create">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Collection name (e.g. Travel WODs, Leg Day)"
            onKeyDown={e => { if (e.key === 'Enter') createCollection() }}
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
          />
          <button className="ab p" onClick={createCollection}>Create</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : collections.length === 0 && !creating ? (
        <div className="pr-empty">
          No collections yet. Create one to organize your favorite workouts into custom groups like "Travel WODs", "Competition Prep", or "Quick Hitters".
        </div>
      ) : (
        collections.map(c => {
          const isExp = expandedId === c.id
          const wks = collectionWorkouts[c.id] || []
          const isEditing = editingId === c.id

          return (
            <div key={c.id} className={`pr-group${isExp ? ' exp' : ''}`}>
              <div className="pr-group-hd" onClick={() => toggleExpand(c.id)}>
                <span className="pr-type-icon">📁</span>
                <div className="pr-mv">{c.name}</div>
                {c.description && <span style={{ fontSize: '11px', color: 'var(--tx3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</span>}
                <span className="pr-cnt">{wks.length || '...'} workout{wks.length !== 1 ? 's' : ''}</span>
              </div>

              {isExp && (
                <div className="pr-exp-body" style={{ padding: '0 14px 10px' }}>
                  {isEditing && editForm ? (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Name" style={{ flex: 2, background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '5px', padding: '6px 8px', color: 'var(--tx)', fontSize: '12px' }} />
                      <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description" style={{ flex: 2, background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '5px', padding: '6px 8px', color: 'var(--tx)', fontSize: '12px' }} />
                      <button className="ab p" onClick={saveEdit} style={{ padding: '5px 12px', fontSize: '11px' }}>Save</button>
                      <button className="ab" onClick={() => { setEditingId(null); setEditForm(null) }} style={{ padding: '5px 8px', fontSize: '11px' }}>Cancel</button>
                    </div>
                  ) : null}

                  {wks.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--tx3)', padding: '8px 0' }}>
                      No workouts in this collection yet. Use the "📁 Save" button on any workout to add it here.
                    </div>
                  ) : (
                    wks.map(w => (
                      <div key={w.id} className="similar-card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {w.name || 'Unnamed'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--tx2)', marginTop: '2px' }}>
                            {w.equipment?.filter(e => e !== 'Bodyweight').slice(0, 3).join(', ')}
                            {w.estimated_duration_mins ? ` · ${w.estimated_duration_mins}m` : ''}
                          </div>
                        </div>
                        <span className="del-entry" onClick={(e) => { e.stopPropagation(); removeFromCollection(c.id, w.id) }}>✕</span>
                      </div>
                    ))
                  )}

                  <div className="pr-actions" style={{ padding: '6px 0 0' }}>
                    {!isEditing && <button className="ab" onClick={() => { setEditingId(c.id); setEditForm({ name: c.name, description: c.description || '' }) }}>Edit</button>}
                    {!isEditing && <button className="ab del" onClick={() => deleteCollection(c.id)}>Delete Collection</button>}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
