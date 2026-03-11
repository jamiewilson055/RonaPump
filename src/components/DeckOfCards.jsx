import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_NAMES = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' }
const SUIT_COLORS = { '♠': '#ededf0', '♥': '#ff2d2d', '♦': '#ff2d2d', '♣': '#ededf0' }
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_VALUES = { 'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 }

const PRESETS = [
  {
    name: '🦍 Harambe Classic',
    desc: 'The OG full body crusher',
    suits: { '♠': 'Push-Ups', '♥': 'Squats', '♦': 'Burpees', '♣': 'Sit-Ups' },
    joker: 'Run 400m', includeJokers: true
  },
  {
    name: '💪 DB Destroyer',
    desc: 'All dumbbells, all pain',
    suits: { '♠': 'DB Thrusters', '♥': 'DB Rows', '♦': 'DB Lunges', '♣': 'DB Swings' },
    joker: '20 DB Snatches', includeJokers: true
  },
  {
    name: '🏃 HYROX Prep',
    desc: 'Race day simulation',
    suits: { '♠': 'Wall Balls', '♥': 'Burpee Broad Jumps', '♦': 'Lunges', '♣': 'Rowing Cals' },
    joker: 'Run 400m', includeJokers: true
  },
  {
    name: '🔥 Upper Body Blitz',
    desc: 'Arms, shoulders, chest',
    suits: { '♠': 'Push-Ups', '♥': 'Pull-Ups', '♦': 'Dips', '♣': 'Shoulder Press' },
    joker: '20 Burpees', includeJokers: true
  },
  {
    name: '🦵 Leg Day',
    desc: 'Quads, hams, glutes',
    suits: { '♠': 'Squats', '♥': 'Lunges', '♦': 'Jump Squats', '♣': 'Wall Sits (secs)' },
    joker: 'Run 200m', includeJokers: true
  },
  {
    name: '⚡ Bodyweight Only',
    desc: 'No equipment needed',
    suits: { '♠': 'Push-Ups', '♥': 'Air Squats', '♦': 'Mountain Climbers', '♣': 'Flutter Kicks' },
    joker: '1 Min Plank', includeJokers: false
  },
]

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
  // Shuffle (Fisher-Yates)
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

export default function DeckOfCards({ session, onAuthRequired, onWorkoutsChanged }) {
  // State: setup, playing, complete
  const [phase, setPhase] = useState('setup')
  const [suitMovements, setSuitMovements] = useState({ '♠': '', '♥': '', '♦': '', '♣': '' })
  const [jokerMovement, setJokerMovement] = useState('')
  const [includeJokers, setIncludeJokers] = useState(true)
  const [deck, setDeck] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [flipping, setFlipping] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [totalReps, setTotalReps] = useState(0)
  const [suitReps, setSuitReps] = useState({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 })
  const [savedSchemes, setSavedSchemes] = useState([])
  const [schemeName, setSchemeName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [logged, setLogged] = useState(false)
  const [paused, setPaused] = useState(false)

  const timerRef = useRef(null)
  const wakeLockRef = useRef(null)
  const videoRef = useRef(null)

  // Load saved schemes
  useEffect(() => {
    if (session) loadSchemes()
  }, [session])

  async function loadSchemes() {
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'deck-scheme')
      .order('created_at', { ascending: false })
    if (data) setSavedSchemes(data)
  }

  // Timer
  useEffect(() => {
    if (running && !paused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running, paused])

  // Wake lock
  const requestWakeLock = useCallback(async () => {
    // iOS: silent video trick
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.setAttribute('playsinline', '')
      v.setAttribute('muted', '')
      v.setAttribute('loop', '')
      v.style.position = 'fixed'
      v.style.opacity = '0'
      v.style.width = '1px'
      v.style.height = '1px'
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAM1tb292AAAAbG12aGQAAAAA0OfR59Dn0ecAAAPoAAAA+gABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAGGlvZHMAAAAAEICAgAcAT////v7/AAAAT3RyYWsAAABcdGtoZAAAAAPQ59Hn0OfR5wAAAAEAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAACAAAAAgAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAEAAAD6AAAAAAABAAAAAAHHbWRpYQAAACBtZGhkAAAAANDn0efQ59HnAAAAGAAAABgVxwAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABcm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAADJzdGJsAAAAJnN0c2QAAAAAAAAAAQAAABZtcDR2AAAAAAAAAAEAAAAAAAAAAAAYc3R0cwAAAAAAAAAAAAAUc3RzYwAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAACHN0Y28AAAAAAAAAA'
      v.play().catch(() => {})
      videoRef.current = v
    }
    // Android: Wake Lock API
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {}
  }, [])

  const releaseWakeLock = useCallback(() => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current = null }
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }
  }, [])

  useEffect(() => { return releaseWakeLock }, [])

  function loadPreset(preset) {
    setSuitMovements({ ...preset.suits })
    setJokerMovement(preset.joker || '')
    setIncludeJokers(preset.includeJokers !== false)
  }

  function loadSavedScheme(scheme) {
    try {
      const data = JSON.parse(scheme.notes)
      setSuitMovements(data.suits)
      setJokerMovement(data.joker || '')
      setIncludeJokers(data.includeJokers !== false)
    } catch {}
  }

  async function saveScheme() {
    if (!session || !schemeName.trim()) return
    const data = { suits: suitMovements, joker: jokerMovement, includeJokers }
    await supabase.from('personal_records').insert({
      user_id: session.user.id, type: 'deck-scheme',
      movement: schemeName.trim(), score: 'scheme',
      notes: JSON.stringify(data), completed_at: new Date().toISOString().slice(0, 10)
    })
    setSchemeName('')
    setShowSave(false)
    loadSchemes()
  }

  async function deleteSavedScheme(id) {
    if (!confirm('Delete this saved scheme?')) return
    await supabase.from('personal_records').delete().eq('id', id)
    loadSchemes()
  }

  function startGame() {
    const empty = Object.values(suitMovements).some(v => !v.trim())
    if (empty) { alert('Please assign a movement to each suit.'); return }
    if (includeJokers && !jokerMovement.trim()) { alert('Please assign a Joker movement or disable Jokers.'); return }
    const d = buildDeck(includeJokers)
    setDeck(d)
    setCurrentIdx(-1)
    setElapsed(0)
    setTotalReps(0)
    setSuitReps({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 })
    setLogged(false)
    setPaused(false)
    setPhase('playing')
    setRunning(true)
    requestWakeLock()
    // Auto-flip first card after brief delay
    setTimeout(() => flipNext(d, -1), 400)
  }

  function flipNext(d = deck, idx = currentIdx) {
    const nextIdx = idx + 1
    if (nextIdx >= d.length) {
      // Done!
      setRunning(false)
      setPhase('complete')
      releaseWakeLock()
      return
    }
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

  function togglePause() {
    setPaused(!paused)
  }

  function resetToSetup() {
    setPhase('setup')
    setRunning(false)
    setPaused(false)
    setCurrentIdx(-1)
    setElapsed(0)
    releaseWakeLock()
  }

  async function logToActivity() {
    if (!session) { onAuthRequired(); return }
    const movementList = SUITS.map(s => `${SUIT_NAMES[s]}: ${suitMovements[s]}`).join(', ')
    const desc = `Deck of Cards — ${movementList}${includeJokers ? ', Joker: ' + jokerMovement : ''}`

    // Find or create a "Deck of Cards" workout
    let { data: existing } = await supabase
      .from('workouts')
      .select('id')
      .eq('name', 'Deck of Cards')
      .eq('visibility', 'official')
      .limit(1)

    let workoutId
    if (existing && existing.length > 0) {
      workoutId = existing[0].id
    } else {
      const { data: newW } = await supabase.from('workouts').insert({
        name: 'Deck of Cards',
        description: 'Assign a movement to each suit. Flip cards. The number = your reps. Get through the entire deck.',
        score_type: 'Time',
        equipment: ['Bodyweight'],
        workout_types: ['For Time'],
        categories: [],
        movement_categories: [],
        visibility: 'official',
        created_by: session.user.id,
      }).select('id').single()
      if (newW) workoutId = newW.id
    }

    if (workoutId) {
      await supabase.from('performance_log').insert({
        user_id: session.user.id,
        workout_id: workoutId,
        completed_at: new Date().toISOString().slice(0, 10),
        score: formatTime(elapsed),
        notes: desc,
        is_rx: true,
      })
    }
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
          <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '2px' }}>
            Assign a movement to each suit. Card number = reps. Get through the whole deck.
          </div>
        </div>

        {/* Presets */}
        <div className="doc-presets">
          <div className="doc-label">Quick Start</div>
          <div className="doc-preset-grid">
            {PRESETS.map((p, i) => (
              <button key={i} className="doc-preset" onClick={() => loadPreset(p)}>
                <div className="doc-preset-name">{p.name}</div>
                <div className="doc-preset-desc">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Saved schemes */}
        {savedSchemes.length > 0 && (
          <div className="doc-saved">
            <div className="doc-label">My Saved Schemes</div>
            {savedSchemes.map(s => (
              <div key={s.id} className="doc-saved-item">
                <span className="doc-saved-name" onClick={() => loadSavedScheme(s)}>{s.movement}</span>
                <span className="del-entry" onClick={() => deleteSavedScheme(s.id)}>✕</span>
              </div>
            ))}
          </div>
        )}

        {/* Suit assignments */}
        <div className="doc-suits">
          <div className="doc-label">Assign Movements</div>
          {SUITS.map(suit => (
            <div key={suit} className="doc-suit-row">
              <span className="doc-suit-icon" style={{ color: SUIT_COLORS[suit] }}>{suit}</span>
              <span className="doc-suit-name">{SUIT_NAMES[suit]}</span>
              <input
                className="doc-suit-input"
                value={suitMovements[suit]}
                onChange={e => setSuitMovements({ ...suitMovements, [suit]: e.target.value })}
                placeholder="e.g. Push-Ups"
              />
            </div>
          ))}

          <div className="doc-joker-row">
            <label className="doc-joker-toggle">
              <input type="checkbox" checked={includeJokers} onChange={e => setIncludeJokers(e.target.checked)} />
              <span>Include Jokers (2 cards)</span>
            </label>
            {includeJokers && (
              <input
                className="doc-suit-input"
                value={jokerMovement}
                onChange={e => setJokerMovement(e.target.value)}
                placeholder="Joker movement (e.g. Run 400m)"
                style={{ flex: 1 }}
              />
            )}
          </div>
        </div>

        {/* Save scheme */}
        {session && (
          <div className="doc-save-area">
            {showSave ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  value={schemeName}
                  onChange={e => setSchemeName(e.target.value)}
                  placeholder="Scheme name..."
                  className="doc-suit-input"
                  style={{ flex: 1 }}
                />
                <button className="ab p" onClick={saveScheme} style={{ padding: '7px 14px', fontSize: '12px' }}>Save</button>
                <button className="ab" onClick={() => setShowSave(false)} style={{ padding: '7px 10px', fontSize: '12px' }}>Cancel</button>
              </div>
            ) : (
              <button className="ab" onClick={() => setShowSave(true)} style={{ fontSize: '12px' }}>💾 Save This Scheme</button>
            )}
          </div>
        )}

        {/* Start */}
        <button className="doc-start-btn" onClick={startGame}>
          🦍 Shuffle & Start
        </button>

        <div className="doc-info">
          <span>52 cards{includeJokers ? ' + 2 Jokers' : ''}</span>
          <span>·</span>
          <span>Total: {includeJokers ? '222' : '220'} reps + Jokers</span>
        </div>
      </div>
    )
  }

  // ====== PLAYING PHASE ======
  if (phase === 'playing') {
    const movement = currentCard
      ? currentCard.isJoker
        ? jokerMovement
        : suitMovements[currentCard.suit]
      : ''

    return (
      <div className="doc-play" onClick={() => { if (!paused && currentCard) flipNext() }}>
        {/* Top bar */}
        <div className="doc-play-top" onClick={e => e.stopPropagation()}>
          <div className="doc-play-timer">{formatTime(elapsed)}</div>
          <div className="doc-play-progress">
            <div className="doc-play-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="doc-play-stats">
            <span>{cardsRemaining} cards left</span>
            <span>{totalReps} reps</span>
          </div>
        </div>

        {/* Card */}
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
                    <div className="doc-card-rank" style={{ color: SUIT_COLORS[currentCard.suit] }}>
                      {currentCard.rank}
                    </div>
                    <div className="doc-card-suit" style={{ color: SUIT_COLORS[currentCard.suit] }}>
                      {currentCard.suit}
                    </div>
                    <div className="doc-card-value">{currentCard.value} reps</div>
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

        {/* Movement name */}
        <div className="doc-movement" onClick={e => e.stopPropagation()}>
          {currentCard ? (
            currentCard.isJoker ? (
              <div className="doc-movement-name joker">{jokerMovement}</div>
            ) : (
              <div className="doc-movement-name">{currentCard.value} × {movement}</div>
            )
          ) : (
            <div className="doc-movement-name">Tap anywhere to start</div>
          )}
        </div>

        {/* Controls */}
        <div className="doc-controls" onClick={e => e.stopPropagation()}>
          <button className="doc-ctrl" onClick={togglePause}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="doc-ctrl sec" onClick={() => { if (confirm('Quit this deck?')) resetToSetup() }}>
            ✕ Quit
          </button>
        </div>

        {/* Pause overlay */}
        {paused && (
          <div className="doc-pause-overlay" onClick={e => e.stopPropagation()}>
            <div className="doc-pause-text">PAUSED</div>
            <div className="doc-pause-stats">
              <div>{currentIdx + 1} / {deck.length} cards</div>
              <div>{totalReps} total reps</div>
              <div>{formatTime(elapsed)}</div>
            </div>
            <button className="doc-ctrl" onClick={togglePause}>▶ Resume</button>
          </div>
        )}

        {/* Tap hint */}
        {!paused && currentCard && (
          <div className="doc-tap-hint">tap for next card →</div>
        )}
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
        <div className="doc-stat-card">
          <div className="doc-stat-num">{deck.length}</div>
          <div className="doc-stat-label">Cards</div>
        </div>
        <div className="doc-stat-card">
          <div className="doc-stat-num">{totalReps}</div>
          <div className="doc-stat-label">Total Reps</div>
        </div>
        <div className="doc-stat-card">
          <div className="doc-stat-num">{formatTime(elapsed)}</div>
          <div className="doc-stat-label">Time</div>
        </div>
      </div>

      <div className="doc-complete-breakdown">
        <div className="doc-label">Breakdown</div>
        {SUITS.map(s => (
          <div key={s} className="doc-breakdown-row">
            <span style={{ color: SUIT_COLORS[s], fontSize: '18px' }}>{s}</span>
            <span className="doc-breakdown-name">{suitMovements[s]}</span>
            <span className="doc-breakdown-reps">{suitReps[s]} reps</span>
          </div>
        ))}
        {includeJokers && (
          <div className="doc-breakdown-row">
            <span style={{ fontSize: '18px' }}>🃏</span>
            <span className="doc-breakdown-name">{jokerMovement}</span>
            <span className="doc-breakdown-reps">×2</span>
          </div>
        )}
      </div>

      <div className="doc-complete-actions">
        {session && !logged ? (
          <button className="doc-start-btn" onClick={logToActivity}>
            ✓ Log to Activity Feed ({formatTime(elapsed)})
          </button>
        ) : logged ? (
          <div style={{ color: 'var(--grn)', fontWeight: 600, fontSize: '14px', textAlign: 'center', padding: '10px' }}>✓ Logged!</div>
        ) : null}
        <button className="doc-ctrl" onClick={() => { setPhase('playing'); setDeck(buildDeck(includeJokers)); setCurrentIdx(-1); setElapsed(0); setTotalReps(0); setSuitReps({ '♠': 0, '♥': 0, '♦': 0, '♣': 0, '🃏': 0 }); setRunning(true); setLogged(false); requestWakeLock(); setTimeout(() => flipNext(buildDeck(includeJokers), -1), 400) }}>
          🔄 Reshuffle & Go Again
        </button>
        <button className="doc-ctrl sec" onClick={resetToSetup}>
          ← Back to Setup
        </button>
      </div>
    </div>
  )
}
