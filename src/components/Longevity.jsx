import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StoryCard from './StoryCard'

// Research-based weights — higher = stronger mortality evidence
const WEIGHTS = { vo2max: 1.5, grip: 1.4, deadhang: 1.3, sitrise: 1.2, balance: 1.2, pushup: 1.1, farmerscarry: 1.0, squat60: 1.0, bike60: 0.9, broadjump: 0.9 }

const MARKERS = [
  {
    key: 'broadjump', name: 'Broad Jump', icon: '🦘', domain: 'Explosive Power',
    unit: 'inches', inputLabel: 'Distance (inches)',
    desc: 'Power declines ~3x faster than strength with age. Independently predicts fall risk and mortality. Tests total-body power + coordination.',
    howToTest: 'Toes behind a line, feet shoulder-width. Jump as far forward as you can. Measure to nearest heel. Best of 3.',
    source: 'ALPHA-FIT European battery; Skelton et al. — power independently predicts mortality',
    benchmarks: {
      male:   { '20-29': [65, 76, 88, 98, 110], '30-39': [58, 70, 82, 92, 104], '40-49': [50, 62, 74, 85, 97], '50-59': [42, 54, 66, 78, 90], '60+': [34, 46, 57, 69, 82] },
      female: { '20-29': [48, 58, 68, 78, 90], '30-39': [42, 52, 63, 73, 85], '40-49': [36, 46, 57, 67, 79], '50-59': [30, 40, 50, 61, 72], '60+': [24, 34, 44, 55, 66] },
    },
  },
  {
    key: 'sitrise', name: 'Sit-Rise Test', icon: '🧘', domain: 'Composite (5-in-1)',
    unit: 'score', inputLabel: 'Score (0-10)', allowZero: true,
    desc: 'The only test evaluating strength, power, flexibility, balance, AND body composition simultaneously. Each 1-point increase = 21% survival improvement.',
    howToTest: 'Stand barefoot. Sit cross-legged, then stand up. 5 pts per movement. Subtract 1 per hand/knee/forearm/leg used. Subtract 0.5 for wobbling.',
    source: 'Araújo et al. 2012 — 2,002 subjects, 6.3-year follow-up',
    benchmarks: {
      male:   { '20-29': [6, 7, 8, 9, 10], '30-39': [5, 6.5, 7.5, 8.5, 10], '40-49': [4, 5.5, 7, 8, 9.5], '50-59': [3, 4.5, 6, 7.5, 9], '60+': [2, 3.5, 5, 7, 8.5] },
      female: { '20-29': [6, 7, 8, 9, 10], '30-39': [5, 6.5, 7.5, 8.5, 10], '40-49': [4, 5.5, 7, 8, 9.5], '50-59': [3, 4.5, 6, 7.5, 9], '60+': [2, 3.5, 5, 7, 8.5] },
    },
  },
  {
    key: 'balance', name: 'Single-Leg Balance', icon: '🦩', domain: 'Balance & Neuromuscular',
    unit: 'seconds', inputLabel: 'Time (seconds, eyes closed)',
    bilateral: true, sides: ['Left', 'Right'], timer: 'stopwatch',
    desc: 'Inability to balance 10s on one leg nearly doubles all-cause mortality risk. Eyes closed removes visual input for a deeper neuromuscular test. Both legs are tested; your score is the weaker leg, and a big left/right gap is flagged.',
    howToTest: 'Stand on one leg, hands on hips, close eyes. Time until other foot touches or eyes open. Best of 3 on each leg. Score = weaker leg.',
    source: 'Araújo et al. 2022 (Br J Sports Med) — 1,702 subjects',
    benchmarks: {
      male:   { '20-29': [10, 18, 30, 45, 65], '30-39': [7, 14, 24, 38, 55], '40-49': [5, 10, 18, 30, 45], '50-59': [3, 7, 13, 22, 35], '60+': [2, 5, 9, 16, 25] },
      female: { '20-29': [10, 18, 30, 45, 65], '30-39': [7, 14, 24, 38, 55], '40-49': [5, 10, 18, 30, 45], '50-59': [3, 7, 13, 22, 35], '60+': [2, 5, 9, 16, 25] },
    },
  },
  {
    key: 'pushup', name: 'Push-Up Max', icon: '💪', domain: 'Upper Body Endurance',
    unit: 'reps', inputLabel: 'Max reps (no rest)',
    desc: 'Harvard/JAMA: 40+ push-ups = 96% lower cardiovascular event risk vs <10. Tests chest, shoulders, triceps, core.',
    howToTest: 'Standard push-up, hands shoulder-width. Chest to floor, full lockout. Go to failure. Count total reps.',
    source: 'Yang et al. 2019 — JAMA Network Open, 1,104 subjects, 10-year follow-up',
    benchmarks: {
      male:   { '20-29': [15, 22, 30, 40, 55], '30-39': [12, 17, 25, 35, 48], '40-49': [10, 14, 20, 30, 42], '50-59': [7, 11, 16, 24, 35], '60+': [5, 9, 12, 20, 28] },
      female: { '20-29': [8, 14, 20, 30, 42], '30-39': [6, 10, 16, 24, 35], '40-49': [4, 8, 12, 20, 28], '50-59': [3, 5, 10, 16, 22], '60+': [2, 4, 7, 12, 18] },
    },
  },
  {
    key: 'squat60', name: 'Squat 60s', icon: '🦵', domain: 'Lower Body Endurance',
    unit: 'reps', inputLabel: 'Max reps in 60 seconds', timer: 'countdown', countdown: 60,
    desc: 'Dynamic version of the CDC chair stand test — a validated mortality predictor. Tests quad strength, glute endurance, cardiovascular recovery.',
    howToTest: '60-second timer. Bodyweight squats — hip crease below knee, full stand. Count total reps.',
    source: 'Jones et al. 1999 (chair stand); CDC Functional Fitness Battery',
    benchmarks: {
      male:   { '20-29': [25, 33, 42, 52, 64], '30-39': [22, 29, 38, 48, 60], '40-49': [18, 25, 34, 44, 55], '50-59': [15, 21, 29, 39, 50], '60+': [12, 17, 24, 34, 44] },
      female: { '20-29': [20, 27, 36, 46, 58], '30-39': [18, 24, 32, 42, 53], '40-49': [15, 20, 28, 38, 48], '50-59': [12, 17, 24, 33, 43], '60+': [10, 14, 20, 28, 38] },
    },
  },
  {
    key: 'farmerscarry', name: "Farmer's Carry", icon: '🏋️', domain: 'Functional Strength',
    unit: 'seconds', inputLabel: 'Time walking (seconds)', timer: 'stopwatch',
    desc: 'Men carry 100% of bodyweight (split across two DBs/KBs). Women carry 75% of bodyweight. Walk until grip fails.',
    howToTest: 'Men: 50% BW in each hand (total = 100% BW). Women: ~37.5% each hand (total = 75% BW). Walk steadily. Record time until you set the weight down.',
    source: 'Attia/Huberman — men 100% BW / women 75% BW for 2 min. Exceptional: 2x BW trap bar 30s.',
    benchmarks: {
      male:   { '20-29': [15, 30, 55, 90, 130], '30-39': [12, 26, 48, 80, 120], '40-49': [10, 22, 42, 70, 110], '50-59': [8, 18, 35, 60, 95], '60+': [5, 14, 28, 50, 80] },
      female: { '20-29': [12, 26, 48, 80, 120], '30-39': [10, 22, 42, 70, 110], '40-49': [8, 18, 36, 60, 95], '50-59': [6, 14, 30, 50, 80], '60+': [4, 10, 24, 42, 65] },
    },
  },
  {
    key: 'deadhang', name: 'Dead Hang', icon: '🤲', domain: 'Grip & Shoulders',
    unit: 'seconds', inputLabel: 'Time (seconds)', timer: 'stopwatch',
    desc: 'Grip strength is one of the strongest predictors of all-cause mortality. Attia: men 2 min, women 90s at age 40. Reduced ~10-15% per decade.',
    howToTest: 'Overhand grip on pull-up bar, shoulder-width. Arms fully extended, feet off ground. Time until failure.',
    source: 'Bohannon 2019 (Clinical Interventions in Aging); Attia/Outlive',
    benchmarks: {
      male:   { '20-29': [30, 55, 85, 120, 150], '30-39': [25, 48, 75, 110, 140], '40-49': [20, 40, 65, 100, 130], '50-59': [15, 32, 52, 80, 110], '60+': [10, 22, 40, 65, 90] },
      female: { '20-29': [15, 32, 55, 90, 120], '30-39': [12, 27, 45, 78, 105], '40-49': [10, 22, 38, 68, 90], '50-59': [8, 16, 30, 55, 75], '60+': [5, 12, 22, 42, 60] },
    },
  },
  {
    key: 'vo2max', name: 'VO2 Max', icon: '❤️', domain: 'Cardio Capacity',
    unit: 'ml/kg/min', inputLabel: 'VO2 Max (ml/kg/min)', timer: 'countdown', countdown: 720, cooper: true,
    desc: 'The strongest predictor of lifespan — every 1-MET increase = 11-17% mortality reduction across 20.9M observations. Attia targets 75th percentile, ideally 90th.',
    howToTest: 'Cooper Test: run as far as you can in 12 min. VO2 ≈ (meters - 504.9) / 44.73. Or enter from your wearable (Apple Watch, WHOOP, Garmin).',
    source: 'Lang et al. 2024 (Br J Sports Med) — 199 cohorts, 20.9M observations',
    benchmarks: {
      male:   { '20-29': [33, 36, 42, 48, 55], '30-39': [31, 34, 40, 45, 52], '40-49': [29, 32, 37, 42, 49], '50-59': [26, 29, 34, 39, 45], '60+': [22, 26, 31, 36, 42] },
      female: { '20-29': [27, 30, 35, 40, 48], '30-39': [25, 28, 33, 38, 45], '40-49': [23, 26, 31, 35, 42], '50-59': [21, 24, 28, 33, 39], '60+': [18, 22, 26, 30, 36] },
    },
  },
  {
    key: 'bike60', name: '60s Max Cal Bike', icon: '🚴', domain: 'Anaerobic Power',
    unit: 'cals', inputLabel: 'Calories in 60 seconds', timer: 'countdown', countdown: 60,
    desc: 'All-out Assault or Echo Bike for 60 seconds. Measures peak anaerobic output and cardiovascular recovery capacity.',
    howToTest: 'Warm up 3-5 min. Go absolute max effort for exactly 60 seconds. Record total calories.',
    source: 'Anaerobic capacity correlates with VO2 max. RonaPump benchmarks from competitive functional fitness data.',
    benchmarks: {
      male:   { '20-29': [18, 23, 29, 36, 44], '30-39': [16, 21, 27, 33, 40], '40-49': [14, 19, 25, 31, 37], '50-59': [12, 16, 22, 28, 34], '60+': [10, 14, 19, 25, 30] },
      female: { '20-29': [12, 16, 21, 27, 33], '30-39': [10, 14, 19, 25, 31], '40-49': [9, 12, 17, 23, 28], '50-59': [7, 10, 15, 20, 25], '60+': [6, 9, 13, 17, 22] },
    },
  },
  {
    key: 'grip', name: 'Grip Strength', icon: '🤜', domain: 'Direct Mortality Predictor',
    unit: 'lbs', inputLabel: 'Max grip (lbs)',
    desc: 'The most directly studied longevity biomarker. Requires a hand dynamometer (~$25). Inversely associated with all-cause mortality, CVD, dementia.',
    howToTest: 'Hand dynamometer, dominant hand, arm at side, elbow at 90°. Squeeze max effort. Best of 3.',
    source: 'Bohannon 2019 (Clinical Interventions in Aging) — meta-analysis, 9,431+ subjects',
    optional: true,
    benchmarks: {
      male:   { '20-29': [80, 96, 112, 128, 148], '30-39': [78, 93, 108, 124, 142], '40-49': [72, 86, 102, 118, 136], '50-59': [64, 78, 94, 110, 128], '60+': [52, 66, 82, 98, 116] },
      female: { '20-29': [44, 55, 66, 78, 94], '30-39': [42, 52, 63, 76, 90], '40-49': [38, 48, 58, 72, 86], '50-59': [34, 43, 54, 66, 80], '60+': [28, 36, 46, 58, 72] },
    },
  },
]

