// src/components/WorkoutEditModal.jsx
// Canonical edit/remix modal used by WorkoutCard, WODCard, and WorkoutPage.
// Props:
//   workout  — the workout object being edited
//   mode     — 'edit' | 'remix' (component renders nothing if mode is falsy)
//   session  — user session (required for remix inserts)
//   onClose  — called when user cancels / clicks backdrop
//   onSaved  — called after a successful save; host handles closing and refreshing
//
// Filter lists are the LOCKED canonical lists per the project spec. Do not
// diverge here or in any host surface — change these in one place.
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SCORE_TYPES = ['Time', 'Rounds + Reps', 'Reps', 'Calories', 'Distance', 'Load', 'None']

const EQUIPMENT = ['Air Bike', 'Barbell', 'Bench', 'Bodyweight', 'Box', 'Dumbbell', 'Kettlebell', 'Medicine Ball', 'Pull-Up Bar', 'Rower', 'Sandbag', 'Ski Erg', 'Sled', 'Jump Rope', 'Weighted Vest']
const WORKOUT_TYPES = ['AMRAP', 'EMOM', 'For Calories', 'For Distance', 'For Time', 'Interval', 'Ladder', 'Rounds', 'Strength']
const CATEGORIES = ['Cardio Only', 'DB Only', 'RonaAbs', 'Harambe Favorites', 'Home Gym', 'Hotel Workouts', 'HYROX', 'Murph', 'Partner', 'Track Workouts']
const MOVEMENTS = ['Bench Press', 'Burpee', 'DB Snatch', 'Deadlift', 'Farmers Carry', 'Jump', 'KB Swing', 'Lunge', 'Pull-Up', 'Push-Up', 'Run', 'Shoulder Press', 'Squat', 'Thruster']
const BODY_PARTS = ['Upper Body', 'Lower Body', 'Full Body']

