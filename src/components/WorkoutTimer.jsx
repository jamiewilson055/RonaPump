import { useState, useEffect, useRef, useCallback } from 'react'

function formatTime(seconds) {
  const mins = Math.floor(Math.abs(seconds) / 60)
  const secs = Math.abs(seconds) % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function parseMinutes(str) {
  if (!str) return null
  const m = str.match(/(\d+)\s*min/)
  if (m) return parseInt(m[1])
  const n = parseInt(str)
  return isNaN(n) ? null : n
}

let audioCtx = null
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playBeep(freq = 880, duration = 0.15, vol = 0.4) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.value = vol
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (e) {}
}

function playDoubleBeep() {
  playBeep(880, 0.15, 0.4)
  setTimeout(() => playBeep(1100, 0.2, 0.5), 250)
}

function playTripleBeep() {
  playBeep(880, 0.12, 0.4)
  setTimeout(() => playBeep(880, 0.12, 0.4), 200)
  setTimeout(() => playBeep(1100, 0.25, 0.5), 400)
}

function playGorillaGrunt() {
  try {
    const ctx = getAudioCtx()
    const t = ctx.currentTime

    // Deep chest-beat thuds (3 rapid hits)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(90, t + i * 0.12)
      osc.frequency.exponentialRampToValueAtTime(45, t + i * 0.12 + 0.15)
      gain.gain.setValueAtTime(0.5, t + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.15)
      osc.start(t + i * 0.12)
      osc.stop(t + i * 0.12 + 0.15)
    }

    // Low growl underneath
    const growl = ctx.createOscillator()
    const growlGain = ctx.createGain()
    growl.connect(growlGain)
    growlGain.connect(ctx.destination)
    growl.type = 'sawtooth'
    growl.frequency.setValueAtTime(70, t)
    growl.frequency.linearRampToValueAtTime(50, t + 0.5)
    growlGain.gain.setValueAtTime(0.3, t)
    growlGain.gain.linearRampToValueAtTime(0.15, t + 0.25)
    growlGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5)
    growl.start(t)
    growl.stop(t + 0.5)

    // Rising roar on top
    const roar = ctx.createOscillator()
    const roarGain = ctx.createGain()
    roar.connect(roarGain)
    roarGain.connect(ctx.destination)
    roar.type = 'square'
    roar.frequency.setValueAtTime(120, t + 0.1)
    roar.frequency.exponentialRampToValueAtTime(200, t + 0.3)
    roar.frequency.exponentialRampToValueAtTime(80, t + 0.5)
    roarGain.gain.setValueAtTime(0.15, t + 0.1)
    roarGain.gain.linearRampToValueAtTime(0.25, t + 0.25)
    roarGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5)
    roar.start(t + 0.1)
    roar.stop(t + 0.5)
  } catch (e) {}
}

