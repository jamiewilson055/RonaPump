import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_NAMES = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' }
const SUIT_COLORS = { '♠': '#1a1a2e', '♥': '#cc0000', '♦': '#cc0000', '♣': '#1a1a2e' }
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_VALUES = { 'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 }

const PRESET_WORKOUT_MAP = {
  '🦍 Harambe Classic': 'Deck of Cards - Harambe Classic',
  '💪 DB Destroyer': 'Deck of Cards - DB Destroyer',
  '🏃 HYROX Prep': 'Deck of Cards - HYROX Prep',
  '🔥 Upper Body Blitz': 'Deck of Cards - Upper Body Blitz',
  '🦵 Leg Day': 'Deck of Cards - Leg Day',
  '⚡ Bodyweight Only': 'Deck of Cards - Bodyweight Only',
}

function buildDeck(includeJokers) {
  const cards = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, value: RANK_VALUES[rank] })
    }
  }
  if (includeJokers) {
    cards.push({ suit: '🃏', rank: 'JOKER', value: 0, isJoker: true })
    cards.push({ suit: '🃏', rank: 'JOKER', value: 0, isJoker: true })
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function DeckOfCards({ session, onAuthRequired, onWorkoutsChanged, isAdmin }) {
  const [phase, setPhase] = useState('setup') // setup, playing, complete
  const [suitMovements, setSuitMovements] = useState({ '♠': '', '♥': '', '♦': '', '♣': '' })
  const [jokerMovement, setJokerMovement] = useState('')
  const [includeJokers, setIncludeJokers] = useState(true)
  const [activePresetName, setActivePresetName] = useState(null)
  const [deck, setDeck] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [flipping, setFlipping] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [totalReps, setTotalReps] = useState(0)
  const [suitReps, setSuitReps] = useState({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 })
  const [presets, setPresets] = useState([])
  const [savedSchemes, setSavedSchemes] = useState([])
  const [schemeName, setSchemeName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [logged, setLogged] = useState(false)
  const [paused, setPaused] = useState(false)
  const [editingPreset, setEditingPreset] = useState(null)
  const [presetForm, setPresetForm] = useState(null)
  const [addingPreset, setAddingPreset] = useState(false)
  const [showMyDecks, setShowMyDecks] = useState(false)

  const timerRef = useRef(null)
  const wakeLockRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    loadPresets()
    if (session) loadSchemes()
  }, [session])

  async function loadPresets() {
    const { data } = await supabase.from('deck_presets').select('*').order('sort_order', { ascending: true })
    if (data) setPresets(data)
  }

  async function loadSchemes() {
    const { data } = await supabase.from('personal_records').select('*')
      .eq('user_id', session.user.id).eq('type', 'deck-scheme').order('created_at', { ascending: false })
    if (data) setSavedSchemes(data)
  }

  useEffect(() => {
    if (running && !paused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else { clearInterval(timerRef.current) }
    return () => clearInterval(timerRef.current)
  }, [running, paused])

  const requestWakeLock = useCallback(async () => {
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('loop', '')
      v.style.cssText = 'position:fixed;opacity:0;width:1px;height:1px'
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAM1tb292AAAAbG12aGQAAAAA0OfR59Dn0ecAAAPoAAAA+gABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAGGlvZHMAAAAAEICAgAcAT////v7/AAAAT3RyYWsAAABcdGtoZAAAAAPQ59Hn0OfR5wAAAAEAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAACAAAAAgAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAEAAAD6AAAAAAABAAAAAAHHbWRpYQAAACBtZGhkAAAAANDn0efQ59HnAAAAGAAAABgVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABcm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAADJzdGJsAAAAJnN0c2QAAAAAAAAAAQAAABZtcDR2AAAAAAAAAAEAAAAAAAAAAAAYc3R0cwAAAAAAAAAAAAAUc3RzYwAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAACHN0Y28AAAAAAAAAA'
      v.play().catch(() => {}); videoRef.current = v
    }
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
  }, [])

  const releaseWakeLock = useCallback(() => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current = null }
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }
  }, [])

  useEffect(() => () => releaseWakeLock(), [])

  function loadPreset(preset) {
    const suits = typeof preset.suits === 'string' ? JSON.parse(preset.suits) : preset.suits
    setSuitMovements({ ...suits })
    setJokerMovement(preset.joker || '')
    setIncludeJokers(preset.include_jokers !== false)
    setActivePresetName(preset.name)
  }

  function loadSavedScheme(scheme) {
    try {
      const data = JSON.parse(scheme.notes)
      setSuitMovements(data.suits)
      setJokerMovement(data.joker || '')
      setIncludeJokers(data.includeJokers !== false)
      setActivePresetName(null) // Custom
    } catch {}
  }

  async function saveScheme() {
    if (!session || !schemeName.trim()) return
    await supabase.from('personal_records').insert({
      user_id: session.user.id, type: 'deck-scheme', movement: schemeName.trim(), score: 'scheme',
      notes: JSON.stringify({ suits: suitMovements, joker: jokerMovement, includeJokers }),
      completed_at: new Date().toISOString().slice(0, 10)
    })
    setSchemeName(''); setShowSave(false); loadSchemes()
  }

  async function deleteSavedScheme(id) {
    if (!confirm('Delete this saved scheme?')) return
    await supabase.from('personal_records').delete().eq('id', id); loadSchemes()
  }

  function startEditPreset(p) {
    const suits = typeof p.suits === 'string' ? JSON.parse(p.suits) : p.suits
    setEditingPreset(p.id)
    setPresetForm({ name: p.name, description: p.description || '', suits: { ...suits }, joker: p.joker || '', include_jokers: p.include_jokers !== false, sort_order: p.sort_order || 0 })
  }

  function startAddPreset() {
    setAddingPreset(true)
    setPresetForm({ name: '', description: '', suits: { '♠': '', '♥': '', '♦': '', '♣': '' }, joker: '', include_jokers: true, sort_order: presets.length + 1 })
  }

  async function savePresetEdit() {
    if (!presetForm || !presetForm.name.trim()) { alert('Name is required.'); return }
    const payload = { name: presetForm.name.trim(), description: presetForm.description.trim() || null, suits: presetForm.suits, joker: presetForm.joker.trim() || null, include_jokers: presetForm.include_jokers, sort_order: presetForm.sort_order }
    if (addingPreset) await supabase.from('deck_presets').insert(payload)
    else await supabase.from('deck_presets').update(payload).eq('id', editingPreset)
    setEditingPreset(null); setAddingPreset(false); setPresetForm(null); loadPresets()
  }

  async function deletePreset(id) {
    if (!confirm('Delete this preset?')) return
    await supabase.from('deck_presets').delete().eq('id', id); loadPresets()
  }

  function startGame() {
    const empty = Object.values(suitMovements).some(v => !v.trim())
    if (empty) { alert('Please assign a movement to each suit.'); return }
    if (includeJokers && !jokerMovement.trim()) { alert('Please assign a Joker movement or disable Jokers.'); return }
    const d = buildDeck(includeJokers)
    setDeck(d); setCurrentIdx(-1); setElapsed(0); setTotalReps(0)
    setSuitReps({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 })
    setLogged(false); setPaused(false); setPhase('playing'); setRunning(true)
    requestWakeLock()
    setTimeout(() => flipNext(d, -1), 400)
  }

  function flipNext(d = deck, idx = currentIdx) {
    const nextIdx = idx + 1
    if (nextIdx >= d.length) { setRunning(false); setPhase('complete'); releaseWakeLock(); return }
    setFlipping(true)
    setTimeout(() => {
      setCurrentIdx(nextIdx)
      const card = d[nextIdx]
      if (!card.isJoker) {
        setTotalReps(r => r + card.value)
        setSuitReps(prev => ({ ...prev, [card.suit]: prev[card.suit] + card.value }))
      }
      setFlipping(false)
    }, 200)
  }

  async function logToActivity() {
    if (!session) { onAuthRequired(); return }

    // Find the matching workout
    const workoutName = activePresetName && PRESET_WORKOUT_MAP[activePresetName]
      ? PRESET_WORKOUT_MAP[activePresetName]
      : 'Deck of Cards - Custom'

    const { data: workouts } = await supabase.from('workouts').select('id, name')
      .eq('name', workoutName).eq('visibility', 'official').limit(1)

    let workoutId = workouts?.[0]?.id
    if (!workoutId) {
      // Fallback: try generic custom
      const { data: fallback } = await supabase.from('workouts').select('id')
        .eq('name', 'Deck of Cards - Custom').eq('visibility', 'official').limit(1)
      workoutId = fallback?.[0]?.id
    }

    if (!workoutId) return

    const movementList = SUITS.map(s => `${SUIT_NAMES[s]}: ${suitMovements[s]}`).join(', ')
    const desc = activePresetName
      ? `${activePresetName}`
      : `Custom — ${movementList}${includeJokers ? ', Joker: ' + jokerMovement : ''}`

    await supabase.from('performance_log').insert({
      user_id: session.user.id, workout_id: workoutId,
      completed_at: new Date().toISOString().slice(0, 10),
      score: formatTime(elapsed), notes: desc, is_rx: true,
    })
    setLogged(true)
    if (onWorkoutsChanged) onWorkoutsChanged()
  }

  const currentCard = currentIdx >= 0 && currentIdx < deck.length ? deck[currentIdx] : null
  const cardsRemaining = deck.length - currentIdx - 1
  const progress = deck.length > 0 ? ((currentIdx + 1) / deck.length) * 100 : 0

  // ====== SETUP PHASE ======
  if (phase === 'setup') {
    return (
      <div className="doc-setup">
        <div className="doc-header">
          <h3>🃏 Deck of Cards</h3>
          <div style={{ fontSize: '13px', color: 'var(--tx3)', marginTop: '2px' }}>
            Assign a movement to each suit. Card number = reps. Get through the whole deck.
          </div>
        </div>

        <div className="doc-presets">
          <div className="doc-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Quick Start</span>
            {isAdmin && <button className="ab" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={startAddPreset}>+ Add Preset</button>}
          </div>
          <div className="doc-preset-grid">
            {presets.map(p => (
              <div key={p.id} className="doc-preset-wrap">
                <button className="doc-preset" onClick={() => loadPreset(p)}>
                  <div className="doc-preset-name">{p.name}</div>
                  <div className="doc-preset-desc">{p.description}</div>
                </button>
                {isAdmin && (
                  <div className="doc-preset-admin">
                    <span onClick={() => startEditPreset(p)} style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--tx3)' }}>✎</span>
                    <span onClick={() => deletePreset(p.id)} style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--acc)' }}>✕</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {(editingPreset || addingPreset) && presetForm && (
          <div className="doc-preset-form">
            <div className="doc-label">{addingPreset ? 'Add Preset' : 'Edit Preset'}</div>
            <input value={presetForm.name} onChange={e => setPresetForm({ ...presetForm, name: e.target.value })} placeholder="Preset name (with emoji)" className="doc-suit-input" style={{ marginBottom: '6px' }} />
            <input value={presetForm.description} onChange={e => setPresetForm({ ...presetForm, description: e.target.value })} placeholder="Short description" className="doc-suit-input" style={{ marginBottom: '8px' }} />
            {SUITS.map(suit => (
              <div key={suit} className="doc-suit-row" style={{ marginBottom: '4px' }}>
                <span className="doc-suit-icon" style={{ color: SUIT_COLORS[suit] }}>{suit}</span>
                <input className="doc-suit-input" value={presetForm.suits[suit] || ''} onChange={e => setPresetForm({ ...presetForm, suits: { ...presetForm.suits, [suit]: e.target.value } })} placeholder="Movement" />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
              <input className="doc-suit-input" value={presetForm.joker} onChange={e => setPresetForm({ ...presetForm, joker: e.target.value })} placeholder="Joker movement" style={{ flex: 1 }} />
              <label style={{ fontSize: '11px', color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <input type="checkbox" checked={presetForm.include_jokers} onChange={e => setPresetForm({ ...presetForm, include_jokers: e.target.checked })} /> Jokers
              </label>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button className="ab p" onClick={savePresetEdit} style={{ fontSize: '12px', padding: '6px 14px' }}>Save</button>
              <button className="ab" onClick={() => { setEditingPreset(null); setAddingPreset(false); setPresetForm(null) }} style={{ fontSize: '12px', padding: '6px 10px' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* My Saved Decks */}
        {session && (
          <div className="doc-my-decks">
            <div className="doc-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowMyDecks(!showMyDecks)}>
              <span>My Saved Decks ({savedSchemes.length})</span>
              <span style={{ fontSize: '10px' }}>{showMyDecks ? '▾' : '▸'}</span>
            </div>
            {showMyDecks && (
              <>
                {savedSchemes.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--tx3)', padding: '8px 0' }}>No saved decks yet. Build one below and save it.</div>
                ) : savedSchemes.map(s => {
                  let data = {}
                  try { data = JSON.parse(s.notes) } catch {}
                  return (
                    <div key={s.id} className="doc-saved-item">
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadSavedScheme(s)}>
                        <div className="doc-saved-name">{s.movement}</div>
                        <div style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '2px' }}>
                          {SUITS.map(su => data.suits?.[su] ? `${su} ${data.suits[su]}` : '').filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className="del-entry" onClick={() => deleteSavedScheme(s.id)}>✕</span>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        <div className="doc-suits">
          <div className="doc-label">Assign Movements</div>
          {SUITS.map(suit => (
            <div key={suit} className="doc-suit-row">
              <span className="doc-suit-icon" style={{ color: SUIT_COLORS[suit] }}>{suit}</span>
              <span className="doc-suit-name">{SUIT_NAMES[suit]}</span>
              <input className="doc-suit-input" value={suitMovements[suit]} onChange={e => { setSuitMovements({ ...suitMovements, [suit]: e.target.value }); setActivePresetName(null) }} placeholder="e.g. Push-Ups" />
            </div>
          ))}
          <div className="doc-joker-row">
            <label className="doc-joker-toggle">
              <input type="checkbox" checked={includeJokers} onChange={e => setIncludeJokers(e.target.checked)} />
              <span>Include Jokers (2 cards)</span>
            </label>
            {includeJokers && (
              <input className="doc-suit-input" value={jokerMovement} onChange={e => setJokerMovement(e.target.value)} placeholder="Joker movement (e.g. Run 400m)" style={{ flex: 1 }} />
            )}
          </div>
        </div>

        {session && (
          <div className="doc-save-area">
            {showSave ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input value={schemeName} onChange={e => setSchemeName(e.target.value)} placeholder="Deck name..." className="doc-suit-input" style={{ flex: 1 }} />
                <button className="ab p" onClick={saveScheme} style={{ padding: '7px 14px', fontSize: '12px' }}>Save</button>
                <button className="ab" onClick={() => setShowSave(false)} style={{ padding: '7px 10px', fontSize: '12px' }}>Cancel</button>
              </div>
            ) : (
              <button className="ab" onClick={() => setShowSave(true)} style={{ fontSize: '12px' }}>💾 Save This Deck</button>
            )}
          </div>
        )}

        <button className="doc-start-btn" onClick={startGame}>🦍 Shuffle & Start</button>
        <div className="doc-info">
          <span>52 cards{includeJokers ? ' + 2 Jokers' : ''}</span>
          <span>·</span>
          <span>{includeJokers ? '222' : '220'} reps{includeJokers ? ' + Jokers' : ''}</span>
          {activePresetName && <><span>·</span><span style={{ color: 'var(--acc)' }}>{activePresetName}</span></>}
        </div>
      </div>
    )
  }

  // ====== PLAYING PHASE ======
  if (phase === 'playing') {
    const movement = currentCard
      ? currentCard.isJoker ? jokerMovement : suitMovements[currentCard.suit]
      : ''

    return (
      <div className="doc-play" onClick={() => { if (!paused && currentCard) flipNext() }}>
        <div className="doc-play-top" onClick={e => e.stopPropagation()}>
          <div className="doc-play-timer">{formatTime(elapsed)}</div>
          <div className="doc-play-progress">
            <div className="doc-play-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="doc-play-stats">
            <span>{cardsRemaining} left</span>
            <span>{totalReps} reps</span>
          </div>
        </div>

        <div className="doc-card-area">
          {currentCard ? (
            <div className={`doc-card${flipping ? ' flip' : ''}`}>
              <div className="doc-card-face">
                {currentCard.isJoker ? (
                  <>
                    <div className="doc-card-joker-icon">🃏</div>
                    <div className="doc-card-joker-text">JOKER</div>
                  </>
                ) : (
                  <>
                    <div className="doc-card-corner-tl" style={{ color: SUIT_COLORS[currentCard.suit] }}>
                      <div>{currentCard.rank}</div><div>{currentCard.suit}</div>
                    </div>
                    <div className="doc-card-center">
                      <div className="doc-card-rank" style={{ color: SUIT_COLORS[currentCard.suit] }}>{currentCard.rank}</div>
                      <div className="doc-card-suit" style={{ color: SUIT_COLORS[currentCard.suit] }}>{currentCard.suit}</div>
                    </div>
                    <div className="doc-card-corner-br" style={{ color: SUIT_COLORS[currentCard.suit] }}>
                      <div>{currentCard.suit}</div><div>{currentCard.rank}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="doc-card doc-card-back">
              <div className="doc-card-gorilla">🦍</div>
              <div className="doc-card-back-text">TAP TO FLIP</div>
            </div>
          )}
        </div>

        <div className="doc-movement" onClick={e => e.stopPropagation()}>
          {currentCard ? (
            currentCard.isJoker ? (
              <div className="doc-movement-name joker">{jokerMovement}</div>
            ) : (
              <div className="doc-movement-name">{currentCard.value} × {movement}</div>
            )
          ) : (
            <div className="doc-movement-name tap">Tap anywhere to start</div>
          )}
        </div>

        <div className="doc-controls" onClick={e => e.stopPropagation()}>
          <button className="doc-ctrl" onClick={() => setPaused(!paused)}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
          <button className="doc-ctrl sec" onClick={() => { if (confirm('Quit this deck?')) { setPhase('setup'); setRunning(false); releaseWakeLock() } }}>✕ Quit</button>
        </div>

        {paused && (
          <div className="doc-pause-overlay" onClick={e => e.stopPropagation()}>
            <div className="doc-pause-text">PAUSED</div>
            <div className="doc-pause-stats">
              <div>{currentIdx + 1} / {deck.length} cards</div>
              <div>{totalReps} total reps</div>
              <div>{formatTime(elapsed)}</div>
            </div>
            <button className="doc-ctrl" onClick={() => setPaused(false)}>▶ Resume</button>
          </div>
        )}

        {!paused && currentCard && <div className="doc-tap-hint">tap for next card →</div>}
      </div>
    )
  }

  // ====== COMPLETE PHASE ======
  return (
    <div className="doc-complete">
      <div className="doc-complete-header">
        <div className="doc-complete-gorilla">🦍</div>
        <h2>DECK COMPLETE!</h2>
      </div>
      <div className="doc-complete-time">{formatTime(elapsed)}</div>
      <div className="doc-complete-stats">
        <div className="doc-stat-card"><div className="doc-stat-num">{deck.length}</div><div className="doc-stat-label">Cards</div></div>
        <div className="doc-stat-card"><div className="doc-stat-num">{totalReps}</div><div className="doc-stat-label">Total Reps</div></div>
        <div className="doc-stat-card"><div className="doc-stat-num">{formatTime(elapsed)}</div><div className="doc-stat-label">Time</div></div>
      </div>
      <div className="doc-complete-breakdown">
        <div className="doc-label">Breakdown</div>
        {SUITS.map(s => (
          <div key={s} className="doc-breakdown-row">
            <span style={{ color: SUIT_COLORS[s], fontSize: '22px' }}>{s}</span>
            <span className="doc-breakdown-name">{suitMovements[s]}</span>
            <span className="doc-breakdown-reps">{suitReps[s]} reps</span>
          </div>
        ))}
        {includeJokers && (
          <div className="doc-breakdown-row">
            <span style={{ fontSize: '22px' }}>🃏</span>
            <span className="doc-breakdown-name">{jokerMovement}</span>
            <span className="doc-breakdown-reps">×2</span>
          </div>
        )}
      </div>
      <div className="doc-complete-actions">
        {session && !logged ? (
          <button className="doc-start-btn" onClick={logToActivity}>
            ✓ Log {formatTime(elapsed)} to {activePresetName ? PRESET_WORKOUT_MAP[activePresetName] || 'Custom' : 'Deck of Cards - Custom'}
          </button>
        ) : logged ? (
          <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '16px', textAlign: 'center', padding: '10px' }}>✓ Logged to Activity Feed!</div>
        ) : null}
        <button className="doc-ctrl" style={{ width: '100%' }} onClick={() => { const d = buildDeck(includeJokers); setDeck(d); setCurrentIdx(-1); setElapsed(0); setTotalReps(0); setSuitReps({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 }); setRunning(true); setLogged(false); setPhase('playing'); requestWakeLock(); setTimeout(() => flipNext(d, -1), 400) }}>🔄 Reshuffle & Go Again</button>
        <button className="doc-ctrl sec" style={{ width: '100%' }} onClick={() => { setPhase('setup'); setRunning(false); releaseWakeLock() }}>← Back to Setup</button>
      </div>
    </div>
  )
}
