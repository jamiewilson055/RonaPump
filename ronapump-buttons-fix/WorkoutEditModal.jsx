import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

export default function WorkoutEditModal({ workout, remixing, session, onClose, onSaved }) {
  const w = workout
  const descRef = useRef(null)

  const [editForm, setEditForm] = useState({
    name: remixing ? (w.name || 'Unnamed') + ' (My Version)' : (w.name || ''),
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

  function toggleArray(field, val) {
    setEditForm(prev => {
      const arr = [...prev[field]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [field]: arr }
    })
  }

  function insertAtCursor(prefix) {
    const ta = descRef.current
    if (!ta) return
    const start = ta.selectionStart
    const before = editForm.description.slice(0, start)
    const after = editForm.description.slice(start)
    const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
    setEditForm({ ...editForm, description: before + nl + prefix + after })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + prefix.length }, 0)
  }

  function toggleBold() {
    const ta = descRef.current
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
        source: 'remix-of-' + w.id,
      })
      if (error) { alert('Error saving: ' + error.message); return }
    } else {
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

    onSaved()
    onClose()
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
          <button type="button" className="fmt-btn" onClick={() => insertAtCursor('• ')}>• Bullet</button>
          <button type="button" className="fmt-btn" onClick={() => insertAtCursor('  • ')}>  ◦ Sub-bullet</button>
          <button type="button" className="fmt-btn" onClick={toggleBold}><b>B</b> Bold</button>
          <button type="button" className="fmt-btn" onClick={() => insertAtCursor('--- ')}>— Section</button>
        </div>
        <textarea ref={descRef} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />

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
              onClick={() => toggleArray('equipment', eq)}>{eq}</button>
          ))}
        </div>

        <label>Workout Type</label>
        <div className="cr">
          {['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength'].map(t => (
            <button key={t} className={`ch${editForm.workout_types.includes(t) ? ' on' : ''}`}
              onClick={() => toggleArray('workout_types', t)}>{t}</button>
          ))}
        </div>

        <label>Category</label>
        <div className="cr">
          {['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home Gym', 'Hotel Workouts', 'HYROX', 'Murph', 'Outdoor', 'Track Workouts'].map(c => (
            <button key={c} className={`ch${editForm.categories.includes(c) ? ' on' : ''}`}
              onClick={() => toggleArray('categories', c)}>{c}</button>
          ))}
        </div>

        <label>Movement Type</label>
        <div className="cr">
          {['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat'].map(m => (
            <button key={m} className={`ch${editForm.movement_categories.includes(m) ? ' on' : ''}`}
              onClick={() => toggleArray('movement_categories', m)}>{m}</button>
          ))}
        </div>

        <label>Body Part</label>
        <div className="cr">
          {['Upper Body', 'Lower Body', 'Full Body'].map(b => (
            <button key={b} className={`ch${editForm.body_parts.includes(b) ? ' on' : ''}`}
              onClick={() => toggleArray('body_parts', b)}>{b}</button>
          ))}
        </div>

        <div className="mf">
          <button className="ab" onClick={onClose}>Cancel</button>
          <button className="ab p" onClick={saveEdit}>{remixing ? '🔀 Save My Version' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
