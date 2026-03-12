import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ============= Audio =============
let audioCtx = null
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}
function playBeep(freq = 880, dur = 0.15, vol = 0.4) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = freq; gain.gain.value = vol
    osc.start(); osc.stop(ctx.currentTime + dur)
  } catch {}
}
function playCountdown() { playBeep(660, 0.1, 0.3) }
function playGo() { playBeep(880, 0.3, 0.5); setTimeout(() => playBeep(1100, 0.3, 0.5), 150) }
function playRest() { playBeep(440, 0.2, 0.35) }
function playDone() { for (let i = 0; i < 3; i++) setTimeout(() => playBeep(1100, 0.2, 0.5), i * 200) }

function fmt(s) {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const MODES = [
  { key: 'stopwatch', label: 'Stopwatch', icon: '⏱', desc: 'Count up with laps' },
  { key: 'amrap', label: 'AMRAP', icon: '🔁', desc: 'As many rounds as possible' },
  { key: 'fortime', label: 'For Time', icon: '⚡', desc: 'Finish as fast as you can' },
  { key: 'emom', label: 'EMOM', icon: '⏰', desc: 'Every minute on the minute' },
  { key: 'tabata', label: 'Tabata', icon: '🔥', desc: 'Work/rest intervals' },
  { key: 'custom', label: 'Custom', icon: '⚙️', desc: 'Build your own intervals' },
]

export default function StandaloneTimer({ session, onAuthRequired }) {
  const [mode, setMode] = useState(null)
  const [phase, setPhase] = useState('setup') // setup, countdown, running, rest, done
  const [time, setTime] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const [tapCount, setTapCount] = useState(0)
  const [laps, setLaps] = useState([])
  const [sound, setSound] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const intervalRef = useRef(null)
  const wakeLockRef = useRef(null)

  // Settings per mode
  const [amrapMins, setAmrapMins] = useState(12)
  const [fortimeCap, setFortimeCap] = useState(20)
  const [emomInterval, setEmomInterval] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)
  const [tabataWork, setTabataWork] = useState(20)
  const [tabataRest, setTabataRest] = useState(10)
  const [tabataRounds, setTabataRounds] = useState(8)
  const [tabataSets, setTabataSets] = useState(1)
  const [tabataSetRest, setTabataSetRest] = useState(60)
  const [customIntervals, setCustomIntervals] = useState([
    { name: 'Work', duration: 40, type: 'work' },
    { name: 'Rest', duration: 20, type: 'rest' },
  ])
  const [customRounds, setCustomRounds] = useState(5)

  // EMOM/Tabata tracking
  const [currentRound, setCurrentRound] = useState(0)
  const [currentSet, setCurrentSet] = useState(0)
  const [intervalTimeLeft, setIntervalTimeLeft] = useState(0)
  const [currentIntervalIdx, setCurrentIntervalIdx] = useState(0)

  // Saved timers
  const [savedTimers, setSavedTimers] = useState([])
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)

  useEffect(() => { if (session) loadSavedTimers() }, [session])

  async function loadSavedTimers() {
    const { data } = await supabase.from('saved_timers').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (data) setSavedTimers(data)
  }

  function getCurrentConfig() {
    if (mode === 'amrap') return { amrapMins }
    if (mode === 'fortime') return { fortimeCap }
    if (mode === 'emom') return { emomInterval, emomRounds }
    if (mode === 'tabata') return { tabataWork, tabataRest, tabataRounds, tabataSets, tabataSetRest }
    if (mode === 'custom') return { customIntervals, customRounds }
    return {}
  }

  function loadTimerConfig(timer) {
    setMode(timer.mode)
    const c = timer.config
    if (timer.mode === 'amrap' && c.amrapMins) setAmrapMins(c.amrapMins)
    if (timer.mode === 'fortime' && c.fortimeCap) setFortimeCap(c.fortimeCap)
    if (timer.mode === 'emom') { if (c.emomInterval) setEmomInterval(c.emomInterval); if (c.emomRounds) setEmomRounds(c.emomRounds) }
    if (timer.mode === 'tabata') { if (c.tabataWork) setTabataWork(c.tabataWork); if (c.tabataRest) setTabataRest(c.tabataRest); if (c.tabataRounds) setTabataRounds(c.tabataRounds); if (c.tabataSets) setTabataSets(c.tabataSets); if (c.tabataSetRest) setTabataSetRest(c.tabataSetRest) }
    if (timer.mode === 'custom') { if (c.customIntervals) setCustomIntervals(c.customIntervals); if (c.customRounds) setCustomRounds(c.customRounds) }
  }

  async function saveCurrentTimer() {
    if (!session) { onAuthRequired(); return }
    if (!saveName.trim()) return
    await supabase.from('saved_timers').insert({
      user_id: session.user.id,
      name: saveName.trim(),
      mode,
      config: getCurrentConfig(),
    })
    setSaveName(''); setShowSave(false)
    loadSavedTimers()
  }

  async function deleteSavedTimer(id) {
    if (!confirm('Delete this saved timer?')) return
    await supabase.from('saved_timers').delete().eq('id', id)
    loadSavedTimers()
  }

  // Wake lock
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
  }
  function releaseWakeLock() { wakeLockRef.current?.release(); wakeLockRef.current = null }

  useEffect(() => { return () => { releaseWakeLock(); clearInterval(intervalRef.current) } }, [])

  // ============= Stopwatch =============
  function startStopwatch() {
    setPhase('running'); setTime(0); setRunning(true); setLaps([])
    requestWakeLock()
    intervalRef.current = setInterval(() => setTime(t => t + 1), 1000)
  }

  function lapStopwatch() {
    setLaps(prev => [...prev, time])
  }

  // ============= AMRAP =============
  function startAmrap() {
    const total = amrapMins * 60
    runCountdown(() => {
      setPhase('running'); setTime(total); setTotalTime(total); setRounds(0); setTapCount(0); setRunning(true)
      requestWakeLock()
      intervalRef.current = setInterval(() => {
        setTime(t => {
          if (t <= 1) { clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock(); return 0 }
          if (t === 4 && sound) playCountdown()
          if (t === 3 && sound) playCountdown()
          if (t === 2 && sound) playCountdown()
          return t - 1
        })
      }, 1000)
    })
  }

  // ============= For Time =============
  function startForTime() {
    const cap = fortimeCap * 60
    runCountdown(() => {
      setPhase('running'); setTime(0); setTotalTime(cap); setRounds(0); setTapCount(0); setRunning(true)
      requestWakeLock()
      intervalRef.current = setInterval(() => {
        setTime(t => {
          if (t + 1 >= cap) { clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock(); return cap }
          return t + 1
        })
      }, 1000)
    })
  }

  function finishForTime() {
    clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock()
  }

  // ============= EMOM =============
  function startEmom() {
    runCountdown(() => {
      setPhase('running'); setCurrentRound(1); setIntervalTimeLeft(emomInterval); setTapCount(0); setRunning(true)
      requestWakeLock()
      let round = 1, timeLeft = emomInterval
      intervalRef.current = setInterval(() => {
        timeLeft--
        if (timeLeft === 3 && sound) playCountdown()
        if (timeLeft === 2 && sound) playCountdown()
        if (timeLeft === 1 && sound) playCountdown()
        if (timeLeft <= 0) {
          round++
          if (round > emomRounds) {
            clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock()
            setCurrentRound(emomRounds); setIntervalTimeLeft(0); return
          }
          timeLeft = emomInterval
          if (sound) playGo()
          setCurrentRound(round)
        }
        setIntervalTimeLeft(timeLeft)
        setTime(t => t + 1)
      }, 1000)
    })
  }

  // ============= Tabata =============
  function startTabata() {
    runCountdown(() => {
      setPhase('running'); setCurrentRound(1); setCurrentSet(1); setIntervalTimeLeft(tabataWork); setTapCount(0); setRunning(true)
      requestWakeLock()
      let round = 1, set = 1, timeLeft = tabataWork, isWork = true
      if (sound) playGo()

      intervalRef.current = setInterval(() => {
        timeLeft--
        if (timeLeft === 3 && sound) playCountdown()
        if (timeLeft <= 0) {
          if (isWork) {
            // Switch to rest
            if (round >= tabataRounds && set >= tabataSets) {
              clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock()
              setIntervalTimeLeft(0); return
            }
            isWork = false; timeLeft = tabataRest
            setPhase('rest')
            if (sound) playRest()
          } else {
            // Switch to work
            round++
            if (round > tabataRounds) {
              set++; round = 1
              if (set > tabataSets) {
                clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock()
                setIntervalTimeLeft(0); return
              }
              // Set rest
              timeLeft = tabataSetRest; isWork = false
              setCurrentSet(set); setCurrentRound(1); setPhase('rest')
              if (sound) playRest()
              setIntervalTimeLeft(timeLeft); setTime(t => t + 1); return
            }
            isWork = true; timeLeft = tabataWork
            setPhase('running'); setCurrentRound(round)
            if (sound) playGo()
          }
        }
        setIntervalTimeLeft(timeLeft)
        setTime(t => t + 1)
      }, 1000)
    })
  }

  // ============= Custom =============
  function startCustom() {
    if (customIntervals.length === 0) return
    runCountdown(() => {
      setPhase(customIntervals[0].type === 'rest' ? 'rest' : 'running')
      setCurrentRound(1); setCurrentIntervalIdx(0); setIntervalTimeLeft(customIntervals[0].duration); setTapCount(0); setRunning(true)
      requestWakeLock()
      let round = 1, idx = 0, timeLeft = customIntervals[0].duration
      if (sound) playGo()

      intervalRef.current = setInterval(() => {
        timeLeft--
        if (timeLeft === 3 && sound) playCountdown()
        if (timeLeft <= 0) {
          idx++
          if (idx >= customIntervals.length) {
            round++
            if (round > customRounds) {
              clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); releaseWakeLock()
              setIntervalTimeLeft(0); return
            }
            idx = 0; setCurrentRound(round)
          }
          timeLeft = customIntervals[idx].duration
          setCurrentIntervalIdx(idx)
          setPhase(customIntervals[idx].type === 'rest' ? 'rest' : 'running')
          if (sound) { customIntervals[idx].type === 'rest' ? playRest() : playGo() }
        }
        setIntervalTimeLeft(timeLeft)
        setTime(t => t + 1)
      }, 1000)
    })
  }

  // ============= Countdown =============
  function runCountdown(onDone) {
    setPhase('countdown'); setTime(3)
    let c = 3
    if (sound) playCountdown()
    const cd = setInterval(() => {
      c--
      if (sound) playCountdown()
      setTime(c)
      if (c <= 0) { clearInterval(cd); onDone() }
    }, 1000)
  }

  // ============= Controls =============
  function pause() {
    clearInterval(intervalRef.current); setRunning(false)
  }

  function resume() {
    if (phase === 'done' || phase === 'setup') return
    setRunning(true)
    if (mode === 'stopwatch') {
      intervalRef.current = setInterval(() => setTime(t => t + 1), 1000)
    } else if (mode === 'amrap') {
      intervalRef.current = setInterval(() => {
        setTime(t => {
          if (t <= 1) { clearInterval(intervalRef.current); setRunning(false); setPhase('done'); if (sound) playDone(); return 0 }
          return t - 1
        })
      }, 1000)
    }
    // For other modes, resuming is complex — simplified here
  }

  function reset() {
    clearInterval(intervalRef.current); setRunning(false); setPhase('setup')
    setTime(0); setRounds(0); setTapCount(0); setLaps([])
    setCurrentRound(0); setCurrentSet(0); setIntervalTimeLeft(0); setCurrentIntervalIdx(0)
    releaseWakeLock()
  }

  function addRound() { setRounds(r => r + 1); if (sound) playBeep(660, 0.1, 0.3) }
  function addTap() { setTapCount(t => t + 1); if (sound) playBeep(550, 0.05, 0.2) }

  function toggleFullscreen() {
    if (!fullscreen) { document.documentElement.requestFullscreen?.() }
    else { document.exitFullscreen?.() }
    setFullscreen(!fullscreen)
  }

  function addCustomInterval() {
    setCustomIntervals(prev => [...prev, { name: 'Work', duration: 30, type: 'work' }])
  }

  function removeCustomInterval(idx) {
    setCustomIntervals(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCustomInterval(idx, field, val) {
    setCustomIntervals(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  // ============= Phase Colors =============
  const phaseColor = phase === 'rest' ? 'var(--cyn)' : phase === 'countdown' ? 'var(--ylw)' : phase === 'done' ? 'var(--grn)' : 'var(--acc)'
  const phaseLabel = phase === 'rest' ? 'REST' : phase === 'countdown' ? 'GET READY' : phase === 'done' ? 'DONE!' : phase === 'running' ? (mode === 'tabata' || mode === 'custom' ? 'WORK' : '') : ''

  // ============= Mode Selector =============
  if (!mode) {
    return (
      <div className="timer-section">
        <div className="timer-hero">
          <div className="timer-hero-icon">⏱</div>
          <h2 className="timer-hero-title">Workout Timer</h2>
          <p className="timer-hero-sub">Choose a timer mode to get started</p>
        </div>
        <div className="timer-modes">
          {MODES.map(m => (
            <button key={m.key} className="timer-mode-card" onClick={() => setMode(m.key)}>
              <span className="timer-mode-icon">{m.icon}</span>
              <div>
                <div className="timer-mode-name">{m.label}</div>
                <div className="timer-mode-desc">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {savedTimers.length > 0 && (
          <div className="timer-saved-section">
            <div className="timer-saved-label">💾 My Saved Timers</div>
            {savedTimers.map(st => (
              <div key={st.id} className="timer-saved-item">
                <button className="timer-saved-btn" onClick={() => loadTimerConfig(st)}>
                  <span className="timer-saved-icon">{MODES.find(m => m.key === st.mode)?.icon}</span>
                  <div>
                    <div className="timer-saved-name">{st.name}</div>
                    <div className="timer-saved-mode">{st.mode.toUpperCase()}</div>
                  </div>
                </button>
                <button className="timer-saved-del" onClick={() => deleteSavedTimer(st.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============= Setup screens =============
  if (phase === 'setup') {
    return (
      <div className="timer-section">
        <button className="timer-back" onClick={() => { setMode(null); reset() }}>← Back to Timer Modes</button>
        <div className="timer-setup-card">
          <div className="timer-setup-icon">{MODES.find(m => m.key === mode)?.icon}</div>
          <h3 className="timer-setup-title">{MODES.find(m => m.key === mode)?.label}</h3>

          {mode === 'stopwatch' && (
            <div className="timer-setup-body">
              <p className="timer-setup-hint">Count up with lap tracking and rep counter.</p>
              <button className="timer-go-btn" onClick={startStopwatch}>▶ Start</button>
            </div>
          )}

          {mode === 'amrap' && (
            <div className="timer-setup-body">
              <label className="timer-label">Duration (minutes)</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setAmrapMins(Math.max(1, amrapMins - 1))}>−</button>
                <span className="timer-step-val">{amrapMins}</span>
                <button className="timer-step-btn" onClick={() => setAmrapMins(amrapMins + 1)}>+</button>
              </div>
              <button className="timer-go-btn" onClick={startAmrap}>▶ Start {amrapMins}:00 AMRAP</button>
            </div>
          )}

          {mode === 'fortime' && (
            <div className="timer-setup-body">
              <label className="timer-label">Time Cap (minutes)</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setFortimeCap(Math.max(1, fortimeCap - 1))}>−</button>
                <span className="timer-step-val">{fortimeCap}</span>
                <button className="timer-step-btn" onClick={() => setFortimeCap(fortimeCap + 1)}>+</button>
              </div>
              <button className="timer-go-btn" onClick={startForTime}>▶ Start For Time</button>
            </div>
          )}

          {mode === 'emom' && (
            <div className="timer-setup-body">
              <label className="timer-label">Interval (seconds)</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setEmomInterval(Math.max(10, emomInterval - 10))}>−10</button>
                <span className="timer-step-val">{emomInterval}s</span>
                <button className="timer-step-btn" onClick={() => setEmomInterval(emomInterval + 10)}>+10</button>
              </div>
              <label className="timer-label">Rounds</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setEmomRounds(Math.max(1, emomRounds - 1))}>−</button>
                <span className="timer-step-val">{emomRounds}</span>
                <button className="timer-step-btn" onClick={() => setEmomRounds(emomRounds + 1)}>+</button>
              </div>
              <div className="timer-total">Total: {fmt(emomInterval * emomRounds)}</div>
              <button className="timer-go-btn" onClick={startEmom}>▶ Start EMOM</button>
            </div>
          )}

          {mode === 'tabata' && (
            <div className="timer-setup-body">
              <label className="timer-label">Work (seconds)</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setTabataWork(Math.max(5, tabataWork - 5))}>−5</button>
                <span className="timer-step-val">{tabataWork}s</span>
                <button className="timer-step-btn" onClick={() => setTabataWork(tabataWork + 5)}>+5</button>
              </div>
              <label className="timer-label">Rest (seconds)</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setTabataRest(Math.max(5, tabataRest - 5))}>−5</button>
                <span className="timer-step-val">{tabataRest}s</span>
                <button className="timer-step-btn" onClick={() => setTabataRest(tabataRest + 5)}>+5</button>
              </div>
              <label className="timer-label">Rounds per Set</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setTabataRounds(Math.max(1, tabataRounds - 1))}>−</button>
                <span className="timer-step-val">{tabataRounds}</span>
                <button className="timer-step-btn" onClick={() => setTabataRounds(tabataRounds + 1)}>+</button>
              </div>
              <label className="timer-label">Sets</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setTabataSets(Math.max(1, tabataSets - 1))}>−</button>
                <span className="timer-step-val">{tabataSets}</span>
                <button className="timer-step-btn" onClick={() => setTabataSets(tabataSets + 1)}>+</button>
              </div>
              {tabataSets > 1 && (
                <>
                  <label className="timer-label">Rest Between Sets (seconds)</label>
                  <div className="timer-stepper">
                    <button className="timer-step-btn" onClick={() => setTabataSetRest(Math.max(10, tabataSetRest - 10))}>−10</button>
                    <span className="timer-step-val">{tabataSetRest}s</span>
                    <button className="timer-step-btn" onClick={() => setTabataSetRest(tabataSetRest + 10)}>+10</button>
                  </div>
                </>
              )}
              <div className="timer-total">Total: {fmt((tabataWork + tabataRest) * tabataRounds * tabataSets + (tabataSets > 1 ? tabataSetRest * (tabataSets - 1) : 0))}</div>
              <button className="timer-go-btn" onClick={startTabata}>▶ Start Tabata</button>
            </div>
          )}

          {mode === 'custom' && (
            <div className="timer-setup-body">
              <label className="timer-label">Intervals</label>
              {customIntervals.map((ci, i) => (
                <div key={i} className="timer-custom-row">
                  <select className="timer-custom-type" value={ci.type} onChange={e => updateCustomInterval(i, 'type', e.target.value)}>
                    <option value="work">Work</option>
                    <option value="rest">Rest</option>
                    <option value="prep">Prep</option>
                  </select>
                  <input className="timer-custom-name" placeholder="Name" value={ci.name} onChange={e => updateCustomInterval(i, 'name', e.target.value)} />
                  <div className="timer-stepper sm">
                    <button className="timer-step-btn sm" onClick={() => updateCustomInterval(i, 'duration', Math.max(5, ci.duration - 5))}>−</button>
                    <span className="timer-step-val sm">{ci.duration}s</span>
                    <button className="timer-step-btn sm" onClick={() => updateCustomInterval(i, 'duration', ci.duration + 5)}>+</button>
                  </div>
                  {customIntervals.length > 1 && <button className="timer-custom-del" onClick={() => removeCustomInterval(i)}>✕</button>}
                </div>
              ))}
              <button className="timer-add-interval" onClick={addCustomInterval}>+ Add Interval</button>
              <label className="timer-label">Rounds</label>
              <div className="timer-stepper">
                <button className="timer-step-btn" onClick={() => setCustomRounds(Math.max(1, customRounds - 1))}>−</button>
                <span className="timer-step-val">{customRounds}</span>
                <button className="timer-step-btn" onClick={() => setCustomRounds(customRounds + 1)}>+</button>
              </div>
              <div className="timer-total">Total: {fmt(customIntervals.reduce((a, c) => a + c.duration, 0) * customRounds)}</div>
              <button className="timer-go-btn" onClick={startCustom}>▶ Start Custom Timer</button>
            </div>
          )}

          {/* Save timer option (all modes except stopwatch) */}
          {mode !== 'stopwatch' && session && (
            <div className="timer-save-section">
              {!showSave ? (
                <button className="timer-save-toggle" onClick={() => setShowSave(true)}>💾 Save This Timer</button>
              ) : (
                <div className="timer-save-form">
                  <input className="timer-save-input" placeholder="Timer name..." value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCurrentTimer() }} />
                  <button className="timer-save-btn" onClick={saveCurrentTimer}>Save</button>
                  <button className="timer-save-cancel" onClick={() => { setShowSave(false); setSaveName('') }}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============= Active / Done Display =============
  const displayTime = mode === 'stopwatch' || mode === 'fortime' ? time
    : mode === 'amrap' ? time
    : intervalTimeLeft

  const modeInfo = MODES.find(m => m.key === mode)

  return (
    <div className={`timer-section${fullscreen ? ' timer-fs' : ''}`}>
      {!fullscreen && <button className="timer-back" onClick={() => { reset(); setMode(null) }}>← Back to Timer Modes</button>}

      <div className="timer-active" style={{ borderColor: phaseColor }}>
        <div className="timer-active-top">
          <span className="timer-mode-badge">{modeInfo?.icon} {modeInfo?.label}</span>
          <div className="timer-controls-top">
            <button className={`timer-sound-btn${sound ? '' : ' off'}`} onClick={() => setSound(!sound)}>{sound ? '🔊' : '🔇'}</button>
            <button className="timer-fs-btn" onClick={toggleFullscreen}>{fullscreen ? '⊟' : '⊞'}</button>
          </div>
        </div>

        {phaseLabel && <div className="timer-phase" style={{ color: phaseColor }}>{phaseLabel}</div>}

        {/* Current interval name for custom/tabata */}
        {mode === 'custom' && phase !== 'done' && phase !== 'countdown' && customIntervals[currentIntervalIdx] && (
          <div className="timer-interval-name">{customIntervals[currentIntervalIdx].name}</div>
        )}

        {/* Big time display */}
        <div className={`timer-display${phase === 'countdown' ? ' countdown' : ''}`} style={{ color: phase === 'done' ? 'var(--grn)' : 'var(--tx)' }}>
          {phase === 'countdown' ? time : fmt(displayTime)}
        </div>

        {/* Round info */}
        {(mode === 'emom' || mode === 'tabata' || mode === 'custom') && phase !== 'countdown' && (
          <div className="timer-round-info">
            Round {currentRound}{mode === 'emom' ? ` / ${emomRounds}` : mode === 'tabata' ? ` / ${tabataRounds}` : ` / ${customRounds}`}
            {mode === 'tabata' && tabataSets > 1 && ` • Set ${currentSet} / ${tabataSets}`}
          </div>
        )}

        {/* Tap counter and round counter */}
        {phase !== 'countdown' && phase !== 'setup' && (
          <div className="timer-counters">
            {(mode === 'amrap' || mode === 'fortime' || mode === 'stopwatch') && (
              <button className="timer-counter-btn" onClick={addRound}>
                <span className="timer-counter-n">{rounds}</span>
                <span className="timer-counter-l">Rounds +</span>
              </button>
            )}
            <button className="timer-counter-btn" onClick={addTap}>
              <span className="timer-counter-n">{tapCount}</span>
              <span className="timer-counter-l">Reps +</span>
            </button>
          </div>
        )}

        {/* Laps for stopwatch */}
        {mode === 'stopwatch' && laps.length > 0 && (
          <div className="timer-laps">
            {laps.map((l, i) => (
              <div key={i} className="timer-lap">
                <span>Lap {i + 1}</span>
                <span>{fmt(i === 0 ? l : l - laps[i - 1])}</span>
                <span style={{ color: 'var(--tx3)' }}>{fmt(l)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="timer-controls">
          {phase === 'done' ? (
            <button className="timer-ctrl-btn reset" onClick={reset}>↺ Reset</button>
          ) : running ? (
            <>
              <button className="timer-ctrl-btn pause" onClick={pause}>⏸ Pause</button>
              {mode === 'stopwatch' && <button className="timer-ctrl-btn lap" onClick={lapStopwatch}>Lap</button>}
              {mode === 'fortime' && <button className="timer-ctrl-btn finish" onClick={finishForTime}>🏁 Finish</button>}
            </>
          ) : phase !== 'countdown' ? (
            <>
              <button className="timer-ctrl-btn go" onClick={resume}>▶ Resume</button>
              <button className="timer-ctrl-btn reset" onClick={reset}>↺ Reset</button>
            </>
          ) : null}
        </div>

        {/* Done summary */}
        {phase === 'done' && (
          <div className="timer-done-summary">
            <div className="timer-done-row"><span>Total Time</span><span>{fmt(time)}</span></div>
            {rounds > 0 && <div className="timer-done-row"><span>Rounds</span><span>{rounds}</span></div>}
            {tapCount > 0 && <div className="timer-done-row"><span>Total Reps</span><span>{tapCount}</span></div>}
          </div>
        )}
      </div>
    </div>
  )
}
