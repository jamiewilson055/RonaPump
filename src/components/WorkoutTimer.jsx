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

export default function WorkoutTimer({ workout, onClose }) {
  const [mode, setMode] = useState(null) // 'stopwatch', 'countdown', 'emom', 'interval'
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [countdown321, setCountdown321] = useState(null)
  const intervalRef = useRef(null)
  const audioRef = useRef(null)

  // EMOM specific
  const [emomInterval, setEmomInterval] = useState(60)
  const [emomRounds, setEmomRounds] = useState(10)

  // Interval specific
  const [workTime, setWorkTime] = useState(30)
  const [restTime, setRestTime] = useState(30)
  const [intervalRounds, setIntervalRounds] = useState(8)

  // Custom countdown
  const [customMins, setCustomMins] = useState('')

  const w = workout
  const wt = w.workout_types || []

  // Auto-detect timer mode
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
    } else if (wt.includes('Interval')) {
      setMode('interval')
    } else if (wt.includes('For Time')) {
      setMode('stopwatch')
    } else if (wt.includes('For Calories') || wt.includes('For Distance')) {
      setMode('stopwatch')
    } else {
      setMode('stopwatch')
    }
  }, [])

  const beep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) {}
  }, [])

  const doubleBeep = useCallback(() => {
    beep()
    setTimeout(beep, 200)
  }, [beep])

  function startTimer() {
    setCountdown321(3)
  }

  // 3-2-1 countdown
  useEffect(() => {
    if (countdown321 === null) return
    if (countdown321 === 0) {
      setCountdown321(null)
      setRunning(true)
      setElapsed(0)
      setFinished(false)
      beep()
      return
    }
    const t = setTimeout(() => {
      beep()
      setCountdown321(countdown321 - 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [countdown321, beep])

  // Main timer
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1

          if (mode === 'countdown' && next >= totalSeconds) {
            setRunning(false)
            setFinished(true)
            doubleBeep()
            return totalSeconds
          }

          if (mode === 'emom') {
            const totalEmom = emomRounds * emomInterval
            if (next >= totalEmom) {
              setRunning(false)
              setFinished(true)
              doubleBeep()
              return totalEmom
            }
            // Beep at start of each round
            if (next % emomInterval === 0) beep()
          }

          if (mode === 'interval') {
            const roundTime = workTime + restTime
            const totalInt = intervalRounds * roundTime
            if (next >= totalInt) {
              setRunning(false)
              setFinished(true)
              doubleBeep()
              return totalInt
            }
            const posInRound = next % roundTime
            if (posInRound === 0) beep() // start of work
            if (posInRound === workTime) beep() // start of rest
          }

          return next
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, totalSeconds, emomRounds, emomInterval, workTime, restTime, intervalRounds, beep, doubleBeep])

  function togglePause() {
    setRunning(!running)
  }

  function resetTimer() {
    setRunning(false)
    setElapsed(0)
    setFinished(false)
  }

  // Display values
  let displayTime = ''
  let displayLabel = ''
  let displayRound = ''
  let progress = 0
  let isRest = false

  if (mode === 'stopwatch') {
    displayTime = formatTime(elapsed)
    displayLabel = 'Elapsed'
  } else if (mode === 'countdown') {
    const remaining = Math.max(totalSeconds - elapsed, 0)
    displayTime = formatTime(remaining)
    displayLabel = 'Remaining'
    progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0
  } else if (mode === 'emom') {
    const totalEmom = emomRounds * emomInterval
    const currentRound = Math.floor(elapsed / emomInterval) + 1
    const timeInRound = emomInterval - (elapsed % emomInterval)
    displayTime = formatTime(timeInRound)
    displayLabel = `Round ${Math.min(currentRound, emomRounds)} of ${emomRounds}`
    displayRound = formatTime(Math.max(totalEmom - elapsed, 0)) + ' total'
    progress = totalEmom > 0 ? (elapsed / totalEmom) * 100 : 0
  } else if (mode === 'interval') {
    const roundTime = workTime + restTime
    const totalInt = intervalRounds * roundTime
    const currentRound = Math.floor(elapsed / roundTime) + 1
    const posInRound = elapsed % roundTime
    isRest = posInRound >= workTime
    const timeLeft = isRest ? (roundTime - posInRound) : (workTime - posInRound)
    displayTime = formatTime(timeLeft)
    displayLabel = isRest ? 'REST' : 'WORK'
    displayRound = `Round ${Math.min(currentRound, intervalRounds)} of ${intervalRounds}`
    progress = totalInt > 0 ? (elapsed / totalInt) * 100 : 0
  }

  return (
    <div className="timer-overlay">
      <div className="timer-header">
        <button className="timer-close" onClick={onClose}>✕ Exit</button>
        <div className="timer-workout-name">{w.name || 'Workout'}</div>
      </div>

      {/* Workout description in large font */}
      <div className="timer-desc">
        {w.description?.split('\n').map((line, i) => {
          if (line.startsWith('• ')) return <div key={i} className="timer-li">{line.slice(2)}</div>
          if (line.trim() === '') return <br key={i} />
          return <div key={i}>{line}</div>
        })}
      </div>

      {/* Timer setup (before starting) */}
      {!running && !finished && elapsed === 0 && countdown321 === null && (
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
              <input type="number" value={customMins} onChange={e => { setCustomMins(e.target.value); setTotalSeconds((parseInt(e.target.value) || 0) * 60) }} min="1" />
            </div>
          )}

          {mode === 'emom' && (
            <div className="timer-config">
              <label>Rounds</label>
              <input type="number" value={emomRounds} onChange={e => setEmomRounds(parseInt(e.target.value) || 1)} min="1" />
              <label>Seconds per round</label>
              <input type="number" value={emomInterval} onChange={e => setEmomInterval(parseInt(e.target.value) || 60)} min="10" />
            </div>
          )}

          {mode === 'interval' && (
            <div className="timer-config">
              <label>Work (sec)</label>
              <input type="number" value={workTime} onChange={e => setWorkTime(parseInt(e.target.value) || 10)} min="5" />
              <label>Rest (sec)</label>
              <input type="number" value={restTime} onChange={e => setRestTime(parseInt(e.target.value) || 10)} min="5" />
              <label>Rounds</label>
              <input type="number" value={intervalRounds} onChange={e => setIntervalRounds(parseInt(e.target.value) || 1)} min="1" />
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

      {/* Active timer display */}
      {(running || elapsed > 0 || finished) && countdown321 === null && (
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

          <div className="timer-controls">
            {!finished && (
              <button className="timer-ctrl-btn" onClick={togglePause}>
                {running ? '⏸ Pause' : '▶ Resume'}
              </button>
            )}
            <button className="timer-ctrl-btn sec" onClick={resetTimer}>↺ Reset</button>
          </div>
        </div>
      )}
    </div>
  )
}