const EMOJI_CATEGORIES = [
  { label: '💪 Fitness', emojis: ['💪', '🏋️', '🏃', '🔥', '⏱', '🦍', '💀', '😤', '🫡', '🎯', '🏆', '⚡', '🧨', '💣', '🚀', '👊', '✅', '❌', '⬆️', '⬇️'] },
  { label: '🔢 Numbers', emojis: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🔟', '💯', '0️⃣'] },
  { label: '⚙️ Gear', emojis: ['🏋️‍♂️', '🏋️‍♀️', '🚴', '🚣', '🏊', '⛷️', '🧗', '🤸', '🏃‍♂️', '🏃‍♀️', '🥇', '🥈', '🥉', '🎽'] },
  { label: '😀 Faces', emojis: ['😀', '😎', '🤯', '😈', '🥵', '😮‍💨', '🫠', '💀', '👀', '🙌', '👏', '🤝', '✊', '🤘'] },
  { label: '📝 Misc', emojis: ['📌', '📝', '📊', '🗓️', '⭐', '💡', '🔄', '⏩', '▶️', '⏸️', '🟢', '🔴', '🟡', '⚪', '🔵', '➡️', '⬅️'] },
]

const TEXTAREA_ID = 'wem-edit-desc'

function initForm(workout, mode) {
  return {
    name: mode === 'remix' ? ((workout?.name || 'Unnamed') + ' (My Version)') : (workout?.name || ''),
    description: workout?.description || '',
    score_type: workout?.score_type || 'None',
    estimated_duration_mins: workout?.estimated_duration_mins || '',
    estimated_duration_min: workout?.estimated_duration_min || '',
    estimated_duration_max: workout?.estimated_duration_max || '',
    equipment: [...(workout?.equipment || [])],
    workout_types: [...(workout?.workout_types || [])],
    categories: [...(workout?.categories || [])],
    movement_categories: [...(workout?.movement_categories || [])],
    body_parts: [...(workout?.body_parts || [])],
  }
}

export default function WorkoutEditModal({ workout, mode, session, onClose, onSaved }) {
  const [editForm, setEditForm] = useState(() => initForm(workout, mode))
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapConstraints, setSwapConstraints] = useState([])
  const [swapLoading, setSwapLoading] = useState(false)

  if (!mode) return null
  const remixing = mode === 'remix'

  function toggleEditArray(field, val) {
    setEditForm(prev => {
      const arr = [...prev[field]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [field]: arr }
    })
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

  function insertEmoji(emoji) {
    const ta = document.getElementById(TEXTAREA_ID)
    if (!ta) return
    const start = ta.selectionStart
    const before = editForm.description.slice(0, start)
    const after = editForm.description.slice(start)
    setEditForm({ ...editForm, description: before + emoji + after })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + emoji.length }, 0)
  }

  function insertPrefix(prefix) {
    const ta = document.getElementById(TEXTAREA_ID)
    if (!ta) return
    const start = ta.selectionStart
    const before = editForm.description.slice(0, start)
    const after = editForm.description.slice(start)
    const nl = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
    setEditForm({ ...editForm, description: before + nl + prefix + after })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + nl.length + prefix.length }, 0)
  }

  async function saveEdit() {
    if (!editForm.description.trim()) { alert('Description is required.'); return }
    const payload = {
      name: editForm.name.trim() || null,
      description: editForm.description.trim(),
      score_type: editForm.score_type,
      estimated_duration_mins: editForm.estimated_duration_mins ? parseInt(editForm.estimated_duration_mins) : null,
      estimated_duration_min: editForm.estimated_duration_min ? parseInt(editForm.estimated_duration_min) : null,
      estimated_duration_max: editForm.estimated_duration_max ? parseInt(editForm.estimated_duration_max) : null,
      equipment: editForm.equipment.length ? editForm.equipment : ['Bodyweight'],
      categories: editForm.categories,
      movement_categories: editForm.movement_categories.length ? editForm.movement_categories : [],
      body_parts: editForm.body_parts || [],
    }
    if (remixing) {
      if (!session) { alert('Sign in required to remix'); return }
      const { error, data } = await supabase.from('workouts').insert({
        ...payload,
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['For Time'],
        created_by: session.user.id,
        visibility: 'private',
        source: 'remix-of-' + workout.id,
      }).select().single()
      if (error) { alert('Error saving: ' + error.message); return }
      if (onSaved) onSaved(data)
    } else {
      const { error } = await supabase.from('workouts').update({
        ...payload,
        workout_types: editForm.workout_types.length ? editForm.workout_types : ['General'],
        auto_named: false,
      }).eq('id', workout.id)
      if (error) { alert('Error saving: ' + error.message); return }
      if (onSaved) onSaved(workout)
    }
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose() }}>
      <div className="mc">
        <h2>{remixing ? '🔀 Remix Workout' : 'Edit Workout'}</h2>
        {remixing && <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px', lineHeight: 1.5 }}>Modify this workout to fit your equipment or preferences. It'll be saved as a private copy in My Workouts.</div>}
        <label>Name</label>
        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. The Grind" />
        <label>Description / Details</label>
        <div className="fmt-bar">
          <button type="button" className="fmt-btn" onClick={() => insertPrefix('• ')}>• Bullet</button>
          <button type="button" className="fmt-btn" onClick={() => insertPrefix('  • ')}>  ◦ Sub-bullet</button>
          <button type="button" className="fmt-btn" onClick={() => insertPrefix('--- ')}>— Section</button>
          <button type="button" className={`fmt-btn${swapOpen ? ' fmt-active' : ''}`} onClick={() => { setSwapOpen(!swapOpen); if (swapOpen) setSwapConstraints([]) }}>🔄 Swap</button>
          <button type="button" className="fmt-btn" style={showEmojiPicker ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : {}} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😀 Emoji</button>
        </div>
        {swapOpen && (
          <div className="swap-panel">
            <div className="swap-hint">Remove equipment you don't have — AI rewrites the workout</div>
            <div className="cr">
              {editForm.equipment.filter(e => e !== 'Bodyweight').map(eq => (
                <button key={eq} className={`ch${swapConstraints.includes('No ' + eq) ? ' on' : ''}`} onClick={() => toggleSwapConstraint('No ' + eq)}>✕ {eq}</button>
              ))}
              {editForm.description.toLowerCase().match(/\brun\b/) && (
                <button className={`ch${swapConstraints.includes('No Running') ? ' on' : ''}`} onClick={() => toggleSwapConstraint('No Running')}>✕ Running</button>
              )}
              <button className={`ch${swapConstraints.includes('Bodyweight Only') ? ' on' : ''}`} onClick={() => toggleSwapConstraint('Bodyweight Only')}>💪 Bodyweight Only</button>
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
        <textarea id={TEXTAREA_ID} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Full workout details..." style={{ minHeight: '140px' }} />
        <label>Score Type</label>
        <div className="st-sel">
          {SCORE_TYPES.map(t => (
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
          {EQUIPMENT.map(eq => (
            <button key={eq} className={`ch${editForm.equipment.includes(eq) ? ' on' : ''}`} onClick={() => toggleEditArray('equipment', eq)}>{eq}</button>
          ))}
        </div>
        <label>Workout Type</label>
        <div className="cr">
          {WORKOUT_TYPES.map(t => (
            <button key={t} className={`ch${editForm.workout_types.includes(t) ? ' on' : ''}`} onClick={() => toggleEditArray('workout_types', t)}>{t}</button>
          ))}
        </div>
        <label>Category</label>
        <div className="cr">
          {CATEGORIES.map(c => (
            <button key={c} className={`ch${editForm.categories.includes(c) ? ' on' : ''}`} onClick={() => toggleEditArray('categories', c)}>{c}</button>
          ))}
        </div>
        <label>Movement Type</label>
        <div className="cr">
          {MOVEMENTS.map(m => (
            <button key={m} className={`ch${editForm.movement_categories.includes(m) ? ' on' : ''}`} onClick={() => toggleEditArray('movement_categories', m)}>{m}</button>
          ))}
        </div>
        <label>Body Part</label>
        <div className="cr">
          {BODY_PARTS.map(b => (
            <button key={b} className={`ch${editForm.body_parts.includes(b) ? ' on' : ''}`} onClick={() => toggleEditArray('body_parts', b)}>{b}</button>
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