export default function WorkoutTimer({ workout, onClose, session, onWorkoutsChanged }) {
  const [mode, setMode] = useState(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [countdown321, setCountdown321] = useState(null)
  const [timerLogScore, setTimerLogScore] = useState('')
  const [timerLogNotes, setTimerLogNotes] = useState('')
  const [timerLogRx, setTimerLogRx] = useState(true)
  const [timerLogged, setTimerLogged] = useState(false)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const pausedElapsedRef = useRef(0)
  const lastBeepSecRef = useRef(-1)
  const wakeLockRef = useRef(null)
  const videoRef = useRef(null)

  // Keep screen awake while timer is running
  useEffect(() => {
    if (!running) {
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
      // Stop video
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.remove()
        videoRef.current = null
      }
      return
    }

    // Try native Wake Lock API first (Android Chrome)
    async function tryWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
          return true
        }
      } catch (e) {}
      return false
    }

    // iOS fallback: play a tiny silent video on loop
    function startVideoKeepAwake() {
      const video = document.createElement('video')
      video.setAttribute('playsinline', '')
      video.setAttribute('muted', '')
      video.setAttribute('loop', '')
      video.style.position = 'fixed'
      video.style.top = '-1px'
      video.style.left = '-1px'
      video.style.width = '1px'
      video.style.height = '1px'
      video.style.opacity = '0.01'
      // Tiny base64 mp4 (silent, 1 second)
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA' +
        'ABtZGF0AAACoAYF//+c3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOW' +
        'Y5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly9' +
        '3d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMAAAAYZnR5' +
        'cGlzb20AAAIAaXNvbWlzbzJhdmMxbXA0MQAAAAhmcmVlAAAAGG1kYXQAAAGzABAHAAABthBgUYI='
      video.muted = true
      document.body.appendChild(video)
      video.play().catch(() => {})
      videoRef.current = video
    }

    tryWakeLock().then(success => {
      if (!success) startVideoKeepAwake()
    })

    // Re-acquire on visibility change + recalculate elapsed
    function handleVisibility() {
      if (document.visibilityState === 'visible' && running) {
        // Immediately recalculate elapsed from wall clock
        if (startTimeRef.current) {
          const now = Date.now()
          const totalElapsed = Math.floor((now - startTimeRef.current) / 1000) + pausedElapsedRef.current
          setElapsed(totalElapsed)
        }
        tryWakeLock().then(success => {
          if (!success && !videoRef.current) startVideoKeepAwake()
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null }
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.remove(); videoRef.current = null }
    }
  }, [running])

  const [emomInterval, setEmomInterval] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)
  const [workTime, setWorkTime] = useState(30)
  const [restTime, setRestTime] = useState(30)
  const [intervalRounds, setIntervalRounds] = useState(8)
  const [customMins, setCustomMins] = useState('')

  const w = workout
  const wt = w.workout_types || []
  const isTimeScore = w.score_type === 'Time' || wt.includes('For Time')

  useEffect(() => {
    if (wt.includes('AMRAP')) {
      setMode('countdown')
      const dur = w.estimated_duration_mins || parseMinutes(w.description) || 20
      setTotalSeconds(dur * 60)
      setCustomMins(dur.toString())
    } else if (wt.includes('EMOM')) {
      setMode('emom')
      const dur = w.estimated_duration_mins || parseMinutes(w.description) || 10
      setEmomRounds(dur)
      setEmomInterval(60)
    } else if (wt.includes('Interval')) {
      setMode('interval')
    } else {
      // For Time, Rounds, For Calories, For Distance, Strength — all use stopwatch
      setMode('stopwatch')
    }
  }, [])

  function initAudio() { getAudioCtx() }

  function startTimer() {
    initAudio()
    // Sanitize any empty inputs before starting
    if (mode === 'emom') {
      if (!emomRounds || emomRounds < 1) setEmomRounds(10)
      if (!emomInterval || emomInterval < 10) setEmomInterval(60)
    }
    if (mode === 'interval') {
      if (!workTime || workTime < 5) setWorkTime(30)
      if (!restTime || restTime < 5) setRestTime(30)
      if (!intervalRounds || intervalRounds < 1) setIntervalRounds(8)
    }
    setCountdown321(3)
  }

  useEffect(() => {
    if (countdown321 === null) return
    if (countdown321 === 0) {
      setCountdown321(null)
      pausedElapsedRef.current = 0
      lastBeepSecRef.current = -1
      startTimeRef.current = Date.now()
      setRunning(true)
      setElapsed(0)
      setFinished(false)
      playGorillaGrunt()
      return
    }
    playBeep(660, 0.12, 0.3)
    const t = setTimeout(() => setCountdown321(countdown321 - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown321])

  useEffect(() => {
    if (running) {
      if (!startTimeRef.current) startTimeRef.current = Date.now()
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const totalElapsed = Math.floor((now - startTimeRef.current) / 1000) + pausedElapsedRef.current
        
        setElapsed(prev => {
          const next = totalElapsed
          // Only play beeps for seconds we haven't beeped yet
          if (next > lastBeepSecRef.current) {
            for (let s = lastBeepSecRef.current + 1; s <= next; s++) {
              if (mode === 'countdown' && s >= totalSeconds) {
                setRunning(false); setFinished(true); playTripleBeep(); lastBeepSecRef.current = s; return totalSeconds
              }
              if (mode === 'countdown') {
                const remaining = totalSeconds - s
                if (remaining === 3 || remaining === 2 || remaining === 1) playBeep(660, 0.1, 0.3)
              }
              if (mode === 'emom') {
                const eRounds = parseInt(emomRounds) || 10
                const eInterval = parseInt(emomInterval) || 60
                const totalEmom = eRounds * eInterval
                if (s >= totalEmom) { setRunning(false); setFinished(true); playTripleBeep(); lastBeepSecRef.current = s; return totalEmom }
                if (s % eInterval === 0 && s > 0) playDoubleBeep()
                const timeInRound = s % eInterval
                const timeLeft = eInterval - timeInRound
                if (timeLeft === 3 || timeLeft === 2 || timeLeft === 1) playBeep(660, 0.1, 0.3)
              }
              if (mode === 'interval') {
                const wk = parseInt(workTime) || 30
                const rs = parseInt(restTime) || 30
                const rds = parseInt(intervalRounds) || 8
                const roundTime = wk + rs
                const totalInt = rds * roundTime
                if (s >= totalInt) { setRunning(false); setFinished(true); playTripleBeep(); lastBeepSecRef.current = s; return totalInt }
                const posInRound = s % roundTime
                if (posInRound === 0 && s > 0) playDoubleBeep()
                if (posInRound === wk) playBeep(440, 0.2, 0.3)
                if (posInRound === wk - 3 || posInRound === wk - 2 || posInRound === wk - 1) playBeep(660, 0.1, 0.2)
              }
              if (mode === 'stopwatch') {
                if (s > 0 && s % 60 === 0) playBeep(880, 0.15, 0.3)
              }
            }
            lastBeepSecRef.current = next
          }
          return next
        })
      }, 250)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, totalSeconds, emomRounds, emomInterval, workTime, restTime, intervalRounds])

  function togglePause() {
    if (!running) {
      // Resuming — set new start time, carry over elapsed
      initAudio()
      pausedElapsedRef.current = elapsed
      startTimeRef.current = Date.now()
      setRunning(true)
    } else {
      // Pausing — elapsed is already correct in state
      setRunning(false)
    }
  }

  function resetTimer() {
    setRunning(false)
    setElapsed(0)
    setFinished(false)
    startTimeRef.current = null
    pausedElapsedRef.current = 0
    lastBeepSecRef.current = -1
    setTimerLogScore('')
  }

  function finishTimer() {
    setRunning(false)
    setFinished(true)
    playTripleBeep()
    // Auto-fill score with elapsed time for time-based workouts
    if (isTimeScore || mode === 'stopwatch') {
      setTimerLogScore(formatTime(elapsed))
    }
  }

  // Also auto-fill when countdown/emom/interval finish naturally
  useEffect(() => {
    if (finished && !timerLogScore && (isTimeScore || mode === 'stopwatch')) {
      setTimerLogScore(formatTime(elapsed))
    }
  }, [finished])

  let displayTime = '', displayLabel = '', displayRound = '', progress = 0, isRest = false

  if (mode === 'stopwatch') {
    displayTime = formatTime(elapsed); displayLabel = 'Elapsed'
  } else if (mode === 'countdown') {
    displayTime = formatTime(Math.max(totalSeconds - elapsed, 0)); displayLabel = 'Remaining'
    progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0
  } else if (mode === 'emom') {
    const rounds = parseInt(emomRounds) || 10
    const interval = parseInt(emomInterval) || 60
    const totalEmom = rounds * interval
    const currentRound = Math.floor(elapsed / interval) + 1
    displayTime = formatTime(interval - (elapsed % interval))
    displayLabel = `Round ${Math.min(currentRound, rounds)} of ${rounds}`
    displayRound = formatTime(Math.max(totalEmom - elapsed, 0)) + ' remaining'
    progress = totalEmom > 0 ? (elapsed / totalEmom) * 100 : 0
  } else if (mode === 'interval') {
    const wk = parseInt(workTime) || 30
    const rs = parseInt(restTime) || 30
    const rds = parseInt(intervalRounds) || 8
    const roundTime = wk + rs
    const totalInt = rds * roundTime
    const currentRound = Math.floor(elapsed / roundTime) + 1
    const posInRound = elapsed % roundTime
    isRest = posInRound >= wk
    const timeLeft = isRest ? (roundTime - posInRound) : (wk - posInRound)
    displayTime = formatTime(timeLeft); displayLabel = isRest ? 'REST' : 'WORK'
    displayRound = `Round ${Math.min(currentRound, rds)} of ${rds}`
    progress = totalInt > 0 ? (elapsed / totalInt) * 100 : 0
  }

  const isSetup = !running && !finished && elapsed === 0 && countdown321 === null
  const isActive = (running || elapsed > 0 || finished) && countdown321 === null

  return (
    <div className="timer-overlay">
      {/* Header */}
      <div className="timer-header">
        <button className="timer-close" onClick={onClose}>✕ Exit</button>
        <div className="timer-workout-name">{w.name || 'Workout'}</div>
      </div>

      {/* Scrollable workout description */}
      <div className="timer-desc-scroll">
        <div className="timer-desc">
          {w.description?.split('\n').map((line, i) => {
            function renderBold(str) {
              const parts = str.split(/\*\*(.*?)\*\*/)
              if (parts.length === 1) return str
              return parts.map((part, j) => j % 2 === 1 ? <b key={j}>{part}</b> : part)
            }
            if (line.startsWith('  • ')) return <div key={i} className="timer-li sub">{renderBold(line.slice(4))}</div>
            if (line.startsWith('• ')) return <div key={i} className="timer-li">{renderBold(line.slice(2))}</div>
            if (line.startsWith('--- ')) return <div key={i} style={{ color: '#ff2d2d', fontWeight: 700, fontSize: '14px', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{renderBold(line.slice(4))}</div>
            if (line.trim() === '') return <br key={i} />
            return <div key={i}>{renderBold(line)}</div>
          })}
        </div>
      </div>

      {/* Fixed clock area at bottom */}
      <div className="timer-clock-area" onTouchMove={e => e.stopPropagation()}>
        {/* Setup mode */}
        {isSetup && (
          <div className="timer-setup">
            <div className="timer-mode-tabs">
              <button className={`tmt${mode === 'stopwatch' ? ' on' : ''}`} onClick={() => setMode('stopwatch')}>Stopwatch</button>
              <button className={`tmt${mode === 'countdown' ? ' on' : ''}`} onClick={() => setMode('countdown')}>Countdown</button>
              <button className={`tmt${mode === 'emom' ? ' on' : ''}`} onClick={() => setMode('emom')}>EMOM</button>
              <button className={`tmt${mode === 'interval' ? ' on' : ''}`} onClick={() => setMode('interval')}>Interval</button>
            </div>

            {mode === 'countdown' && (
              <div className="timer-config">
                <label>Minutes</label>
                <input type="number" value={customMins} onChange={e => { setCustomMins(e.target.value); setTotalSeconds((parseInt(e.target.value) || 0) * 60) }} min="1" placeholder="e.g. 20" />
                {parseInt(customMins) > 0 && <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '4px' }}>Total: {formatTime((parseInt(customMins) || 0) * 60)}</div>}
              </div>
            )}
            {mode === 'emom' && (
              <div className="timer-config">
                <label>Minutes (1 round per minute)</label>
                <input type="number" value={emomRounds} onChange={e => {
                  const val = e.target.value
                  if (val === '') { setEmomRounds(''); return }
                  const n = parseInt(val)
                  if (!isNaN(n) && n > 0) setEmomRounds(n)
                }} min="1" placeholder="e.g. 30" />
                <label>Seconds per round</label>
                <input type="number" value={emomInterval} onChange={e => {
                  const val = e.target.value
                  if (val === '') { setEmomInterval(''); return }
                  const n = parseInt(val)
                  if (!isNaN(n) && n >= 10) setEmomInterval(n)
                }} min="10" />
                <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '4px' }}>
                  Total: {formatTime((parseInt(emomRounds) || 0) * (parseInt(emomInterval) || 60))} — {parseInt(emomRounds) || 0} rounds × {parseInt(emomInterval) || 60}s
                </div>
              </div>
            )}
            {mode === 'interval' && (
              <div className="timer-config">
                <label>Work (seconds)</label>
                <input type="number" value={workTime} onChange={e => {
                  const val = e.target.value
                  if (val === '') { setWorkTime(''); return }
                  const n = parseInt(val)
                  if (!isNaN(n) && n > 0) setWorkTime(n)
                }} min="5" />
                <label>Rest (seconds)</label>
                <input type="number" value={restTime} onChange={e => {
                  const val = e.target.value
                  if (val === '') { setRestTime(''); return }
                  const n = parseInt(val)
                  if (!isNaN(n) && n > 0) setRestTime(n)
                }} min="5" />
                <label>Rounds</label>
                <input type="number" value={intervalRounds} onChange={e => {
                  const val = e.target.value
                  if (val === '') { setIntervalRounds(''); return }
                  const n = parseInt(val)
                  if (!isNaN(n) && n > 0) setIntervalRounds(n)
                }} min="1" />
                <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: '4px' }}>
                  Total: {formatTime(((parseInt(workTime) || 0) + (parseInt(restTime) || 0)) * (parseInt(intervalRounds) || 0))}
                </div>
              </div>
            )}

            <button className="timer-start-btn" onClick={startTimer}>START</button>
          </div>
        )}

        {/* 3-2-1 countdown */}
        {countdown321 !== null && (
          <div className="timer-321">
            <div className="timer-321-num">{countdown321}</div>
          </div>
        )}

        {/* Active timer */}
        {isActive && (
          <div className={`timer-display${isRest ? ' rest' : ''}${finished ? ' done' : ''}`}>
            {progress > 0 && (
              <div className="timer-progress">
                <div className="timer-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
              </div>
            )}
            <div className="timer-time">{displayTime}</div>
            <div className="timer-label">{displayLabel}</div>
            {displayRound && <div className="timer-round">{displayRound}</div>}
            {finished && <div className="timer-finished">COMPLETE 🦍</div>}
            {finished && session && !timerLogged && (
              <div className="timer-log-prompt" onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '6px' }}>Log your result?</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <input placeholder={isTimeScore ? 'Time' : 'Score (optional)'} value={timerLogScore} onChange={e => setTimerLogScore(e.target.value)}
                    style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '5px', padding: '7px 10px', color: '#fff', fontSize: '13px', width: '120px', outline: 'none' }} />
                  <input placeholder="Notes (optional)" value={timerLogNotes} onChange={e => setTimerLogNotes(e.target.value)}
                    style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '5px', padding: '7px 10px', color: '#fff', fontSize: '13px', width: '120px', outline: 'none' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={timerLogRx} onChange={e => setTimerLogRx(e.target.checked)} style={{ accentColor: '#22c55e' }} />
                    <span style={{ fontWeight: 700, color: timerLogRx ? '#22c55e' : '#888' }}>Rx</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                  <button className="timer-ctrl-btn" onClick={async () => {
                    const { supabase } = await import('../lib/supabase')
                    await supabase.from('performance_log').insert({
                      user_id: session.user.id, workout_id: workout.id,
                      completed_at: new Date().toISOString().slice(0, 10),
                      score: timerLogScore.trim() || null,
                      notes: timerLogNotes.trim() || null,
                      is_rx: timerLogRx,
                    })
                    setTimerLogged(true)
                    if (onWorkoutsChanged) onWorkoutsChanged()
                  }}>✓ Save</button>
                  <button className="timer-ctrl-btn sec" onClick={() => setTimerLogged(true)}>Skip</button>
                </div>
              </div>
            )}
            {finished && timerLogged && (
              <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>✓ Logged!</div>
            )}
            <div className="timer-controls">
              {!finished && (
                <button className="timer-ctrl-btn" onClick={togglePause}>
                  {running ? '⏸ Pause' : '▶ Resume'}
                </button>
              )}
              {!finished && mode === 'stopwatch' && elapsed > 0 && (
                <button className="timer-ctrl-btn" onClick={finishTimer} style={{ background: 'var(--grn)', color: '#fff' }}>🏁 Finish</button>
              )}
              <button className="timer-ctrl-btn sec" onClick={resetTimer}>↺ Reset</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
