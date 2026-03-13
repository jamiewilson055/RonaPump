import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Research-based weights — higher = stronger mortality evidence
const WEIGHTS = { vo2max: 1.5, grip: 1.4, deadhang: 1.3, sitrise: 1.2, balance: 1.2, pushup: 1.1, farmerscarry: 1.0, squat60: 1.0, bike60: 0.9, broadjump: 0.9 }

const MARKERS = [
  {
    key: 'vo2max', name: 'VO2 Max', icon: '❤️', domain: 'Cardio Capacity',
    unit: 'ml/kg/min', inputLabel: 'VO2 Max (ml/kg/min)',
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
    unit: 'cals', inputLabel: 'Calories in 60 seconds',
    desc: 'All-out Assault or Echo Bike for 60 seconds. Measures peak anaerobic output and cardiovascular recovery capacity.',
    howToTest: 'Warm up 3-5 min. Go absolute max effort for exactly 60 seconds. Record total calories.',
    source: 'Anaerobic capacity correlates with VO2 max. RonaPump benchmarks from competitive functional fitness data.',
    benchmarks: {
      male:   { '20-29': [18, 23, 29, 36, 44], '30-39': [16, 21, 27, 33, 40], '40-49': [14, 19, 25, 31, 37], '50-59': [12, 16, 22, 28, 34], '60+': [10, 14, 19, 25, 30] },
      female: { '20-29': [12, 16, 21, 27, 33], '30-39': [10, 14, 19, 25, 31], '40-49': [9, 12, 17, 23, 28], '50-59': [7, 10, 15, 20, 25], '60+': [6, 9, 13, 17, 22] },
    },
  },
  {
    key: 'deadhang', name: 'Dead Hang', icon: '🤲', domain: 'Grip & Shoulders',
    unit: 'seconds', inputLabel: 'Time (seconds)',
    desc: 'Grip strength is one of the strongest predictors of all-cause mortality. Attia: men 2 min, women 90s at age 40. Reduced ~10-15% per decade.',
    howToTest: 'Overhand grip on pull-up bar, shoulder-width. Arms fully extended, feet off ground. Time until failure.',
    source: 'Bohannon 2019 (Clinical Interventions in Aging); Attia/Outlive',
    benchmarks: {
      male:   { '20-29': [30, 55, 85, 120, 150], '30-39': [25, 48, 75, 110, 140], '40-49': [20, 40, 65, 100, 130], '50-59': [15, 32, 52, 80, 110], '60+': [10, 22, 40, 65, 90] },
      female: { '20-29': [15, 32, 55, 90, 120], '30-39': [12, 27, 45, 78, 105], '40-49': [10, 22, 38, 68, 90], '50-59': [8, 16, 30, 55, 75], '60+': [5, 12, 22, 42, 60] },
    },
  },
  {
    key: 'farmerscarry', name: "Farmer's Carry", icon: '🏋️', domain: 'Functional Strength',
    unit: 'seconds', inputLabel: 'Time walking (seconds)',
    desc: 'Men carry 100% of bodyweight (split across two DBs/KBs). Women carry 75% of bodyweight. Walk until grip fails.',
    howToTest: 'Men: 50% BW in each hand (total = 100% BW). Women: ~37.5% each hand (total = 75% BW). Walk steadily. Record time until you set the weight down.',
    source: 'Attia/Huberman — men 100% BW / women 75% BW for 2 min. Exceptional: 2x BW trap bar 30s.',
    benchmarks: {
      male:   { '20-29': [15, 30, 55, 90, 130], '30-39': [12, 26, 48, 80, 120], '40-49': [10, 22, 42, 70, 110], '50-59': [8, 18, 35, 60, 95], '60+': [5, 14, 28, 50, 80] },
      female: { '20-29': [12, 26, 48, 80, 120], '30-39': [10, 22, 42, 70, 110], '40-49': [8, 18, 36, 60, 95], '50-59': [6, 14, 30, 50, 80], '60+': [4, 10, 24, 42, 65] },
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
    unit: 'reps', inputLabel: 'Max reps in 60 seconds',
    desc: 'Dynamic version of the CDC chair stand test — a validated mortality predictor. Tests quad strength, glute endurance, cardiovascular recovery.',
    howToTest: '60-second timer. Bodyweight squats — hip crease below knee, full stand. Count total reps.',
    source: 'Jones et al. 1999 (chair stand); CDC Functional Fitness Battery',
    benchmarks: {
      male:   { '20-29': [25, 33, 42, 52, 64], '30-39': [22, 29, 38, 48, 60], '40-49': [18, 25, 34, 44, 55], '50-59': [15, 21, 29, 39, 50], '60+': [12, 17, 24, 34, 44] },
      female: { '20-29': [20, 27, 36, 46, 58], '30-39': [18, 24, 32, 42, 53], '40-49': [15, 20, 28, 38, 48], '50-59': [12, 17, 24, 33, 43], '60+': [10, 14, 20, 28, 38] },
    },
  },
  {
    key: 'balance', name: 'Single-Leg Balance', icon: '🦩', domain: 'Balance & Neuromuscular',
    unit: 'seconds', inputLabel: 'Time (seconds, eyes closed)',
    desc: 'Inability to balance 10s on one leg nearly doubles all-cause mortality risk. Eyes closed removes visual input for a deeper neuromuscular test.',
    howToTest: 'Stand on one leg, hands on hips, close eyes. Time until other foot touches or eyes open. Best of 3.',
    source: 'Araújo et al. 2022 (Br J Sports Med) — 1,702 subjects',
    benchmarks: {
      male:   { '20-29': [10, 18, 30, 45, 65], '30-39': [7, 14, 24, 38, 55], '40-49': [5, 10, 18, 30, 45], '50-59': [3, 7, 13, 22, 35], '60+': [2, 5, 9, 16, 25] },
      female: { '20-29': [10, 18, 30, 45, 65], '30-39': [7, 14, 24, 38, 55], '40-49': [5, 10, 18, 30, 45], '50-59': [3, 7, 13, 22, 35], '60+': [2, 5, 9, 16, 25] },
    },
  },
  {
    key: 'sitrise', name: 'Sit-Rise Test', icon: '🧘', domain: 'Composite (5-in-1)',
    unit: 'score', inputLabel: 'Score (0-10)',
    desc: 'The only test evaluating strength, power, flexibility, balance, AND body composition simultaneously. Each 1-point increase = 21% survival improvement.',
    howToTest: 'Stand barefoot. Sit cross-legged, then stand up. 5 pts per movement. Subtract 1 per hand/knee/forearm/leg used. Subtract 0.5 for wobbling.',
    source: 'Araújo et al. 2012 — 2,002 subjects, 6.3-year follow-up',
    benchmarks: {
      male:   { '20-29': [6, 7, 8, 9, 10], '30-39': [5, 6.5, 7.5, 8.5, 10], '40-49': [4, 5.5, 7, 8, 9.5], '50-59': [3, 4.5, 6, 7.5, 9], '60+': [2, 3.5, 5, 7, 8.5] },
      female: { '20-29': [6, 7, 8, 9, 10], '30-39': [5, 6.5, 7.5, 8.5, 10], '40-49': [4, 5.5, 7, 8, 9.5], '50-59': [3, 4.5, 6, 7.5, 9], '60+': [2, 3.5, 5, 7, 8.5] },
    },
  },
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

function computeVitalAge(idx, ca) { if (idx >= 90) return ca - Math.round((idx - 90) * 1.5); if (idx >= 70) return ca - Math.round((idx - 70) * 0.5); if (idx >= 50) return ca; if (idx >= 30) return ca + Math.round((50 - idx) * 0.4); return ca + Math.round((50 - idx) * 0.75) }

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

export default function Longevity({ session, onAuthRequired }) {
  const [scores, setScores] = useState([])
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('male')
  const [expandedMarker, setExpandedMarker] = useState(null)
  const [testMode, setTestMode] = useState(false)
  const [testStep, setTestStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [inputNotes, setInputNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [editingScoreId, setEditingScoreId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)

  useEffect(() => { if (session) { loadScores(); loadProfile() } }, [session])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('age, gender').eq('id', session.user.id).single()
    if (data) { if (data.age) setAge(String(data.age)); if (data.gender) setGender(data.gender) }
    setProfileLoaded(true)
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
    const val = parseFloat(inputValue)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    const marker = MARKERS.find(m => m.key === markerKey)
    await supabase.from('longevity_scores').insert({ user_id: session.user.id, marker: markerKey, value: val, unit: marker?.unit || '', notes: inputNotes.trim() || null, tested_at: new Date().toISOString().slice(0, 10) })
    setInputValue(''); setInputNotes(''); setSaving(false)
    await loadScores()
    // Always update vital age
    saveAge(age, gender)
    updateVitalAge()
  }

  async function editScore(id) {
    const val = parseFloat(editVal)
    if (isNaN(val) || val <= 0) return
    await supabase.from('longevity_scores').update({ value: val }).eq('id', id)
    setEditingScoreId(null); setEditVal(''); loadScores(); updateVitalAge()
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
      const va = computeVitalAge(idx, parseInt(age))
      await supabase.from('profiles').update({ longevity_index: idx, vital_age: va }).eq('id', session.user.id)
    }, 300)
  }

  const latestScores = useMemo(() => { const m = {}; scores.forEach(s => { if (!m[s.marker]) m[s.marker] = s }); return m }, [scores])

  const { longevityIndex, vitalAge, testedCount, markerResults } = useMemo(() => {
    const a = parseInt(age) || 30
    const results = {}; let twScore = 0, twTotal = 0, count = 0
    MARKERS.forEach(m => {
      const latest = latestScores[m.key]
      if (latest) {
        const r = scoreMarker(latest.value, m.benchmarks, gender, a)
        results[m.key] = { ...r, value: latest.value, tested_at: latest.tested_at, weight: WEIGHTS[m.key] || 1.0 }
        const w = WEIGHTS[m.key] || 1.0
        twScore += r.score * w; twTotal += 10 * w; count++
      } else {
        results[m.key] = { score: 0, level: -1, levelLabel: 'Not tested', value: null, weight: WEIGHTS[m.key] || 1.0 }
      }
    })
    const idx = count > 0 ? Math.round((twScore / twTotal) * 100) : 0
    return { longevityIndex: idx, vitalAge: computeVitalAge(idx, a), testedCount: count, markerResults: results }
  }, [latestScores, age, gender])

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
          <div className="orm-gender" style={{ marginBottom: '16px' }}>
            <button className={`orm-gender-btn${gender === 'male' ? ' on' : ''}`} onClick={() => setGender('male')}>Male</button>
            <button className={`orm-gender-btn${gender === 'female' ? ' on' : ''}`} onClick={() => setGender('female')}>Female</button>
          </div>
          {age && <button className="timer-go-btn" onClick={() => saveAge(age, gender)} style={{ maxWidth: '240px' }}>Save & Continue</button>}
        </div>
      </div>
    )
  }

  // ============= Test Day =============
  if (testMode) {
    const marker = MARKERS[testStep], a = parseInt(age) || 30, benchmarks = marker.benchmarks?.[gender]?.[getAgeBracket(a)] || []
    return (
      <div className="lon-section">
        <button className="pr-hub-back" onClick={() => { setTestMode(false); setTestStep(0) }}>← Exit Test Day</button>
        <div className="lon-test-progress"><div className="lon-test-prog-bar"><div className="lon-test-prog-fill" style={{ width: `${(testStep / MARKERS.length) * 100}%` }}></div></div><div className="lon-test-prog-label">Test {testStep + 1} of {MARKERS.length}</div></div>
        <div className="lon-test-card">
          <div className="lon-test-icon">{marker.icon}</div>
          <h3 className="lon-test-name">{marker.name}</h3>
          <div className="lon-test-domain">{marker.domain}</div>
          <p className="lon-test-desc">{marker.desc}</p>
          <div className="lon-test-how"><div className="lon-test-how-label">How to Test</div><p>{marker.howToTest}</p></div>
          {benchmarks.length > 0 && (<div className="lon-test-benchmarks"><div className="lon-bench-header">{gender === 'male' ? 'Male' : 'Female'}, age {getAgeBracket(a)}</div>
            {LEVEL_LABELS.map((l, i) => (<div key={l} className="lon-test-bench"><span className="lon-bench-dot" style={{ background: LEVEL_COLORS[i] }}></span><span className="lon-bench-label">{l}</span><span className="lon-bench-val">{benchmarks[i]} {marker.unit}</span></div>))}
          </div>)}
          <div className="lon-test-input"><input type="number" className="orm-input" placeholder={marker.inputLabel} value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} /><span className="lon-test-unit">{marker.unit}</span></div>
          <input className="orm-input" placeholder="Notes (optional)" value={inputNotes} onChange={e => setInputNotes(e.target.value)} style={{ marginTop: '6px' }} />
          <div className="lon-test-actions">
            {marker.optional && <button className="doc-ctrl" onClick={() => { if (testStep < MARKERS.length - 1) { setTestStep(testStep + 1); setInputValue(''); setInputNotes('') } else { setTestMode(false); setTestStep(0) } }}>Skip</button>}
            <button className="timer-go-btn" disabled={saving || !inputValue} onClick={async () => { await saveScore(marker.key); if (testStep < MARKERS.length - 1) { setTestStep(testStep + 1); setInputValue(''); setInputNotes('') } else { setTestMode(false); setTestStep(0) } }}>{testStep < MARKERS.length - 1 ? 'Save & Next →' : '🏁 Finish'}</button>
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
              {analytics.weakest.map(m => (
                <div key={m.key} className="lon-analytics-row">
                  <span className="lon-analytics-icon">{m.icon}</span>
                  <div className="lon-analytics-info">
                    <div className="lon-analytics-name">{m.name}</div>
                    <div className="lon-analytics-meta">{m.value} {m.unit} • <span style={{ color: m.level >= 0 ? LEVEL_COLORS[m.level] : '#e01e1e' }}>{m.levelLabel}</span> • {m.score}/10 (×{WEIGHTS[m.key]} weight)</div>
                    {m.target && <div className="lon-analytics-target">→ Target for next level: {m.target} {m.unit}</div>}
                  </div>
                </div>
              ))}
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
              <button className="lon-test-day-btn" style={{ width: '100%', marginTop: '10px' }} onClick={() => { setShowAnalytics(false); setTestMode(true); setTestStep(0) }}>🧪 Test These Now</button>
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
      {/* Vital Age Hero — clickable for analytics */}
      <div className="lon-vital">
        <div className="lon-vital-ring" onClick={() => testedCount > 0 && setShowAnalytics(true)} style={{ cursor: testedCount > 0 ? 'pointer' : 'default', borderColor: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
          <div className="lon-vital-age">{testedCount > 0 ? vitalAge : '?'}</div>
          <div className="lon-vital-label">{testedCount > 0 ? 'Tap for analysis' : 'Vital Age'}</div>
        </div>
        <div className="lon-vital-info">
          <div className="lon-vital-title">🧬 Vital Age {testedCount > 0 && <span className="lon-idx-badge">{longevityIndex}/100</span>}</div>
          {testedCount > 0 ? (
            <>
              <div className="lon-vital-diff" style={{ color: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
                {ageDiff < 0 ? `${Math.abs(ageDiff)} years younger` : ageDiff === 0 ? 'On track' : `${ageDiff} years older`} than age {age}
              </div>
              <div className="lon-vital-sub">{testedCount}/{MARKERS.length} tested</div>
            </>
          ) : (
            <div className="lon-vital-sub">Complete your first test to see your Vital Age</div>
          )}
          <div className="lon-vital-row">
            <button className="lon-test-day-btn" onClick={() => { setTestMode(true); setTestStep(0); setInputValue(''); setInputNotes('') }}>🧪 Test Day</button>
            <div className="lon-age-inputs" >
              <input type="number" className="lon-age-input" placeholder="Age" value={age} onChange={e => { setAge(e.target.value); saveAge(e.target.value, gender) }} />
              <select className="lon-gender-select" value={gender} onChange={e => { setGender(e.target.value); saveAge(age, e.target.value) }}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Marker Cards */}
      <div className="lon-markers">
        {MARKERS.map(m => {
          const result = markerResults[m.key], isExp = expandedMarker === m.key, a = parseInt(age) || 30
          const benchmarks = m.benchmarks?.[gender]?.[getAgeBracket(a)] || [], hasScore = result?.value != null
          const history = isExp ? scores.filter(s => s.marker === m.key).slice(0, 30).reverse() : []

          return (
            <div key={m.key} className={`lon-marker${isExp ? ' expanded' : ''}${m.optional ? ' optional' : ''}`}>
              <div className="lon-marker-hd" onClick={() => { setExpandedMarker(isExp ? null : m.key); setShowHistory(null); setInputValue(''); setEditingScoreId(null) }}>
                <span className="lon-marker-icon">{m.icon}</span>
                <div className="lon-marker-info">
                  <div className="lon-marker-name">{m.name}{m.optional ? ' ⓘ' : ''}</div>
                  <div className="lon-marker-domain">{m.domain} <span className="lon-marker-weight">×{WEIGHTS[m.key]}</span></div>
                </div>
                {hasScore ? (
                  <div className="lon-marker-score-wrap">
                    <div className="lon-marker-value">{result.value} <span className="lon-marker-unit">{m.unit}</span></div>
                    <div className="lon-marker-level" style={{ color: result.level >= 0 ? LEVEL_COLORS[result.level] : '#e01e1e' }}>{result.levelLabel} • {result.score}/10</div>
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
                  <div className="lon-quick-log"><input type="number" className="orm-input" placeholder={m.inputLabel} value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} /><button className="ab p" disabled={saving || !inputValue} onClick={() => saveScore(m.key)}>{saving ? '...' : '💾 Log'}</button></div>
                  <button className="lon-history-btn" onClick={() => setShowHistory(showHistory === m.key ? null : m.key)}>{showHistory === m.key ? 'Hide History' : `📊 History (${scores.filter(s => s.marker === m.key).length})`}</button>
                  {showHistory === m.key && (
                    <div className="lon-history">
                      {scores.filter(s => s.marker === m.key).slice(0, 20).map(h => (
                        <div key={h.id} className="lon-history-row">
                          <span className="lon-history-date">{h.tested_at}</span>
                          {editingScoreId === h.id ? (
                            <div className="lon-edit-row">
                              <input type="number" className="lon-edit-input" value={editVal} onChange={e => setEditVal(e.target.value)} />
                              <button className="lon-edit-btn save" onClick={() => editScore(h.id)}>✓</button>
                              <button className="lon-edit-btn" onClick={() => setEditingScoreId(null)}>✕</button>
                            </div>
                          ) : (
                            <>
                              <span className="lon-history-val">{h.value} {h.unit}</span>
                              {h.notes && <span className="lon-history-notes">{h.notes}</span>}
                              <div className="lon-hist-actions">
                                <button className="lon-hist-btn" onClick={() => { setEditingScoreId(h.id); setEditVal(String(h.value)) }}>✏️</button>
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
