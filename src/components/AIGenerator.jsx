import { useState } from 'react'
import { supabase } from '../lib/supabase'

const QUICK_PROMPTS = [
  { label: '🔥 Quick Burn', prompt: 'Give me a 15-minute intense bodyweight AMRAP' },
  { label: '💪 DB Only', prompt: 'Create a 20-minute dumbbell-only workout, full body' },
  { label: '🏃 Cardio Blast', prompt: 'Build a 25-minute cardio and bodyweight circuit' },
  { label: '🦵 Leg Destroyer', prompt: 'Make a brutal 20-minute lower body workout with squats and lunges' },
  { label: '⏱ EMOM', prompt: 'Create a 20-minute EMOM with 4 movements' },
  { label: '🏨 Hotel Room', prompt: 'No equipment, 15 minutes, something I can do in a small hotel room' },
]

export default function AIGenerator({ session, onAuthRequired, isAdmin, onWorkoutsChanged }) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function generate(customPrompt) {
    const p = customPrompt || prompt
    if (!p.trim()) return
    setGenerating(true)
    setResult(null)
    setError('')
    setSaved(false)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a fitness workout creator for RonaPump, a functional fitness app. Generate a workout based on this request: "${p}"

Respond ONLY in this exact JSON format, no other text:
{
  "name": "Workout Name",
  "description": "Full workout description with movements, reps, and rounds. Use bullet points with • for each movement. Include warm-up notes if relevant.",
  "score_type": "Time or Rounds + Reps or Reps or Calories or None",
  "estimated_duration_mins": 20,
  "equipment": ["Bodyweight"],
  "workout_types": ["AMRAP"],
  "movement_categories": ["Push-Up", "Squat"],
  "body_parts": ["Full Body"],
  "categories": []
}

Valid equipment: Bodyweight, Dumbbell, Kettlebell, Barbell, Pull-Up Bar, Box, Bench, Rower, Bike (Assault/Echo), Ski Erg, Speed Rope, Medicine Ball, Sandbag, Sled, Weighted Vest
Valid workout_types: AMRAP, EMOM, For Calories, For Distance, For Time, Interval, Ladder, Rounds, Strength
Valid movement_categories: Bench Press, Burpee, DB Snatch, Deadlift, Farmers Carry, Jump, Lunge, Pull-Up, Push-Up, Run, Shoulder Press, Squat
Valid body_parts: Upper Body, Lower Body, Full Body
Valid categories: Cardio Only, DB Only, RonaAbs, Home Gym, Hotel Workouts, HYROX, Outdoor, Track Workouts

Make the workout creative, challenging, and well-structured. Use descriptive names.`
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.map(c => c.text || '').join('') || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const workout = JSON.parse(clean)
      setResult(workout)
    } catch (err) {
      setError('Failed to generate workout. Please try again.')
      console.error(err)
    }
    setGenerating(false)
  }

  async function saveWorkout() {
    if (!session) { onAuthRequired(); return }
    if (!result) return

    const { error: err } = await supabase.from('workouts').insert({
      name: result.name,
      description: result.description,
      score_type: result.score_type || 'None',
      estimated_duration_mins: result.estimated_duration_mins || null,
      equipment: result.equipment?.length ? result.equipment : ['Bodyweight'],
      workout_types: result.workout_types?.length ? result.workout_types : [],
      movement_categories: result.movement_categories?.length ? result.movement_categories : [],
      body_parts: result.body_parts?.length ? result.body_parts : [],
      categories: result.categories || [],
      visibility: isAdmin ? 'official' : 'private',
      created_by: session.user.id,
      source: 'ai-generated',
    })

    if (err) { setError('Error saving: ' + err.message); return }
    setSaved(true)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  function renderBold(str) {
    const parts = str.split(/\*\*(.*?)\*\*/)
    if (parts.length === 1) return str
    return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
  }

  function formatDesc(text) {
    return (text || '').split('\n').map((line, i) => {
      if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{renderBold(line.slice(4))}</div>
      if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
      if (line.startsWith('--- ')) return <div key={i} className="desc-section">{renderBold(line.slice(4))}</div>
      if (line.trim() === '') return <br key={i} />
      return <div key={i}>{renderBold(line)}</div>
    })
  }

  return (
    <div className="ai-gen">
      <div className="doc-header">
        <h3>🤖 AI Workout Generator</h3>
        <div style={{ fontSize: '13px', color: 'var(--tx3)', marginTop: '2px' }}>
          Tell me what you want and I'll build you a workout.
        </div>
      </div>

      <div className="ai-quick-prompts">
        {QUICK_PROMPTS.map((qp, i) => (
          <button key={i} className="ai-quick-btn" onClick={() => { setPrompt(qp.prompt); generate(qp.prompt) }}>
            {qp.label}
          </button>
        ))}
      </div>

      <div className="ai-input-row">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. 20 min AMRAP with dumbbells and burpees..."
          className="doc-suit-input"
          onKeyDown={e => { if (e.key === 'Enter') generate() }}
          style={{ flex: 1 }}
        />
        <button className="doc-start-btn" onClick={() => generate()} disabled={generating} style={{ width: 'auto', padding: '12px 24px', fontSize: '14px' }}>
          {generating ? '⏳ Generating...' : '🦍 Generate'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--acc)', fontSize: '13px', marginTop: '8px' }}>{error}</div>}

      {generating && (
        <div className="ai-loading">
          <div className="ai-loading-text">Building your workout...</div>
        </div>
      )}

      {result && (
        <div className="ai-result">
          <div className="ai-result-name">{result.name}</div>
          <div className="ai-result-meta">
            {result.estimated_duration_mins && <span className="wdr">{result.estimated_duration_mins}m</span>}
            {result.score_type && result.score_type !== 'None' && <span className="wst">{result.score_type}</span>}
            {result.workout_types?.map(t => <span key={t} className="tg tw">{t}</span>)}
          </div>
          <div className="ai-result-tags">
            {result.equipment?.filter(e => e !== 'Bodyweight').map(e => <span key={e} className="tg te">{e}</span>)}
            {result.movement_categories?.map(m => <span key={m} className="tg tm">{m}</span>)}
            {result.body_parts?.map(b => <span key={b} className="tg tb">{b}</span>)}
          </div>
          <div className="ai-result-desc">{formatDesc(result.description)}</div>
          <div className="ai-result-actions">
            {!saved ? (
              <>
                <button className="doc-start-btn" onClick={saveWorkout} style={{ fontSize: '14px' }}>
                  {isAdmin ? '🦍 Save as Official' : '💾 Save to My Workouts'}
                </button>
                <button className="doc-ctrl" style={{ width: '100%' }} onClick={() => generate()}>🔄 Regenerate</button>
              </>
            ) : (
              <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '15px', textAlign: 'center', padding: '12px' }}>✓ Saved to {isAdmin ? 'Official Workouts' : 'My Workouts'}!</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
