import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const CARDIO_MACHINES = ['Assault Bike', 'Echo Bike', 'Rower', 'Ski Erg', 'Run', 'Treadmill', 'StairMaster']

export default function PRTracker({ session, onAuthRequired }) {
  const [prs, setPrs] = useState([])
  const [adding, setAdding] = useState(false)
  const [prType, setPrType] = useState('strength')
  const [sort, setSort] = useState('newest')
  const [expandedFolder, setExpandedFolder] = useState(null)
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [addingEntry, setAddingEntry] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    if (session) loadPRs()
  }, [session])

  async function loadPRs() {
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
    if (data) setPrs(data)
  }

  // Build groups keyed by movement+target/weight
  const groups = useMemo(() => {
    const map = {}
    prs.forEach(p => {
      const key = p.type === 'cardio'
        ? `c:${p.movement}:${p.target}`
        : `s:${p.movement}${p.weight ? ':' + p.weight : ''}`
      if (!map[key]) map[key] = { type: p.type || 'strength', movement: p.movement, weight: p.weight, target: p.target, entries: [] }
      map[key].entries.push(p)
    })
    Object.values(map).forEach(g => g.entries.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')))
    return Object.values(map)
  }, [prs])

  // Build folders: group by movement name, then nest sub-groups
  const folders = useMemo(() => {
    const movementMap = {}
    groups.forEach(g => {
      if (!movementMap[g.movement]) movementMap[g.movement] = []
      movementMap[g.movement].push(g)
    })

    let arr = Object.entries(movementMap).map(([movement, subGroups]) => ({
      movement,
      type: subGroups[0].type,
      subGroups,
      isFolder: subGroups.length > 1,
      // For single-group items, expose the group directly
      singleGroup: subGroups.length === 1 ? subGroups[0] : null,
      latestDate: subGroups.flatMap(g => g.entries).reduce((latest, e) => (!latest || (e.completed_at || '') > latest) ? e.completed_at : latest, ''),
      totalEntries: subGroups.reduce((sum, g) => sum + g.entries.length, 0),
    }))

    if (sort === 'name') arr.sort((a, b) => a.movement.localeCompare(b.movement))
    else if (sort === 'cardio') arr = arr.filter(f => f.type === 'cardio').sort((a, b) => a.movement.localeCompare(b.movement))
    else if (sort === 'strength') arr = arr.filter(f => f.type === 'strength').sort((a, b) => a.movement.localeCompare(b.movement))
    else arr.sort((a, b) => (b.latestDate || '').localeCompare(a.latestDate || ''))
    return arr
  }, [groups, sort])

  function bestScore(g) {
    if (!g.entries.length) return null
    if (g.type === 'cardio') return g.entries.reduce((b, e) => (!b || e.score < b) ? e.score : b, null)
    return g.entries.reduce((b, e) => (!b || e.score > b) ? e.score : b, null)
  }

  async function addPR() {
    if (!session) { onAuthRequired(); return }
    const today = new Date().toISOString().slice(0, 10)
    if (prType === 'cardio') {
      const machine = document.getElementById('pr-machine')?.value
      const target = document.getElementById('pr-target')?.value?.trim()
      const time = document.getElementById('pr-time')?.value?.trim()
      const dt = document.getElementById('pr-dt')?.value || today
      const notes = document.getElementById('pr-nt')?.value?.trim()
      if (!machine || !target || !time) return
      await supabase.from('personal_records').insert({
        user_id: session.user.id, type: 'cardio',
        movement: machine, target, score: time, completed_at: dt, notes: notes || null, weight: null
      })
    } else {
      const mv = document.getElementById('pr-mv')?.value?.trim()
      const wt = document.getElementById('pr-wt')?.value?.trim()
      const sc = document.getElementById('pr-sc')?.value?.trim()
      const dt = document.getElementById('pr-dt')?.value || today
      const notes = document.getElementById('pr-nt')?.value?.trim()
      if (!mv || !sc) return
      await supabase.from('personal_records').insert({
        user_id: session.user.id, type: 'strength',
        movement: mv, weight: wt || null, score: sc, completed_at: dt, notes: notes || null, target: null
      })
    }
    setAdding(false)
    loadPRs()
  }

  async function addEntryToGroup(g, gKey) {
    if (!session) return
    const ref = g.entries[0]
    const sc = document.getElementById(`prge-sc-${gKey}`)?.value?.trim()
    const dt = document.getElementById(`prge-dt-${gKey}`)?.value || new Date().toISOString().slice(0, 10)
    const notes = document.getElementById(`prge-nt-${gKey}`)?.value?.trim()
    if (!sc) return
    await supabase.from('personal_records').insert({
      user_id: session.user.id, type: ref.type || 'strength',
      movement: ref.movement, weight: ref.weight || null, target: ref.target || null,
      score: sc, completed_at: dt, notes: notes || null
    })
    setAddingEntry(null)
    loadPRs()
  }

  async function deletePR(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('personal_records').delete().eq('id', id)
    loadPRs()
  }

  function startEditGroup(g, gKey) {
    setEditingGroup(gKey)
    setEditForm({ movement: g.movement, weight: g.weight || '', target: g.target || '' })
  }

  async function saveGroupEdit(g) {
    if (!editForm) return
    if (!editForm.movement.trim()) { alert('Movement name is required.'); return }
    for (const entry of g.entries) {
      const updates = { movement: editForm.movement.trim() }
      if (g.type === 'cardio') updates.target = editForm.target.trim() || null
      else updates.weight = editForm.weight.trim() || null
      await supabase.from('personal_records').update(updates).eq('id', entry.id)
    }
    setEditingGroup(null)
    setEditForm(null)
    loadPRs()
  }

  async function deleteGroup(g) {
    const label = `${g.movement}${g.type === 'cardio' ? ' — ' + g.target : g.weight ? ' @ ' + g.weight : ''}`
    if (!confirm(`Delete "${label}" and all ${g.entries.length} entries?`)) return
    for (const entry of g.entries) {
      await supabase.from('personal_records').delete().eq('id', entry.id)
    }
    loadPRs()
  }

  function renderGroup(g, gKey, indent = false) {
    const isCardio = g.type === 'cardio'
    const best = bestScore(g)
    const isExp = expandedGroup === gKey
    const isEditing = editingGroup === gKey
    const isAddingEntry = addingEntry === gKey
    const today = new Date().toISOString().slice(0, 10)

    return (
      <div key={gKey} className={`pr-group${isExp ? ' exp' : ''}${indent ? ' pr-indent' : ''}`}>
        <div className="pr-group-hd" onClick={() => { setExpandedGroup(isExp ? null : gKey); setAddingEntry(null); setEditingGroup(null) }}>
          {!indent && <span className="pr-type-icon">{isCardio ? '⚡' : '🏋'}</span>}
          <div className="pr-mv">{indent ? '' : g.movement}</div>
          {isCardio && g.target && <span className="pr-target-badge">{g.target}</span>}
          {!isCardio && g.weight && <span className="pr-wt-badge">{g.weight}</span>}
          <span className="pr-best">{best || ''}</span>
          <span className="pr-cnt">{g.entries.length}</span>
        </div>

        {isExp && (
          <div className="pr-exp-body">
            {isEditing && editForm && (
              <div className="pr-edit-form">
                <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '4px' }}>Edit PR</div>
                <div className="pr-form" style={{ margin: 0 }}>
                  <input value={editForm.movement} onChange={e => setEditForm({ ...editForm, movement: e.target.value })} placeholder="Movement" style={{ flex: 2 }} />
                  {isCardio
                    ? <input value={editForm.target} onChange={e => setEditForm({ ...editForm, target: e.target.value })} placeholder="Target" style={{ flex: 1.5 }} />
                    : <input value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: e.target.value })} placeholder="Weight" style={{ flex: 1 }} />
                  }
                  <button className="ab p" onClick={() => saveGroupEdit(g)} style={{ padding: '6px 14px', fontSize: '12px' }}>Save</button>
                  <button className="ab" onClick={() => { setEditingGroup(null); setEditForm(null) }} style={{ padding: '6px 10px', fontSize: '12px' }}>Cancel</button>
                </div>
              </div>
            )}

            <table className="plog-table" style={{ margin: '0 14px' }}>
              <thead>
                <tr><th>Date</th><th>{isCardio ? 'Time' : 'Result'}</th><th>Notes</th><th></th></tr>
              </thead>
              <tbody>
                {g.entries.map(e => {
                  const isBest = e.score === best && g.entries.length > 1
                  return (
                    <tr key={e.id}>
                      <td>{e.completed_at || '—'}</td>
                      <td className={isBest ? 'best' : ''}>{e.score}{isBest ? ' ★' : ''}</td>
                      <td style={{ fontFamily: "'DM Sans'", fontSize: '11px' }}>{e.notes || '—'}</td>
                      <td><span className="del-entry" onClick={(ev) => { ev.stopPropagation(); deletePR(e.id) }}>✕</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {isAddingEntry && (
              <div className="pr-form" style={{ margin: '6px 14px 0' }}>
                <input id={`prge-sc-${gKey}`} placeholder={isCardio ? 'Time (e.g. 1:38)' : 'Result (e.g. 6 reps)'} style={{ flex: 1.5 }} />
                <input id={`prge-dt-${gKey}`} type="date" defaultValue={today} style={{ flex: 1 }} />
                <input id={`prge-nt-${gKey}`} placeholder="Notes (optional)" style={{ flex: 1 }} />
                <button className="ab p" onClick={() => addEntryToGroup(g, gKey)} style={{ padding: '6px 14px', fontSize: '12px' }}>Save</button>
                <button className="ab" onClick={() => setAddingEntry(null)} style={{ padding: '6px 10px', fontSize: '12px' }}>Cancel</button>
              </div>
            )}

            <div className="pr-actions">
              {!isAddingEntry && !isEditing && <button className="ab g" onClick={() => { setAddingEntry(gKey); setEditingGroup(null) }}>+ Add Entry</button>}
              {!isEditing && !isAddingEntry && <button className="ab" onClick={() => startEditGroup(g, gKey)}>Edit</button>}
              {!isEditing && !isAddingEntry && <button className="ab del" onClick={() => deleteGroup(g)}>Delete All</button>}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="pr-section">
        <div className="pr-empty">
          <b>Sign in</b> to start tracking your personal records.
          <br /><button className="ab p" style={{ marginTop: '12px' }} onClick={onAuthRequired}>Sign In</button>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const nStr = groups.filter(g => g.type === 'strength').length
  const nCar = groups.filter(g => g.type === 'cardio').length

  return (
    <div className="pr-section">
      <div className="pr-header">
        <h3>PR Tracker</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select className="ssel" value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto' }}>
            <option value="newest">All — Recent</option>
            <option value="name">All — By Name</option>
            <option value="strength">Strength ({nStr})</option>
            <option value="cardio">Cardio ({nCar})</option>
          </select>
          <button className="nbtn" onClick={() => { setAdding(!adding); setEditingGroup(null) }} style={{ padding: '7px 14px', fontSize: '12px' }}>
            {adding ? 'Cancel' : '+ New PR'}
          </button>
        </div>
      </div>

      {adding && (
        <div className="pr-form-wrap">
          <div className="pr-type-tabs">
            <button className={`pr-tt${prType === 'strength' ? ' on' : ''}`} onClick={() => setPrType('strength')}>Strength</button>
            <button className={`pr-tt${prType === 'cardio' ? ' on' : ''}`} onClick={() => setPrType('cardio')}>Cardio</button>
          </div>
          {prType === 'cardio' ? (
            <>
              <div className="pr-form">
                <select id="pr-machine" style={{ flex: '1.5' }}>
                  <option value="">Machine...</option>
                  {CARDIO_MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input id="pr-target" placeholder="Target (e.g. 50 Cals, 2000m)" style={{ flex: '1.5' }} />
                <input id="pr-time" placeholder="Time (e.g. 6:53)" style={{ flex: 1 }} />
                <input id="pr-dt" type="date" defaultValue={today} style={{ flex: 1 }} />
                <input id="pr-nt" placeholder="Notes (optional)" style={{ flex: 1 }} />
                <button className="ab p" onClick={addPR} style={{ padding: '8px 16px' }}>Save</button>
              </div>
              <div className="pr-hints">Examples: Assault Bike / 50 Cals / 1:42 • Rower / 2000m / 6:53 • Run / 1 Mile / 6:45</div>
            </>
          ) : (
            <>
              <div className="pr-form">
                <input id="pr-mv" placeholder="Movement (e.g. Back Squat)" style={{ flex: 2 }} />
                <input id="pr-wt" placeholder="Weight (e.g. 225 lbs)" style={{ flex: 1 }} />
                <input id="pr-sc" placeholder="Result (e.g. 5 reps)" style={{ flex: 1 }} />
                <input id="pr-dt" type="date" defaultValue={today} style={{ flex: 1 }} />
                <input id="pr-nt" placeholder="Notes (optional)" style={{ flex: 1 }} />
                <button className="ab p" onClick={addPR} style={{ padding: '8px 16px' }}>Save</button>
              </div>
              <div className="pr-hints">Examples: Back Squat / 225 lbs / 5 reps • Bench Press / 185 lbs / 1RM • Pull-Up / BW+25 / 8 reps</div>
            </>
          )}
        </div>
      )}

      {folders.length === 0 && !adding && (
        <div className="pr-empty">No PRs logged yet. Hit <b>+ New PR</b> to start tracking.</div>
      )}

      {folders.map((folder) => {
        if (!folder.isFolder) {
          // Single group — render directly, no folder wrapper
          const g = folder.singleGroup
          const gKey = `${g.type}:${g.movement}:${g.target || g.weight || ''}`
          return renderGroup(g, gKey)
        }

        // Multiple sub-groups — render as expandable folder
        const isFolderExp = expandedFolder === folder.movement
        const isCardio = folder.type === 'cardio'
        return (
          <div key={folder.movement} className="pr-folder">
            <div className="pr-folder-hd" onClick={() => setExpandedFolder(isFolderExp ? null : folder.movement)}>
              <span className="pr-type-icon">{isCardio ? '⚡' : '🏋'}</span>
              <span className={`pr-folder-arrow${isFolderExp ? '' : ' shut'}`}>▾</span>
              <div className="pr-mv">{folder.movement}</div>
              <span className="pr-cnt">{folder.subGroups.length} variations · {folder.totalEntries} entries</span>
            </div>
            {isFolderExp && (
              <div className="pr-folder-body">
                {folder.subGroups.map(g => {
                  const gKey = `${g.type}:${g.movement}:${g.target || g.weight || ''}`
                  return renderGroup(g, gKey, true)
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
