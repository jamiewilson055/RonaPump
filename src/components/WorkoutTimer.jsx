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

export default function WorkoutTimer({ workout, onClose }) {
  const [mode, setMode] = useState(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [countdown321, setCountdown321] = useState(null)
  const intervalRef = useRef(null)
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

    // Re-acquire on visibility change
    function handleVisibility() {
      if (document.visibilityState === 'visible' && running) {
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
    } else {
      setMode('stopwatch')
    }
  }, [])

  function initAudio() { getAudioCtx() }

  function startTimer() {
    initAudio()
    setCountdown321(3)
  }

  useEffect(() => {
    if (countdown321 === null) return
    if (countdown321 === 0) {
      setCountdown321(null)
      setRunning(true)
      setElapsed(0)
      setFinished(false)
      playBeep(1100, 0.3, 0.5)
      return
    }
    playBeep(660, 0.12, 0.3)
    const t = setTimeout(() => setCountdown321(countdown321 - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown321])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1

          if (mode === 'countdown' && next >= totalSeconds) {
            setRunning(false); setFinished(true); playTripleBeep(); return totalSeconds
          }
          if (mode === 'countdown') {
            const remaining = totalSeconds - next
            if (remaining === 3 || remaining === 2 || remaining === 1) playBeep(660, 0.1, 0.3)
          }
          if (mode === 'emom') {
            const totalEmom = emomRounds * emomInterval
            if (next >= totalEmom) { setRunning(false); setFinished(true); playTripleBeep(); return totalEmom }
            if (next % emomInterval === 0) playDoubleBeep()
            const timeInRound = next % emomInterval
            const timeLeft = emomInterval - timeInRound
            if (timeLeft === 3 || timeLeft === 2 || timeLeft === 1) playBeep(660, 0.1, 0.3)
          }
          if (mode === 'interval') {
            const roundTime = workTime + restTime
            const totalInt = intervalRounds * roundTime
            if (next >= totalInt) { setRunning(false); setFinished(true); playTripleBeep(); return totalInt }
            const posInRound = next % roundTime
            if (posInRound === 0) playDoubleBeep()
            if (posInRound === workTime) playBeep(440, 0.2, 0.3)
            if (posInRound === workTime - 3 || posInRound === workTime - 2 || posInRound === workTime - 1) playBeep(660, 0.1, 0.2)
          }
          if (mode === 'stopwatch') {
            if (next > 0 && next % 60 === 0) playBeep(880, 0.15, 0.3)
          }
          return next
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, totalSeconds, emomRounds, emomInterval, workTime, restTime, intervalRounds])

  function togglePause() {
    if (!running) initAudio()
    setRunning(!running)
  }

  function resetTimer() { setRunning(false); setElapsed(0); setFinished(false) }

  let displayTime = '', displayLabel = '', displayRound = '', progress = 0, isRest = false

  if (mode === 'stopwatch') {
    displayTime = formatTime(elapsed); displayLabel = 'Elapsed'
  } else if (mode === 'countdown') {
    displayTime = formatTime(Math.max(totalSeconds - elapsed, 0)); displayLabel = 'Remaining'
    progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0
  } else if (mode === 'emom') {
    const totalEmom = emomRounds * emomInterval
    const currentRound = Math.floor(elapsed / emomInterval) + 1
    displayTime = formatTime(emomInterval - (elapsed % emomInterval))
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
    displayTime = formatTime(timeLeft); displayLabel = isRest ? 'REST' : 'WORK'
    displayRound = `Round ${Math.min(currentRound, intervalRounds)} of ${intervalRounds}`
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
            if (line.startsWith('• ')) return <div key={i} className="timer-li">{line.slice(2)}</div>
            if (line.trim() === '') return <br key={i} />
            return <div key={i}>{line}</div>
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
                <input type="number" value={customMins} onChange={e => { setCustomMins(e.target.value); setTotalSeconds((parseInt(e.target.value) || 0) * 60) }} min="1" />
              </div>
            )}
            {mode === 'emom' && (
              <div className="timer-config">
                <label>Rounds</label>
                <input type="number" value={emomRounds} onChange={e => setEmomRounds(parseInt(e.target.value) || 1)} min="1" />
                <label>Sec/round</label>
                <input type="number" value={emomInterval} onChange={e => setEmomInterval(parseInt(e.target.value) || 60)} min="10" />
              </div>
            )}
            {mode === 'interval' && (
              <div className="timer-config">
                <label>Work</label>
                <input type="number" value={workTime} onChange={e => setWorkTime(parseInt(e.target.value) || 10)} min="5" />
                <label>Rest</label>
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
    </div>
  )
}