const MIN_MARKERS = 3   // Vital Age hidden until this many markers are tested
const STALE_DAYS = 90   // a reading older than this is flagged "retest due"

function daysSince(dateStr) { if (!dateStr) return Infinity; return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000) }
function isStale(dateStr) { return daysSince(dateStr) > STALE_DAYS }

const LEVEL_LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']
const LEVEL_COLORS = ['#e01e1e', '#e0881e', '#e0c81e', '#4ade80', '#22d3ee']

function getAgeBracket(age) { if (age < 30) return '20-29'; if (age < 40) return '30-39'; if (age < 50) return '40-49'; if (age < 60) return '50-59'; return '60+' }

function scoreMarker(value, benchmarks, gender, age) {
  const levels = benchmarks?.[gender]?.[getAgeBracket(age)]
  if (!levels || value == null) return { score: 0, level: -1, levelLabel: 'Not tested' }
  let level = -1
  for (let i = levels.length - 1; i >= 0; i--) { if (value >= levels[i]) { level = i; break } }
  if (level < 0) return { score: Math.round(Math.max(0, (value / levels[0]) * 2) * 10) / 10, level: -1, levelLabel: 'Below Poor', target: levels[0] }
  const base = (level + 1) * 2
  const next = level < 4 ? levels[level + 1] : levels[4] * 1.2
  const pct = next > levels[level] ? Math.min(1, (value - levels[level]) / (next - levels[level])) : 1
  return { score: Math.min(10, Math.round((base - 2 + pct * 2) * 10) / 10), level, levelLabel: LEVEL_LABELS[level], target: level < 4 ? levels[level + 1] : null }
}

