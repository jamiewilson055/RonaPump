import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

export default function NewWorkoutModal({ onClose, onSaved, session, isAdmin }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    score_type: 'None',
    estimated_duration_mins: '',
    estimated_duration_min: '',
    estimated_duration_max: '',
    equipment: [],
    workout_types: [],
    categories: [],
    movement_categories: [],
  })

  function toggleArray(field, val) {
    setForm(prev => {
      const arr = [...prev[field]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [field]: arr }
    })
  }

  async function handleSave(submitForReview = false) {
    if (!form.description.trim()) { alert('Description is required.'); return }
    const { error } = await supabase.from('workouts').insert({
      name: form.name.trim() || null,
      description: form.description.trim(),
      score_type: form.score_type,
      estimated_duration_mins: form.estimated_duration_mins ? parseInt(form.estimated_duration_mins) : null,
      estimated_duration_min: form.estimated_duration_min ? parseInt(form.estimated_duration_min) : null,
      estimated_duration_max: form.estimated_duration_max ? parseInt(form.estimated_duration_max) : null,
      equipment: form.equipment.length ? form.equipment : ['Bodyweight'],
      workout_types: form.workout_types.length ? form.workout_types : ['For Time'],
      categories: form.categories,
      movement_categories: form.movement_categories.length ? form.movement_categories : [],
      source: 'user-created',
      created_by: session?.user?.id || null,
      visibility: isAdmin ? 'official' : (submitForReview ? 'pending' : 'private'),
      submitted_at: submitForReview ? new Date().toISOString() : null,
    })
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc">
        <h2>{isAdmin ? 'New Official Workout' : 'Create Workout'}</h2>
        {!isAdmin && (
          <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '12px', lineHeight: 1.5 }}>
            Create a workout for yourself, or submit it for community review. Private workouts are only visible to you.
          </div>
        )}

        <label>Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. The Grind" />

        <label>Description / Details</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Full workout details..." />

        <label>Score Type</label>
        <div className="st-sel">
          {SCORE_TYPES.map(t => (
            <button key={t} className={`st-opt${form.score_type === t ? ' on' : ''}`}
              onClick={() => setForm({ ...form, score_type: t })}>{t}</button>
          ))}
        </div>

        <label>Duration (exact minutes, if known)</label>
        <input type="number" value={form.estimated_duration_mins} onChange={e => setForm({ ...form, estimated_duration_mins: e.target.value })} placeholder="e.g. 30" />

        <label>Duration Range (if exact is unknown)</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="number" value={form.estimated_duration_min} onChange={e => setForm({ ...form, estimated_duration_min: e.target.value })} placeholder="Min" style={{ width: '80px' }} />
          <span style={{ color: 'var(--tx3)' }}>–</span>
          <input type="number" value={form.estimated_duration_max} onChange={e => setForm({ ...form, estimated_duration_max: e.target.value })} placeholder="Max" style={{ width: '80px' }} />
          <span style={{ color: 'var(--tx3)', fontSize: '12px' }}>minutes</span>
        </div>

        <label>Equipment</label>
        <div className="cr">
          {['Barbell', 'Bench', 'Bike (Assault/Echo)', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Speed Rope', 'Weighted Vest'].map(eq => (
            <button key={eq} className={`ch${form.equipment.includes(eq) ? ' on' : ''}`}
              onClick={() => toggleArray('equipment', eq)}>{eq}</button>
          ))}
        </div>

        <label>Workout Type</label>
        <div className="cr">
          {['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength'].map(t => (
            <button key={t} className={`ch${form.workout_types.includes(t) ? ' on' : ''}`}
              onClick={() => toggleArray('workout_types', t)}>{t}</button>
          ))}
        </div>

        <label>Category</label>
        <div className="cr">
          {['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home', 'Hotel Workouts', 'HYROX', 'Murph', 'Outdoor', 'Track Workouts'].map(c => (
            <button key={c} className={`ch${form.categories.includes(c) ? ' on' : ''}`}
              onClick={() => toggleArray('categories', c)}>{c}</button>
          ))}
        </div>

        <label>Movement Type</label>
        <div className="cr">
          {['Bench Press', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'Lunge', 'Olympic Lifting', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat'].map(m => (
            <button key={m} className={`ch${form.movement_categories.includes(m) ? ' on' : ''}`}
              onClick={() => toggleArray('movement_categories', m)}>{m}</button>
          ))}
        </div>

        <div className="mf" style={{ gap: '8px' }}>
          <button className="ab" onClick={onClose}>Cancel</button>
          {isAdmin ? (
            <button className="ab p" onClick={() => handleSave(false)}>Add Official Workout</button>
          ) : (
            <>
              <button className="ab" onClick={() => handleSave(false)}>Save Private</button>
              <button className="ab p" onClick={() => handleSave(true)}>Submit to Community</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
