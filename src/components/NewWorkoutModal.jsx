import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

export default function NewWorkoutModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    score_type: 'None',
    estimated_duration_mins: '',
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

  async function handleSave() {
    if (!form.description.trim()) { alert('Description is required.'); return }
    const { error } = await supabase.from('workouts').insert({
      name: form.name.trim() || null,
      description: form.description.trim(),
      score_type: form.score_type,
      estimated_duration_mins: form.estimated_duration_mins ? parseInt(form.estimated_duration_mins) : null,
      equipment: form.equipment.length ? form.equipment : ['Bodyweight'],
      workout_types: form.workout_types.length ? form.workout_types : ['General'],
      categories: form.categories,
      movement_categories: form.movement_categories.length ? form.movement_categories : ['General'],
      source: 'user-created',
    })
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc">
        <h2>New Workout</h2>
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

        <label>Duration (minutes)</label>
        <input type="number" value={form.estimated_duration_mins} onChange={e => setForm({ ...form, estimated_duration_mins: e.target.value })} placeholder="e.g. 30" />

        <label>Equipment</label>
        <div className="cr">
          {['Barbell', 'Bench', 'Bike (Assault/Echo)', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Speed Rope', 'Weighted Vest'].map(eq => (
            <button key={eq} className={`ch${form.equipment.includes(eq) ? ' on' : ''}`}
              onClick={() => toggleArray('equipment', eq)}>{eq}</button>
          ))}
        </div>

        <label>Workout Type</label>
        <div className="cr">
          {['AMRAP', 'Chipper', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'General', 'Interval', 'Ladder', 'Rounds', 'Strength', 'Tabata'].map(t => (
            <button key={t} className={`ch${form.workout_types.includes(t) ? ' on' : ''}`}
              onClick={() => toggleArray('workout_types', t)}>{t}</button>
          ))}
        </div>

        <label>Category</label>
        <div className="cr">
          {['Abs', 'Basement', 'Bedroom', 'Harambe Favorites', 'HYROX', 'Hotel Workouts', 'Murph', 'Outdoor', 'Outdoor With Running', 'Track Workouts'].map(c => (
            <button key={c} className={`ch${form.categories.includes(c) ? ' on' : ''}`}
              onClick={() => toggleArray('categories', c)}>{c}</button>
          ))}
        </div>

        <label>Movement Type</label>
        <div className="cr">
          {['Cardio', 'Core', 'Farmers Carry', 'General', 'Hinge', 'Jump', 'Lunge', 'Olympic Lifting', 'Plyometric', 'Pull', 'Pull-Up', 'Push', 'Push-Up', 'Run', 'Snatch', 'Squat'].map(m => (
            <button key={m} className={`ch${form.movement_categories.includes(m) ? ' on' : ''}`}
              onClick={() => toggleArray('movement_categories', m)}>{m}</button>
          ))}
        </div>

        <div className="mf">
          <button className="ab" onClick={onClose}>Cancel</button>
          <button className="ab p" onClick={handleSave}>Add Workout</button>
        </div>
      </div>
    </div>
  )
}