function computeVitalAge(idx, ca) {
  let va
  if (idx >= 90) va = ca - Math.round((idx - 90) * 1.5)
  else if (idx >= 70) va = ca - Math.round((idx - 70) * 0.5)
  else if (idx >= 50) va = ca
  else if (idx >= 30) va = ca + Math.round((50 - idx) * 0.4)
  else va = ca + Math.round((50 - idx) * 0.75)
  // Clamp: never more than 12 years younger (floor 16) or 25 years older than actual age
  return Math.min(ca + 25, Math.max(Math.max(16, ca - 12), va))
}

function fmtClock(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}` }

// Inline stopwatch / countdown for Test Day
function TestTimer({ mode, seconds, onUse, sides }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const startRef = useRef(0), rafRef = useRef(null)

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const e = (Date.now() - startRef.current) / 1000
      if (mode === 'countdown' && e >= seconds) {
        setElapsed(seconds); setRunning(false); setDone(true)
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]) } catch {}
        return
      }
      setElapsed(e); rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, mode, seconds])

  const start = () => { startRef.current = Date.now() - elapsed * 1000; setDone(false); setRunning(true) }
  const stop = () => { setRunning(false); if (mode === 'stopwatch') setDone(true) }
  const reset = () => { setRunning(false); setElapsed(0); setDone(false) }
  const display = mode === 'countdown' ? Math.max(0, seconds - elapsed) : elapsed
  const result = Math.round(elapsed * 10) / 10

  return (
    <div className={`lon-timer${running ? ' running' : ''}${done ? ' done' : ''}`}>
      <div className="lon-timer-clock">{fmtClock(display)}</div>
      <div className="lon-timer-ctrls">
        {!running && !done && <button className="lon-timer-btn go" onClick={start}>{elapsed > 0 ? '▶ Resume' : mode === 'countdown' ? `▶ Start ${seconds >= 60 ? seconds / 60 + ' min' : seconds + 's'}` : '▶ Start'}</button>}
        {running && <button className="lon-timer-btn stop" onClick={stop}>■ Stop</button>}
        {(elapsed > 0 || done) && !running && <button className="lon-timer-btn" onClick={reset}>↺ Reset</button>}
      </div>
      {done && mode === 'countdown' && <div className="lon-timer-msg">⏰ Time! Enter your result below.</div>}
      {done && mode === 'stopwatch' && (
        <div className="lon-timer-use">
          {sides ? sides.map(sd => <button key={sd} className="lon-timer-btn use" onClick={() => { onUse(result, sd); reset() }}>Use {result}s for {sd}</button>)
                 : <button className="lon-timer-btn use" onClick={() => { onUse(result); reset() }}>Use {result}s</button>}
        </div>
      )}
    </div>
  )
}

// Cooper test: 12-min distance → VO2 max
function CooperCalc({ onUse }) {
  const [m, setM] = useState('')
  const vo2 = m ? Math.round(((parseFloat(m) - 504.9) / 44.73) * 10) / 10 : null
  return (
    <div className="lon-cooper">
      <span className="lon-side-label">Cooper</span>
      <input type="number" inputMode="numeric" className="orm-input" placeholder="meters in 12 min" value={m} onChange={e => setM(e.target.value)} />
      {vo2 != null && vo2 > 0 && <button className="lon-timer-btn use" onClick={() => onUse(vo2)}>→ {vo2}</button>}
    </div>
  )
}

const ASYM_THRESHOLD = 0.2 // 20%+ left/right gap gets flagged

function asymmetry(l, r) {
  if (l == null || r == null) return null
  const hi = Math.max(l, r), lo = Math.min(l, r)
  if (hi <= 0) return null
  return { pct: Math.round(((hi - lo) / hi) * 100), weaker: l < r ? 'L' : r < l ? 'R' : null, flagged: (hi - lo) / hi >= ASYM_THRESHOLD }
}

function SidesTag({ row, unit }) {
  if (!row || row.value_left == null || row.value_right == null) return null
  const a = asymmetry(Number(row.value_left), Number(row.value_right))
  return (
    <span className="lon-sides">
      L {Number(row.value_left)} / R {Number(row.value_right)} {unit === 'seconds' ? 's' : unit}
      {a?.flagged && <span className="lon-asym-tag" title={`${a.pct}% gap between legs`}>⚠ {a.pct}% gap</span>}
    </span>
  )
}

function SparkChart({ data, unit, color }) {
  if (!data || data.length < 2) return null
  const vals = data.map(d => d.value), min = Math.min(...vals) * 0.9, max = Math.max(...vals) * 1.1, range = max - min || 1
  const W = 260, H = 60, pad = 4
  const pts = data.map((d, i) => ({ x: pad + (i / (data.length - 1)) * (W - pad * 2), y: pad + (1 - (d.value - min) / range) * (H - pad * 2) }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '60px', display: 'block' }}>
      <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke={color || 'var(--acc)'} strokeWidth="2" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color || 'var(--acc)'}><title>{data[i].tested_at}: {data[i].value} {unit}</title></circle>)}
    </svg>
  )
}

// Which workout filters fix which marker (Focus Areas → workout list)
const MARKER_WORKOUT_FILTERS = {
  vo2max:       { filters: { cat: ['Cardio Only'] },        label: 'Cardio workouts' },
  bike60:       { filters: { eq: ['Air Bike'] },            label: 'Air Bike workouts' },
  deadhang:     { filters: { eq: ['Pull-Up Bar'] },         label: 'Pull-Up Bar workouts' },
  grip:         { filters: { mv: ['Farmers Carry'] },       label: 'Carry workouts' },
  farmerscarry: { filters: { mv: ['Farmers Carry'] },       label: 'Carry workouts' },
  pushup:       { filters: { mv: ['Push-Up'] },             label: 'Push-Up workouts' },
  squat60:      { filters: { mv: ['Squat'] },               label: 'Squat workouts' },
  broadjump:    { filters: { mv: ['Jump'] },                label: 'Jump workouts' },
  balance:      { filters: { mv: ['Lunge'] },               label: 'Single-leg workouts' },
  sitrise:      { filters: { bp: ['Lower Body'] },          label: 'Lower-body workouts' },
}

function parseBodyweight(w) { if (w == null) return null; const n = parseFloat(String(w)); if (isNaN(n) || n <= 0) return null; return /kg/i.test(String(w)) ? Math.round(n * 2.2046) : Math.round(n) }

export default function Longevity({ session, onAuthRequired, onOpenWorkouts }) {
  const [scores, setScores] = useState([])
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('male')
  const [bodyweight, setBodyweight] = useState('')
  const [vaBoard, setVaBoard] = useState([])
  const [expandedMarker, setExpandedMarker] = useState(null)
  const [testMode, setTestMode] = useState(false)
  const [testStep, setTestStep] = useState(0)
  const [testOrder, setTestOrder] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [inputLeft, setInputLeft] = useState('')
  const [inputRight, setInputRight] = useState('')
  const [inputNotes, setInputNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [editingScoreId, setEditingScoreId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editLeft, setEditLeft] = useState('')
  const [editRight, setEditRight] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showStory, setShowStory] = useState(false)

  useEffect(() => { if (session) { loadScores(); loadProfile(); loadVaBoard() } }, [session])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('age, gender, weight').eq('id', session.user.id).single()
    if (data) { if (data.age) setAge(String(data.age)); if (data.gender) setGender(data.gender); const bw = parseBodyweight(data.weight); if (bw) setBodyweight(String(bw)) }
    setProfileLoaded(true)
  }

  async function saveBodyweight(bw) {
    const n = parseFloat(bw)
    if (isNaN(n) || n <= 0) return
    // profiles.weight is free text shared with the Profile page — keep its "185 lbs" format
    await supabase.from('profiles').update({ weight: `${Math.round(n)} lbs` }).eq('id', session.user.id)
  }

  async function loadVaBoard() {
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url, age, vital_age, longevity_index').not('vital_age', 'is', null).not('age', 'is', null).limit(200)
    if (!data) return
    const rows = data.map(p => ({ ...p, diff: Number(p.age) - Number(p.vital_age) })).sort((a, b) => b.diff - a.diff || Number(b.longevity_index) - Number(a.longevity_index))
    setVaBoard(rows)
  }

  async function loadScores() {
    const { data } = await supabase.from('longevity_scores').select('*').eq('user_id', session.user.id).order('tested_at', { ascending: false })
    if (data) setScores(data)
  }

  async function saveAge(a, g) {
    if (a && parseInt(a) > 0) await supabase.from('profiles').update({ age: parseInt(a), gender: g }).eq('id', session.user.id)
  }

  async function saveScore(markerKey) {
    if (!session) { onAuthRequired(); return }
    const marker = MARKERS.find(m => m.key === markerKey)
    let val, sides = {}
    if (marker?.bilateral) {
      const l = parseFloat(inputLeft), r = parseFloat(inputRight)
      if (isNaN(l) || isNaN(r) || l < 0 || r < 0) return
      val = Math.min(l, r) // score = weaker side
      sides = { value_left: l, value_right: r }
    } else {
      val = parseFloat(inputValue)
      if (isNaN(val) || val < 0 || (val === 0 && !marker?.allowZero)) return
    }
    setSaving(true)
    await supabase.from('longevity_scores').insert({ user_id: session.user.id, marker: markerKey, value: val, unit: marker?.unit || '', notes: inputNotes.trim() || null, tested_at: new Date().toISOString().slice(0, 10), ...sides })
    setInputValue(''); setInputLeft(''); setInputRight(''); setInputNotes(''); setSaving(false)
    await loadScores()
    // Always update vital age
    saveAge(age, gender)
    updateVitalAge()
  }

  async function editScore(id, bilateral, allowZero) {
    let patch
    if (bilateral) {
      const l = parseFloat(editLeft), r = parseFloat(editRight)
      if (isNaN(l) || isNaN(r) || l < 0 || r < 0) return
      patch = { value: Math.min(l, r), value_left: l, value_right: r }
    } else {
      const val = parseFloat(editVal)
      if (isNaN(val) || val < 0 || (val === 0 && !allowZero)) return
      patch = { value: val }
    }
    await supabase.from('longevity_scores').update(patch).eq('id', id)
    setEditingScoreId(null); setEditVal(''); setEditLeft(''); setEditRight(''); loadScores(); updateVitalAge()
  }

  async function deleteScore(id) {
    if (!confirm('Delete this reading?')) return
    await supabase.from('longevity_scores').delete().eq('id', id)
    loadScores(); updateVitalAge()
  }

  async function updateVitalAge() {
    if (!age) return
    setTimeout(async () => {
      const { data } = await supabase.from('longevity_scores').select('*').eq('user_id', session.user.id).order('tested_at', { ascending: false })
      if (!data) return
      const latest = {}; data.forEach(s => { if (!latest[s.marker]) latest[s.marker] = s })
      const tested = MARKERS.filter(m => latest[m.key])
      if (!tested.length) return
      let totalWeightedScore = 0, totalWeight = 0
      tested.forEach(m => {
        const r = scoreMarker(latest[m.key].value, m.benchmarks, gender, parseInt(age))
        const w = WEIGHTS[m.key] || 1.0
        totalWeightedScore += r.score * w
        totalWeight += 10 * w
      })
      const idx = Math.round((totalWeightedScore / totalWeight) * 100)
      const va = tested.length >= MIN_MARKERS ? computeVitalAge(idx, parseInt(age)) : null
      await supabase.from('profiles').update({ longevity_index: idx, vital_age: va }).eq('id', session.user.id)
      loadVaBoard()
    }, 300)
  }

  const latestScores = useMemo(() => { const m = {}; scores.forEach(s => { if (!m[s.marker]) m[s.marker] = s }); return m }, [scores])
  const prevScores = useMemo(() => { const seen = {}, m = {}; scores.forEach(s => { if (seen[s.marker] && !m[s.marker]) m[s.marker] = s; seen[s.marker] = true }); return m }, [scores])

  const { longevityIndex, vitalAge, testedCount, staleCount, markerResults } = useMemo(() => {
    const a = parseInt(age) || 30
    const results = {}; let twScore = 0, twTotal = 0, count = 0
    MARKERS.forEach(m => {
      const latest = latestScores[m.key]
      if (latest) {
        const r = scoreMarker(latest.value, m.benchmarks, gender, a)
        const prev = prevScores[m.key]
        results[m.key] = { ...r, value: latest.value, tested_at: latest.tested_at, weight: WEIGHTS[m.key] || 1.0, row: latest, stale: isStale(latest.tested_at), days: daysSince(latest.tested_at), delta: prev ? Math.round((Number(latest.value) - Number(prev.value)) * 10) / 10 : null }
        const w = WEIGHTS[m.key] || 1.0
        twScore += r.score * w; twTotal += 10 * w; count++
      } else {
        results[m.key] = { score: 0, level: -1, levelLabel: 'Not tested', value: null, weight: WEIGHTS[m.key] || 1.0 }
      }
    })
    const idx = count > 0 ? Math.round((twScore / twTotal) * 100) : 0
    const staleCount = Object.values(results).filter(r => r.stale).length
    return { longevityIndex: idx, vitalAge: computeVitalAge(idx, a), testedCount: count, staleCount, markerResults: results }
  }, [latestScores, prevScores, age, gender])
  const unlocked = testedCount >= MIN_MARKERS
  const bwNum = parseFloat(bodyweight) > 0 ? Math.round(parseFloat(bodyweight)) : null
  const carryTotal = bwNum ? Math.round(bwNum * (gender === 'male' ? 1.0 : 0.75)) : null
  const carryEach = carryTotal ? Math.round(carryTotal / 2) : null
  const myRank = useMemo(() => { const i = vaBoard.findIndex(p => p.id === session?.user?.id); return i >= 0 ? i + 1 : null }, [vaBoard, session])

  // Test Day order: untested first, then stale, then fresh (original order within each group)
  function startTestDay() {
    const rank = m => { const r = markerResults[m.key]; if (!r || r.value == null) return 0; if (r.stale) return 1; return 2 }
    const order = [...MARKERS].sort((x, y) => rank(x) - rank(y)).map(m => m.key)
    setTestOrder(order); setTestStep(0); setTestMode(true)
    setInputValue(''); setInputLeft(''); setInputRight(''); setInputNotes('')
  }

  const ageDiff = vitalAge - (parseInt(age) || 30)

  // Analytics: weakest markers, recommendations
  const analytics = useMemo(() => {
    const tested = MARKERS.filter(m => markerResults[m.key]?.value != null).map(m => ({ ...m, ...markerResults[m.key] }))
    const weakest = [...tested].sort((a, b) => a.score - b.score).slice(0, 3)
    const strongest = [...tested].sort((a, b) => b.score - a.score).slice(0, 3)
    const untested = MARKERS.filter(m => markerResults[m.key]?.value == null && !m.optional)
    return { weakest, strongest, untested, testedCount: tested.length }
  }, [markerResults])

  const overallHistory = useMemo(() => {
    const dateMap = {}
    scores.forEach(s => { if (!dateMap[s.tested_at]) dateMap[s.tested_at] = {}; if (!dateMap[s.tested_at][s.marker]) dateMap[s.tested_at][s.marker] = s })
    const a = parseInt(age) || 30
    return Object.entries(dateMap).map(([date, markers]) => {
      const tested = MARKERS.filter(m => markers[m.key])
      if (!tested.length) return null
      let tw = 0, tt = 0
      tested.forEach(m => { const w = WEIGHTS[m.key] || 1; tw += scoreMarker(markers[m.key].value, m.benchmarks, gender, a).score * w; tt += 10 * w })
      return { tested_at: date, value: Math.round((tw / tt) * 100) }
    }).filter(Boolean).sort((a, b) => a.tested_at.localeCompare(b.tested_at))
  }, [scores, age, gender])

  // ============= Unsigned Teaser =============
  if (!session) {
    return (
      <div className="lon-section">
        <div className="lon-hero"><div className="lon-hero-icon">🧬</div><h2 className="lon-hero-title">Vital Age</h2><p className="lon-hero-sub">Track 10 science-backed longevity markers and discover your functional fitness age.</p></div>
        <div className="lon-teaser">
          <div className="lon-teaser-grid">
            {MARKERS.map(m => (<div key={m.key} className="lon-teaser-card"><span className="lon-teaser-icon">{m.icon}</span><span className="lon-teaser-name">{m.name}</span><span className="lon-teaser-domain">{m.domain}</span></div>))}
          </div>
          <button className="lon-test-day-btn" style={{ width: '100%', marginTop: '12px' }} onClick={onAuthRequired}>🧪 Start Test Day</button>
          <div className="lon-teaser-cta" style={{ marginTop: '8px' }}>Sign in to discover your Vital Age</div>
        </div>
      </div>
    )
  }

  // ============= Setup =============
  if (!age && profileLoaded) {
    return (
      <div className="lon-section">
        <div className="lon-hero"><div className="lon-hero-icon">🧬</div><h2 className="lon-hero-title">Vital Age</h2><p className="lon-hero-sub">Enter your age and sex to calibrate benchmarks.</p></div>
        <div className="lon-setup">
          <label className="orm-label">Age</label>
          <input type="number" className="orm-input" placeholder="e.g. 35" value={age} onChange={e => setAge(e.target.value)} style={{ maxWidth: '120px', marginBottom: '12px' }} />
          <label className="orm-label">Sex</label>
          <div className="orm-gender" style={{ marginBottom: '12px' }}>
            <button className={`orm-gender-btn${gender === 'male' ? ' on' : ''}`} onClick={() => setGender('male')}>Male</button>
            <button className={`orm-gender-btn${gender === 'female' ? ' on' : ''}`} onClick={() => setGender('female')}>Female</button>
          </div>
          <label className="orm-label">Bodyweight (lbs) <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· optional, sets your Farmer's Carry load</span></label>
          <input type="number" inputMode="numeric" className="orm-input" placeholder="e.g. 185" value={bodyweight} onChange={e => setBodyweight(e.target.value)} style={{ maxWidth: '120px', marginBottom: '16px' }} />
          {age && <button className="timer-go-btn" onClick={() => { saveAge(age, gender); if (bodyweight) saveBodyweight(bodyweight) }} style={{ maxWidth: '240px' }}>Save & Continue</button>}
        </div>
      </div>
    )
  }

  // ============= Test Day =============
  if (testMode) {
    const order = testOrder.length ? testOrder : MARKERS.map(m => m.key)
    const marker = MARKERS.find(m => m.key === order[testStep]) || MARKERS[0], a = parseInt(age) || 30, benchmarks = marker.benchmarks?.[gender]?.[getAgeBracket(a)] || []
    const cur = markerResults[marker.key]
    const clearInputs = () => { setInputValue(''); setInputLeft(''); setInputRight(''); setInputNotes('') }
    const advance = () => { if (testStep < order.length - 1) { setTestStep(testStep + 1); clearInputs() } else { setTestMode(false); setTestStep(0) } }
    const useTimer = (secs, side) => { const v = String(Math.round(secs)); if (marker.bilateral) { if (side === marker.sides[0]) setInputLeft(v); else setInputRight(v) } else setInputValue(v) }
    return (
      <div className="lon-section">
        <button className="pr-hub-back" onClick={() => { setTestMode(false); setTestStep(0) }}>← Exit Test Day</button>
        <div className="lon-test-progress"><div className="lon-test-prog-bar"><div className="lon-test-prog-fill" style={{ width: `${(testStep / order.length) * 100}%` }}></div></div><div className="lon-test-prog-label">Test {testStep + 1} of {order.length} · {testedCount}/{MARKERS.length} on record</div></div>
        <div className="lon-test-card">
          <div className="lon-test-icon">{marker.icon}</div>
          <h3 className="lon-test-name">{marker.name}</h3>
          <div className="lon-test-domain">{marker.domain}</div>
          <div className={`lon-test-status${cur?.value == null ? ' untested' : cur.stale ? ' stale' : ' fresh'}`}>
            {cur?.value == null ? '○ Not tested yet' : cur.stale ? `↻ Retest due · last ${cur.value} ${marker.unit}, ${cur.days} days ago` : `✓ Last ${cur.value} ${marker.unit}, ${cur.days === 0 ? 'today' : cur.days + ' days ago'}`}
          </div>
          <p className="lon-test-desc">{marker.desc}</p>
          <div className="lon-test-how"><div className="lon-test-how-label">How to Test</div><p>{marker.howToTest}</p></div>
          {marker.key === 'farmerscarry' && (bwNum ? (
            <div className="lon-load">🏋️ Your load: <b>2 × {carryEach} lb</b> ({carryTotal} lb total, {gender === 'male' ? '100' : '75'}% of {bwNum} lb)</div>
          ) : (
            <div className="lon-load muted">Add your bodyweight above the marker list to get your exact carry load.</div>
          ))}
          {benchmarks.length > 0 && (<div className="lon-test-benchmarks"><div className="lon-bench-header">{gender === 'male' ? 'Male' : 'Female'}, age {getAgeBracket(a)}</div>
            {LEVEL_LABELS.map((l, i) => (<div key={l} className="lon-test-bench"><span className="lon-bench-dot" style={{ background: LEVEL_COLORS[i] }}></span><span className="lon-bench-label">{l}</span><span className="lon-bench-val">{benchmarks[i]} {marker.unit}</span></div>))}
          </div>)}
          {marker.timer && <TestTimer key={marker.key} mode={marker.timer} seconds={marker.countdown} sides={marker.bilateral ? marker.sides : null} onUse={useTimer} />}
          {marker.cooper && <CooperCalc key={marker.key + '-cooper'} onUse={v => setInputValue(String(v))} />}
          {marker.bilateral ? (
            <div className="lon-test-input lon-sides-input">
              <label className="lon-side-field"><span className="lon-side-label">{marker.sides[0]}</span><input type="number" inputMode="decimal" className="orm-input" placeholder={marker.unit} value={inputLeft} onChange={e => setInputLeft(e.target.value)} /></label>
              <label className="lon-side-field"><span className="lon-side-label">{marker.sides[1]}</span><input type="number" inputMode="decimal" className="orm-input" placeholder={marker.unit} value={inputRight} onChange={e => setInputRight(e.target.value)} /></label>
            </div>
          ) : (
            <div className="lon-test-input"><input type="number" className="orm-input" placeholder={marker.inputLabel} value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} /><span className="lon-test-unit">{marker.unit}</span></div>
          )}
          {marker.bilateral && inputLeft && inputRight && (() => { const a = asymmetry(parseFloat(inputLeft), parseFloat(inputRight)); return a ? <div className="lon-side-preview">Score: <b>{Math.min(parseFloat(inputLeft), parseFloat(inputRight))} {marker.unit}</b> (weaker leg){a.flagged ? <span className="lon-asym-tag">⚠ {a.pct}% gap</span> : null}</div> : null })()}
          <input className="orm-input" placeholder="Notes (optional)" value={inputNotes} onChange={e => setInputNotes(e.target.value)} style={{ marginTop: '6px' }} />
          <div className="lon-test-actions">
            <button className="doc-ctrl" onClick={advance}>{testStep < order.length - 1 ? 'Skip →' : 'Skip & Finish'}</button>
            <button className="timer-go-btn" disabled={saving || (marker.bilateral ? !(inputLeft && inputRight) : !inputValue)} onClick={async () => { await saveScore(marker.key); advance() }}>{testStep < order.length - 1 ? 'Save & Next →' : '🏁 Finish'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ============= Analytics Overlay =============
  if (showAnalytics) {
    return (
      <div className="lon-section">
        <button className="pr-hub-back" onClick={() => setShowAnalytics(false)}>← Back to Dashboard</button>
        <div className="lon-analytics">
          <div className="lon-analytics-hero">
            <div className="lon-vital-ring lon-ring-lg" style={{ borderColor: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
              <div className="lon-vital-age">{vitalAge}</div>
              <div className="lon-vital-label">Vital Age</div>
            </div>
            <div className="lon-analytics-idx">Longevity Index: <b>{longevityIndex}/100</b></div>
            <div className="lon-vital-diff" style={{ color: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e', fontSize: '16px', fontWeight: 800 }}>
              {ageDiff < 0 ? `${Math.abs(ageDiff)} years younger` : ageDiff === 0 ? 'On track' : `${ageDiff} years older`} than age {age}
            </div>
          </div>

          {overallHistory.length >= 2 && (
            <div className="lon-overall-chart"><div className="lon-chart-label">📈 Longevity Index Over Time</div><SparkChart data={overallHistory} unit="/100" color="#4ade80" /></div>
          )}

          {/* Weakest areas */}
          {analytics.weakest.length > 0 && (
            <div className="lon-analytics-card">
              <div className="lon-analytics-title">🔴 Focus Areas — Where to Improve</div>
              {analytics.weakest.map(m => {
                const fix = MARKER_WORKOUT_FILTERS[m.key]
                return (
                  <div key={m.key} className="lon-analytics-row">
                    <span className="lon-analytics-icon">{m.icon}</span>
                    <div className="lon-analytics-info">
                      <div className="lon-analytics-name">{m.name}</div>
                      <div className="lon-analytics-meta">{m.value} {m.unit} • <span style={{ color: m.level >= 0 ? LEVEL_COLORS[m.level] : '#e01e1e' }}>{m.levelLabel}</span> • {m.score}/10 (×{WEIGHTS[m.key]} weight)</div>
                      {m.target && <div className="lon-analytics-target">→ Target for next level: {m.target} {m.unit}</div>}
                      {fix && onOpenWorkouts && <button className="lon-fix-btn" onClick={() => onOpenWorkouts(fix.filters, `${m.icon} ${m.name} · ${fix.label}`)}>🏋️ Train it: {fix.label} →</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Strongest areas */}
          {analytics.strongest.length > 0 && (
            <div className="lon-analytics-card">
              <div className="lon-analytics-title">🟢 Strengths — Keep It Up</div>
              {analytics.strongest.map(m => (
                <div key={m.key} className="lon-analytics-row">
                  <span className="lon-analytics-icon">{m.icon}</span>
                  <div className="lon-analytics-info">
                    <div className="lon-analytics-name">{m.name}</div>
                    <div className="lon-analytics-meta">{m.value} {m.unit} • <span style={{ color: LEVEL_COLORS[m.level] }}>{m.levelLabel}</span> • {m.score}/10</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Untested */}
          {analytics.untested.length > 0 && (
            <div className="lon-analytics-card">
              <div className="lon-analytics-title">⚪ Not Yet Tested</div>
              {analytics.untested.map(m => (
                <div key={m.key} className="lon-analytics-row"><span className="lon-analytics-icon">{m.icon}</span><div className="lon-analytics-name">{m.name} — {m.domain}</div></div>
              ))}
              <button className="lon-test-day-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => { setShowAnalytics(false); startTestDay() }}>🧪 Test These Now</button>
            </div>
          )}

          {/* Weighting explanation */}
          <div className="lon-analytics-card">
            <div className="lon-analytics-title">⚖️ How Scoring Works</div>
            <p className="lon-analytics-explain">Markers are weighted by strength of mortality evidence. VO2 Max (×1.5) carries the most weight based on 20.9M observations. Grip Strength (×1.4) and Dead Hang (×1.3) are next. Your Longevity Index is the weighted average of all tested markers.</p>
            <div className="lon-weight-grid">
              {MARKERS.map(m => (
                <div key={m.key} className="lon-weight-item">
                  <span>{m.icon} {m.name}</span>
                  <span className="lon-weight-val">×{WEIGHTS[m.key]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============= Main Dashboard =============
  return (
    <div className="lon-section">
      {/* Vital Age Hero */}
      <div className="lon-vital">
        <div className={`lon-vital-ring${unlocked && staleCount > 0 ? ' stale' : ''}`} onClick={() => unlocked && setShowAnalytics(true)} style={{ cursor: unlocked ? 'pointer' : 'default', borderColor: !unlocked ? 'var(--brd)' : ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
          <div className="lon-vital-age">{unlocked ? vitalAge : '?'}</div>
          {unlocked ? <div className="lon-ring-tap">Tap for analysis</div> : <div className="lon-ring-tap">{testedCount}/{MIN_MARKERS} to unlock</div>}
        </div>
        <div className="lon-vital-info">
          <div className="lon-vital-heading">🧬 Vital Age</div>
          {unlocked ? (
            <div className="lon-vital-diff" style={{ color: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
              {ageDiff < 0 ? `${Math.abs(ageDiff)} years younger` : ageDiff === 0 ? 'On track' : `${ageDiff} years older`} than age {age}
            </div>
          ) : (
            <div className="lon-vital-sub">Test {MIN_MARKERS - testedCount} more marker{MIN_MARKERS - testedCount === 1 ? '' : 's'} to unlock your Vital Age</div>
          )}
          <div className="lon-vital-tested">{testedCount}/{MARKERS.length} markers tested{staleCount > 0 && <span className="lon-stale-note"> · ↻ {staleCount} need{staleCount === 1 ? 's' : ''} retest</span>}</div>
          {unlocked && session && (
            <button className="doc-ctrl" style={{ margin: '6px 0' }} onClick={() => setShowStory(true)}>📸 Share My Vital Age</button>
          )}
          {showStory && (
            <StoryCard
              session={session}
              vital={{
                vitalAge,
                actualAge: parseInt(age) || 30,
                ageDiff,
                longevityIndex,
                markers: analytics.strongest.map(m => ({ name: m.name, value: m.value, unit: m.unit, levelLabel: m.levelLabel })),
              }}
              onClose={() => setShowStory(false)}
            />
          )}
          <div className="lon-vital-row">
            <button className="lon-test-day-btn" onClick={startTestDay}>🧪 Test Day</button>
            <div className="lon-age-inputs">
              <input type="number" className="lon-age-input" placeholder="Age" value={age} onChange={e => { setAge(e.target.value); saveAge(e.target.value, gender) }} />
              <select className="lon-gender-select" value={gender} onChange={e => { setGender(e.target.value); saveAge(age, e.target.value) }}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input type="number" inputMode="numeric" className="lon-age-input lon-bw-input" placeholder="lbs" title="Bodyweight (lbs) — sets your Farmer's Carry load" value={bodyweight} onChange={e => setBodyweight(e.target.value)} onBlur={e => saveBodyweight(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Vital Age Leaderboard */}
      {vaBoard.length > 0 && (
        <div className="lon-board">
          <div className="lon-board-hd">
            <span>🏆 Vital Age Leaderboard</span>
            <span className="lon-board-sub">ranked by years younger{myRank ? ` · you're #${myRank}` : unlocked ? '' : ` · unlock yours with ${MIN_MARKERS} markers`}</span>
          </div>
          {vaBoard.slice(0, 10).map((p, i) => {
            const mine = p.id === session?.user?.id
            const d = p.diff
            return (
              <div key={p.id} className={`lon-board-row${mine ? ' me' : ''}`}>
                <span className="lon-board-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                {p.avatar_url ? <img className="lon-board-avatar" src={p.avatar_url} alt="" /> : <span className="lon-board-avatar ph">🦍</span>}
                <span className="lon-board-name">{p.display_name || 'Athlete'}</span>
                <span className="lon-board-va">{Math.round(Number(p.vital_age))} <small>vs {p.age}</small></span>
                <span className="lon-board-diff" style={{ color: d >= 5 ? '#22d3ee' : d >= 0 ? '#4ade80' : d >= -5 ? '#e0c81e' : '#e01e1e' }}>{d > 0 ? `${d} yrs younger` : d === 0 ? 'on track' : `${Math.abs(d)} yrs older`}</span>
              </div>
            )
          })}
          {myRank && myRank > 10 && (() => { const p = vaBoard[myRank - 1]; return (
            <div className="lon-board-row me"><span className="lon-board-rank">#{myRank}</span><span className="lon-board-avatar ph">🦍</span><span className="lon-board-name">You</span><span className="lon-board-va">{Math.round(Number(p.vital_age))} <small>vs {p.age}</small></span><span className="lon-board-diff">{p.diff > 0 ? `${p.diff} yrs younger` : p.diff === 0 ? 'on track' : `${Math.abs(p.diff)} yrs older`}</span></div>
          ) })()}
        </div>
      )}

      {/* Marker Cards */}
      <div className="lon-markers">
        {MARKERS.map(m => {
          const result = markerResults[m.key], isExp = expandedMarker === m.key, a = parseInt(age) || 30
          const benchmarks = m.benchmarks?.[gender]?.[getAgeBracket(a)] || [], hasScore = result?.value != null
          const history = isExp ? scores.filter(s => s.marker === m.key).slice(0, 30).reverse() : []

          return (
            <div key={m.key} className={`lon-marker${isExp ? ' expanded' : ''}${m.optional ? ' optional' : ''}`}>
              <div className="lon-marker-hd" onClick={() => { setExpandedMarker(isExp ? null : m.key); setShowHistory(null); setInputValue(''); setInputLeft(''); setInputRight(''); setEditingScoreId(null) }}>
                <span className="lon-marker-icon">{m.icon}</span>
                <div className="lon-marker-info">
                  <div className="lon-marker-name">{m.name}{m.optional ? ' ⓘ' : ''}</div>
                  <div className="lon-marker-domain">{m.domain} <span className="lon-marker-weight">×{WEIGHTS[m.key]}</span></div>
                </div>
                {hasScore ? (
                  <div className="lon-marker-score-wrap">
                    <div className="lon-marker-value">
                      {result.delta != null && <span className={`lon-delta${result.delta > 0 ? ' up' : result.delta < 0 ? ' down' : ''}`}>{result.delta > 0 ? `▲ +${result.delta}` : result.delta < 0 ? `▼ ${result.delta}` : '— 0'}</span>}
                      {result.value} <span className="lon-marker-unit">{m.unit}</span>
                    </div>
                    <div className="lon-marker-level" style={{ color: result.level >= 0 ? LEVEL_COLORS[result.level] : '#e01e1e' }}>{result.levelLabel} • {result.score}/10</div>
                    {result.stale && <div className="lon-stale-tag">↻ Retest due · {result.days}d</div>}
                    {m.bilateral && <SidesTag row={result.row} unit={m.unit} />}
                  </div>
                ) : (<div className="lon-marker-empty">Not tested</div>)}
                <span className={`lon-marker-arrow${isExp ? ' open' : ''}`}>▾</span>
              </div>
              {hasScore && <div className="lon-marker-bar"><div className="lon-marker-fill" style={{ width: `${(result.score / 10) * 100}%`, background: result.level >= 0 ? LEVEL_COLORS[result.level] : '#e01e1e' }}></div></div>}
              {isExp && (
                <div className="lon-marker-body">
                  <p className="lon-marker-desc">{m.desc}</p>
                  <div className="lon-test-how"><div className="lon-test-how-label">How to Test</div><p>{m.howToTest}</p></div>
                  <div className="lon-marker-source">📚 {m.source}</div>
                  {benchmarks.length > 0 && (
                    <div className="lon-test-benchmarks">
                      <div className="lon-bench-header">{gender === 'male' ? 'Male' : 'Female'}, age {getAgeBracket(a)}</div>
                      {LEVEL_LABELS.map((l, i) => (<div key={l} className={`lon-test-bench${hasScore && result.level === i ? ' current' : ''}`}><span className="lon-bench-dot" style={{ background: LEVEL_COLORS[i] }}></span><span className="lon-bench-label">{l}</span><span className="lon-bench-val">{benchmarks[i]} {m.unit}</span></div>))}
                    </div>
                  )}
                  {history.length >= 2 && <div className="lon-overall-chart" style={{ marginBottom: '8px' }}><div className="lon-chart-label">📈 Progress</div><SparkChart data={history} unit={m.unit} color={result.level >= 0 ? LEVEL_COLORS[result.level] : 'var(--acc)'} /></div>}
                  {m.bilateral ? (
                    <div className="lon-quick-log lon-sides-input">
                      <label className="lon-side-field"><span className="lon-side-label">{m.sides[0]}</span><input type="number" inputMode="decimal" className="orm-input" placeholder={m.unit} value={inputLeft} onChange={e => setInputLeft(e.target.value)} /></label>
                      <label className="lon-side-field"><span className="lon-side-label">{m.sides[1]}</span><input type="number" inputMode="decimal" className="orm-input" placeholder={m.unit} value={inputRight} onChange={e => setInputRight(e.target.value)} /></label>
                      <button className="ab p" disabled={saving || !(inputLeft && inputRight)} onClick={() => saveScore(m.key)}>{saving ? '...' : '💾 Log'}</button>
                    </div>
                  ) : (
                    <div className="lon-quick-log"><input type="number" className="orm-input" placeholder={m.inputLabel} value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} /><button className="ab p" disabled={saving || !inputValue} onClick={() => saveScore(m.key)}>{saving ? '...' : '💾 Log'}</button></div>
                  )}
                  <button className="lon-history-btn" onClick={() => setShowHistory(showHistory === m.key ? null : m.key)}>{showHistory === m.key ? 'Hide History' : `📊 History (${scores.filter(s => s.marker === m.key).length})`}</button>
                  {showHistory === m.key && (
                    <div className="lon-history">
                      {scores.filter(s => s.marker === m.key).slice(0, 20).map(h => (
                        <div key={h.id} className="lon-history-row">
                          <span className="lon-history-date">{h.tested_at}</span>
                          {editingScoreId === h.id ? (
                            <div className="lon-edit-row">
                              {m.bilateral && h.value_left != null && h.value_right != null ? (
                                <>
                                  <span className="lon-side-label">L</span><input type="number" className="lon-edit-input" value={editLeft} onChange={e => setEditLeft(e.target.value)} />
                                  <span className="lon-side-label">R</span><input type="number" className="lon-edit-input" value={editRight} onChange={e => setEditRight(e.target.value)} />
                                  <button className="lon-edit-btn save" onClick={() => editScore(h.id, true, m.allowZero)}>✓</button>
                                </>
                              ) : (
                                <>
                                  <input type="number" className="lon-edit-input" value={editVal} onChange={e => setEditVal(e.target.value)} />
                                  <button className="lon-edit-btn save" onClick={() => editScore(h.id, false, m.allowZero)}>✓</button>
                                </>
                              )}
                              <button className="lon-edit-btn" onClick={() => setEditingScoreId(null)}>✕</button>
                            </div>
                          ) : (
                            <>
                              <span className="lon-history-val">{h.value} {h.unit}</span>
                              {m.bilateral && <SidesTag row={h} unit={h.unit} />}
                              {h.notes && <span className="lon-history-notes">{h.notes}</span>}
                              <div className="lon-hist-actions">
                                <button className="lon-hist-btn" onClick={() => { setEditingScoreId(h.id); setEditVal(String(h.value)); setEditLeft(h.value_left != null ? String(h.value_left) : ''); setEditRight(h.value_right != null ? String(h.value_right) : '') }}>✏️</button>
                                <button className="lon-hist-btn del" onClick={() => deleteScore(h.id)}>🗑</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {scores.filter(s => s.marker === m.key).length === 0 && <div className="lon-history-empty">No history yet</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
