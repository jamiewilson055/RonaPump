import { useState } from 'react'
import { supabase } from '../lib/supabase'

const QUICK_PROMPTS = [
  { label: '🔥 Quick Burn', prompt: 'Give me a 15-minute intense bodyweight AMRAP' },
  { label: '💪 DB Only', prompt: 'Create a 20-minute dumbbell-only workout, full body' },
  { label: '🏃 Cardio Blast', prompt: 'Build a 25-minute cardio and bodyweight circuit' },
  { label: '🦵 Leg Destroyer', prompt: 'Make a brutal 20-minute lower body workout with squats and lunges' },
  { label: '⏱ EMOM', prompt: 'Create a 20-minute EMOM with 4 movements' },
  { label: '🏨 Hotel Room', prompt: 'No equipment, 15 minutes, something I can do in a small hotel room' },
  { label: '🏋 Barbell', prompt: 'Build a 30-minute barbell workout with deadlifts and presses' },
  { label: '🦍 Harambe', prompt: 'Create the most brutal full body workout you can think of, 30 minutes, any equipment' },
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
      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p })
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setError('Server returned invalid response. Status: ' + response.status)
        setGenerating(false)
        return
      }

      if (data.error) {
        setError(data.error)
        setGenerating(false)
        return
      }

      setResult(data)
    } catch (err) {
      setError('Network error: ' + (err.message || 'Please try again.'))
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
      created_by: session?.user?.id || null,
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
      <div className="ai-hero">
        <div className="ai-hero-icon">🤖</div>
        <h2 className="ai-hero-title">AI Workout Generator</h2>
        <p className="ai-hero-sub">Tell me what you want — equipment, time, focus — and I'll build you a custom workout.</p>
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
        <button className="ai-gen-btn" onClick={() => generate()} disabled={generating}>
          {generating ? '⏳' : '🦍'} {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div className="ai-quick-prompts">
        <div className="doc-label">Or try one of these</div>
        <div className="ai-quick-grid">
          {QUICK_PROMPTS.map((qp, i) => (
            <button key={i} className="ai-quick-btn" onClick={() => { setPrompt(qp.prompt); generate(qp.prompt) }}>
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ color: 'var(--acc)', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>{error}</div>}

      {generating && (
        <div className="ai-loading">
          <div className="ai-loading-spinner">🦍</div>
          <div className="ai-loading-text">Building your workout...</div>
        </div>
      )}

      {result && (
        <div className="ai-result">
          <div className="ai-result-header">
            <div className="ai-result-name">{result.name}</div>
            <div className="ai-result-meta">
              {result.estimated_duration_mins && <span className="wdr">{result.estimated_duration_mins}m</span>}
              {result.score_type && result.score_type !== 'None' && <span className="wst">{result.score_type}</span>}
              {result.workout_types?.map(t => <span key={t} className="tg tw">{t}</span>)}
            </div>
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
                  {isAdmin ? '🦍 Save as Official Workout' : '💾 Save to My Workouts'}
                </button>
                <button className="doc-ctrl" style={{ width: '100%' }} onClick={() => generate()}>🔄 Regenerate</button>
              </>
            ) : (
              <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '15px', textAlign: 'center', padding: '12px' }}>✓ Saved!</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
