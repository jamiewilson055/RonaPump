import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ============= Marker Definitions =============
const MARKERS = [
  {
    key: 'vo2max', name: 'VO2 Max', icon: '❤️', domain: 'Cardio Capacity',
    unit: 'ml/kg/min', inputLabel: 'VO2 Max (ml/kg/min)',
    desc: 'The strongest predictor of lifespan. Each 1-MET increase = 11-17% mortality reduction.',
    howToTest: 'Run as far as you can in 12 minutes (Cooper Test). Distance in meters → VO2 Max = (distance - 504.9) / 44.73. Or enter from your wearable.',
    source: 'Lang et al. 2024 — 20.9M observations, 199 cohorts',
    // Benchmarks: [poor, below avg, average, good, excellent] by age bracket
    benchmarks: {
      male:   { '20-29': [33, 36, 42, 48, 55], '30-39': [31, 34, 40, 45, 52], '40-49': [29, 32, 37, 42, 49], '50-59': [26, 29, 34, 39, 45], '60+': [22, 26, 31, 36, 42] },
      female: { '20-29': [27, 30, 35, 40, 48], '30-39': [25, 28, 33, 38, 45], '40-49': [23, 26, 31, 35, 42], '50-59': [21, 24, 28, 33, 39], '60+': [18, 22, 26, 30, 36] },
    },
  },
  {
    key: 'bike60', name: '60s Max Cal Bike', icon: '🚴', domain: 'Anaerobic Power',
    unit: 'cals', inputLabel: 'Calories in 60 seconds',
    desc: 'All-out effort on an Assault or Echo Bike. Tests peak anaerobic output and cardiovascular recovery.',
    howToTest: 'Warm up 3-5 min. Go max effort for exactly 60 seconds. Record total calories.',
    source: 'Anaerobic capacity correlates with VO2 max and cardiovascular resilience',
    benchmarks: {
      male:   { '20-29': [18, 22, 28, 35, 42], '30-39': [16, 20, 26, 32, 39], '40-49': [14, 18, 24, 30, 36], '50-59': [12, 16, 21, 27, 33], '60+': [10, 14, 18, 24, 30] },
      female: { '20-29': [12, 15, 20, 26, 32], '30-39': [10, 13, 18, 24, 30], '40-49': [9, 12, 16, 22, 27], '50-59': [8, 11, 14, 19, 24], '60+': [6, 9, 12, 16, 21] },
    },
  },
  {
    key: 'deadhang', name: 'Dead Hang', icon: '🤲', domain: 'Grip & Shoulders',
    unit: 'seconds', inputLabel: 'Time (seconds)',
    desc: 'Grip strength is the #2 predictor of all-cause mortality after VO2 Max. Tests grip endurance, shoulder health, and spinal decompression.',
    howToTest: 'Grab a pull-up bar with overhand grip, shoulder-width. Hang with arms fully extended. Time until you drop.',
    source: 'Bohannon 2019; Attia/Outlive — 2min M / 90s F at age 40',
    benchmarks: {
      male:   { '20-29': [30, 50, 80, 120, 150], '30-39': [25, 45, 70, 110, 140], '40-49': [20, 40, 60, 100, 130], '50-59': [15, 30, 50, 80, 110], '60+': [10, 20, 40, 65, 90] },
      female: { '20-29': [15, 30, 50, 80, 110], '30-39': [12, 25, 40, 70, 100], '40-49': [10, 20, 35, 60, 90], '50-59': [8, 15, 28, 50, 75], '60+': [5, 10, 20, 40, 60] },
    },
  },
  {
    key: 'farmerscarry', name: "Farmer's Carry", icon: '🏋️', domain: 'Functional Strength',
    unit: 'seconds', inputLabel: 'Time holding (seconds) — enter weight in notes',
    desc: 'Full-body functional test: grip under locomotion, core bracing, postural stability. Attia standard: bodyweight for 30s = exceptional.',
    howToTest: 'Pick up weight in each hand (aim for 50-100% bodyweight total). Walk until grip fails. Record time. Note the total weight.',
    source: 'Attia AMA #329 — 2x bodyweight for 30s = exceptional',
    benchmarks: {
      male:   { '20-29': [15, 25, 40, 60, 90], '30-39': [12, 22, 35, 55, 80], '40-49': [10, 20, 30, 50, 70], '50-59': [8, 15, 25, 40, 60], '60+': [5, 12, 20, 35, 50] },
      female: { '20-29': [10, 18, 30, 50, 70], '30-39': [8, 15, 25, 45, 65], '40-49': [6, 12, 22, 38, 55], '50-59': [5, 10, 18, 32, 48], '60+': [4, 8, 15, 25, 40] },
    },
  },
  {
    key: 'pushup', name: 'Push-Up Max', icon: '💪', domain: 'Upper Body Endurance',
    unit: 'reps', inputLabel: 'Max reps (no rest)',
    desc: 'Harvard study: 40+ push-ups = 96% lower cardiovascular event risk vs <10. Tests chest, shoulders, triceps, core.',
    howToTest: 'Standard push-up position. Go to failure with good form (chest to floor, full lockout). Count total reps.',
    source: 'Yang et al. 2019 — JAMA Network Open, 1,104 firefighters, 10-year follow-up',
    benchmarks: {
      male:   { '20-29': [15, 22, 30, 40, 55], '30-39': [12, 18, 25, 35, 48], '40-49': [10, 15, 22, 30, 42], '50-59': [8, 12, 18, 25, 36], '60+': [5, 10, 14, 20, 30] },
      female: { '20-29': [8, 14, 20, 30, 40], '30-39': [6, 11, 17, 25, 35], '40-49': [4, 8, 14, 22, 30], '50-59': [3, 6, 10, 18, 25], '60+': [2, 4, 8, 14, 20] },
    },
  },
  {
    key: 'squat60', name: 'Squat 60s', icon: '🦵', domain: 'Lower Body Endurance',
    unit: 'reps', inputLabel: 'Max reps in 60 seconds',
    desc: 'Dynamic version of the CDC 30-second chair stand test. Predicts fall risk and functional independence. Tests quads, glutes, and cardiovascular recovery.',
    howToTest: 'Set a 60-second timer. Full bodyweight squats (hip crease below knee). Count total reps.',
    source: 'Jones et al. 1999 (chair stand); CDC functional fitness battery',
    benchmarks: {
      male:   { '20-29': [25, 32, 40, 50, 62], '30-39': [22, 28, 36, 46, 58], '40-49': [18, 24, 32, 42, 53], '50-59': [15, 20, 28, 38, 48], '60+': [12, 17, 24, 33, 42] },
      female: { '20-29': [20, 26, 34, 44, 55], '30-39': [18, 23, 30, 40, 50], '40-49': [15, 20, 27, 36, 46], '50-59': [12, 17, 24, 32, 42], '60+': [10, 14, 20, 28, 37] },
    },
  },
  {
    key: 'balance', name: 'Single-Leg Balance', icon: '🦩', domain: 'Balance & Neuromuscular',
    unit: 'seconds', inputLabel: 'Time (seconds, eyes closed)',
    desc: 'Inability to balance 10s on one leg nearly doubles all-cause mortality risk. Eyes closed tests proprioception — a deeper neuromuscular challenge.',
    howToTest: 'Stand on one leg, close your eyes. Time until you put the other foot down or open your eyes. Best of 3 attempts, either leg.',
    source: 'Araújo et al. 2022 — Br J Sports Med, 1,702 subjects',
    benchmarks: {
      male:   { '20-29': [8, 15, 25, 40, 60], '30-39': [6, 12, 20, 35, 50], '40-49': [4, 10, 16, 28, 42], '50-59': [3, 7, 12, 22, 35], '60+': [2, 5, 9, 16, 25] },
      female: { '20-29': [8, 15, 25, 40, 60], '30-39': [6, 12, 20, 35, 50], '40-49': [4, 10, 16, 28, 42], '50-59': [3, 7, 12, 22, 35], '60+': [2, 5, 9, 16, 25] },
    },
  },
  {
    key: 'sitrise', name: 'Sit-Rise Test', icon: '🧘', domain: 'Composite',
    unit: 'score', inputLabel: 'Score (0-10)',
    desc: 'The only test that evaluates strength, power, flexibility, balance, and body composition simultaneously. Each 1-point increase = 21% survival improvement.',
    howToTest: 'Stand barefoot. Sit cross-legged on the floor, then stand back up. Subtract 1 point (from 5 per movement) for each hand, knee, forearm, or leg used. Subtract 0.5 for unsteadiness.',
    source: 'Araújo et al. 2012 — 2,002 subjects, 6.3-year follow-up; European J Prev Cardiology 2025 update',
    benchmarks: {
      male:   { '20-29': [5, 6, 7, 8.5, 10], '30-39': [4, 5.5, 7, 8, 9.5], '40-49': [3.5, 5, 6.5, 7.5, 9], '50-59': [3, 4, 5.5, 7, 8.5], '60+': [2, 3, 5, 6.5, 8] },
      female: { '20-29': [5, 6, 7, 8.5, 10], '30-39': [4, 5.5, 7, 8, 9.5], '40-49': [3.5, 5, 6.5, 7.5, 9], '50-59': [3, 4, 5.5, 7, 8.5], '60+': [2, 3, 5, 6.5, 8] },
    },
  },
  {
    key: 'broadjump', name: 'Broad Jump', icon: '🦘', domain: 'Explosive Power',
    unit: 'inches', inputLabel: 'Distance (inches)',
    desc: 'Explosive power declines 3x faster than strength with age and independently predicts fall risk, disability, and mortality. Tests total-body power + coordination.',
    howToTest: 'Stand with toes behind a line, feet shoulder-width. Jump as far forward as you can. Measure from start line to nearest heel landing. Best of 3.',
    source: 'Skelton et al. — power predicts mortality independently of strength; ALPHA-FIT European battery',
    benchmarks: {
      male:   { '20-29': [65, 75, 85, 96, 108], '30-39': [60, 70, 80, 90, 102], '40-49': [54, 63, 73, 84, 96], '50-59': [46, 55, 66, 77, 88], '60+': [38, 47, 57, 68, 80] },
      female: { '20-29': [48, 58, 66, 76, 88], '30-39': [44, 53, 62, 72, 84], '40-49': [38, 48, 57, 66, 78], '50-59': [32, 42, 51, 60, 72], '60+': [26, 36, 44, 54, 65] },
    },
  },
  {
    key: 'grip', name: 'Grip Strength', icon: '🤜', domain: 'Direct Mortality Predictor',
    unit: 'lbs', inputLabel: 'Max grip (lbs) — dynamometer',
    desc: 'The most directly studied longevity biomarker. Inversely associated with all-cause and cardiovascular mortality across thousands of studies.',
    howToTest: 'Use a hand dynamometer. Squeeze as hard as possible with dominant hand, arm at side. Best of 3 attempts.',
    source: 'Bohannon 2019 — Clinical Interventions in Aging; meta-analysis of 9,431+ subjects',
    optional: true,
    benchmarks: {
      male:   { '20-29': [80, 95, 110, 125, 145], '30-39': [78, 92, 107, 122, 140], '40-49': [72, 86, 100, 116, 134], '50-59': [64, 78, 92, 108, 126], '60+': [52, 66, 80, 96, 114] },
      female: { '20-29': [45, 55, 65, 78, 92], '30-39': [43, 52, 62, 75, 88], '40-49': [38, 48, 58, 70, 84], '50-59': [34, 43, 52, 64, 78], '60+': [28, 36, 46, 56, 70] },
    },
  },
]

const LEVEL_LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']
const LEVEL_COLORS = ['#e01e1e', '#e0881e', '#e0c81e', '#4ade80', '#22d3ee']

function getAgeBracket(age) {
  if (age < 30) return '20-29'
  if (age < 40) return '30-39'
  if (age < 50) return '40-49'
  if (age < 60) return '50-59'
  return '60+'
}

function scoreMarker(value, benchmarks, gender, age) {
  const bracket = getAgeBracket(age)
  const levels = benchmarks?.[gender]?.[bracket]
  if (!levels || !value) return { score: 0, level: 0, levelLabel: 'Not tested' }

  let level = 0
  for (let i = levels.length - 1; i >= 0; i--) {
    if (value >= levels[i]) { level = i; break }
  }
  // Score 0-10: interpolate within the level
  const low = level > 0 ? levels[level - 1] : 0
  const high = levels[level]
  const nextHigh = level < 4 ? levels[level + 1] : levels[4] * 1.2
  const baseScore = level * 2 // 0, 2, 4, 6, 8
  const pct = high !== low ? Math.min(1, (value - levels[level]) / (nextHigh - levels[level])) : 0.5
  const score = Math.min(10, baseScore + pct * 2)

  return { score: Math.round(score * 10) / 10, level, levelLabel: LEVEL_LABELS[level], target: level < 4 ? levels[level + 1] : null }
}

function computeVitalAge(longevityIndex, chronoAge) {
  // Map 0-100 index to age offset
  if (longevityIndex >= 90) return chronoAge - Math.round((longevityIndex - 90) * 1.5)
  if (longevityIndex >= 70) return chronoAge - Math.round((longevityIndex - 70) * 0.5)
  if (longevityIndex >= 50) return chronoAge
  if (longevityIndex >= 30) return chronoAge + Math.round((50 - longevityIndex) * 0.4)
  return chronoAge + Math.round((50 - longevityIndex) * 0.75)
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

  useEffect(() => {
    if (session) { loadScores(); loadProfile() }
  }, [session])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('age, gender').eq('id', session.user.id).single()
    if (data) {
      if (data.age) setAge(String(data.age))
      if (data.gender) setGender(data.gender)
    }
    setProfileLoaded(true)
  }

  async function loadScores() {
    const { data } = await supabase
      .from('longevity_scores')
      .select('*')
      .eq('user_id', session.user.id)
      .order('tested_at', { ascending: false })
    if (data) setScores(data)
  }

  async function saveScore(markerKey) {
    if (!session) { onAuthRequired(); return }
    const val = parseFloat(inputValue)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    const marker = MARKERS.find(m => m.key === markerKey)
    await supabase.from('longevity_scores').insert({
      user_id: session.user.id,
      marker: markerKey,
      value: val,
      unit: marker?.unit || '',
      notes: inputNotes.trim() || null,
      tested_at: new Date().toISOString().slice(0, 10),
    })
    setInputValue('')
    setInputNotes('')
    setSaving(false)
    loadScores()
    updateVitalAge()
  }

  async function updateVitalAge() {
    if (!age) return
    // Compute after a delay to let scores load
    setTimeout(async () => {
      const { data } = await supabase.from('longevity_scores').select('*').eq('user_id', session.user.id).order('tested_at', { ascending: false })
      if (!data) return
      const latestByMarker = {}
      data.forEach(s => { if (!latestByMarker[s.marker]) latestByMarker[s.marker] = s })
      const tested = MARKERS.filter(m => latestByMarker[m.key])
      if (tested.length === 0) return
      const totalScore = tested.reduce((sum, m) => {
        const result = scoreMarker(latestByMarker[m.key].value, m.benchmarks, gender, parseInt(age))
        return sum + result.score
      }, 0)
      const idx = Math.round((totalScore / (tested.length * 10)) * 100)
      const va = computeVitalAge(idx, parseInt(age))
      await supabase.from('profiles').update({ longevity_index: idx, vital_age: va }).eq('id', session.user.id)
    }, 500)
  }

  // Get latest score per marker
  const latestScores = useMemo(() => {
    const map = {}
    scores.forEach(s => { if (!map[s.marker]) map[s.marker] = s })
    return map
  }, [scores])

  // Compute overall index
  const { longevityIndex, vitalAge, testedCount, markerResults } = useMemo(() => {
    const a = parseInt(age) || 30
    const results = {}
    let totalScore = 0, count = 0
    MARKERS.forEach(m => {
      const latest = latestScores[m.key]
      if (latest) {
        const result = scoreMarker(latest.value, m.benchmarks, gender, a)
        results[m.key] = { ...result, value: latest.value, tested_at: latest.tested_at }
        totalScore += result.score
        count++
      } else {
        results[m.key] = { score: 0, level: -1, levelLabel: 'Not tested', value: null }
      }
    })
    const idx = count > 0 ? Math.round((totalScore / (count * 10)) * 100) : 0
    return { longevityIndex: idx, vitalAge: computeVitalAge(idx, a), testedCount: count, markerResults: results }
  }, [latestScores, age, gender])

  const ageDiff = vitalAge - (parseInt(age) || 30)

  // History for a marker
  const markerHistory = useMemo(() => {
    if (!showHistory) return []
    return scores.filter(s => s.marker === showHistory).slice(0, 20)
  }, [scores, showHistory])

  // ============= Not logged in =============
  if (!session) {
    return (
      <div className="lon-section">
        <div className="lon-hero">
          <div className="lon-hero-icon">🧬</div>
          <h2 className="lon-hero-title">Vital Age</h2>
          <p className="lon-hero-sub">Track 10 science-backed longevity markers and discover your functional fitness age.</p>
        </div>
        <div className="lon-teaser">
          <div className="lon-teaser-grid">
            {MARKERS.filter(m => !m.optional).map(m => (
              <div key={m.key} className="lon-teaser-card">
                <span className="lon-teaser-icon">{m.icon}</span>
                <span className="lon-teaser-name">{m.name}</span>
              </div>
            ))}
          </div>
          <div className="lon-teaser-cta">Sign in to start testing and discover your Vital Age</div>
        </div>
      </div>
    )
  }

  // ============= Setup: need age =============
  if (!age && profileLoaded) {
    return (
      <div className="lon-section">
        <div className="lon-hero">
          <div className="lon-hero-icon">🧬</div>
          <h2 className="lon-hero-title">Vital Age</h2>
          <p className="lon-hero-sub">To calculate your Vital Age, we need your age and gender.</p>
        </div>
        <div className="lon-setup">
          <label className="orm-label">Your Age</label>
          <input type="number" className="orm-input" placeholder="e.g. 35" value={age} onChange={e => setAge(e.target.value)} style={{ maxWidth: '120px', marginBottom: '12px' }} />
          <label className="orm-label">Gender</label>
          <div className="orm-gender" style={{ marginBottom: '16px' }}>
            <button className={`orm-gender-btn${gender === 'male' ? ' on' : ''}`} onClick={() => setGender('male')}>Male</button>
            <button className={`orm-gender-btn${gender === 'female' ? ' on' : ''}`} onClick={() => setGender('female')}>Female</button>
          </div>
          {age && <button className="timer-go-btn" onClick={async () => {
            await supabase.from('profiles').update({ age: parseInt(age), gender }).eq('id', session.user.id)
          }} style={{ maxWidth: '240px' }}>Save & Continue</button>}
        </div>
      </div>
    )
  }

  // ============= Test Day Mode =============
  if (testMode) {
    const marker = MARKERS[testStep]
    const a = parseInt(age) || 30
    const bracket = getAgeBracket(a)
    const benchmarks = marker.benchmarks?.[gender]?.[bracket] || []

    return (
      <div className="lon-section">
        <button className="pr-hub-back" onClick={() => { setTestMode(false); setTestStep(0) }}>← Exit Test Day</button>
        <div className="lon-test-progress">
          <div className="lon-test-prog-bar">
            <div className="lon-test-prog-fill" style={{ width: `${((testStep) / MARKERS.length) * 100}%` }}></div>
          </div>
          <div className="lon-test-prog-label">Test {testStep + 1} of {MARKERS.length}</div>
        </div>

        <div className="lon-test-card">
          <div className="lon-test-icon">{marker.icon}</div>
          <h3 className="lon-test-name">{marker.name}</h3>
          <div className="lon-test-domain">{marker.domain}</div>
          <p className="lon-test-desc">{marker.desc}</p>

          <div className="lon-test-how">
            <div className="lon-test-how-label">How to Test</div>
            <p>{marker.howToTest}</p>
          </div>

          {benchmarks.length > 0 && (
            <div className="lon-test-benchmarks">
              {LEVEL_LABELS.map((l, i) => (
                <div key={l} className="lon-test-bench">
                  <span className="lon-bench-dot" style={{ background: LEVEL_COLORS[i] }}></span>
                  <span className="lon-bench-label">{l}</span>
                  <span className="lon-bench-val">{benchmarks[i]} {marker.unit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="lon-test-input">
            <input type="number" className="orm-input" placeholder={marker.inputLabel} value={inputValue} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} />
            <span className="lon-test-unit">{marker.unit}</span>
          </div>
          <input className="orm-input" placeholder="Notes (optional, e.g. weight for farmer's carry)" value={inputNotes} onChange={e => setInputNotes(e.target.value)} style={{ marginTop: '6px' }} />

          <div className="lon-test-actions">
            {marker.optional && (
              <button className="doc-ctrl" onClick={() => {
                if (testStep < MARKERS.length - 1) { setTestStep(testStep + 1); setInputValue(''); setInputNotes('') }
                else { setTestMode(false); setTestStep(0) }
              }}>Skip (optional)</button>
            )}
            <button className="timer-go-btn" disabled={saving || !inputValue} onClick={async () => {
              await saveScore(marker.key)
              if (testStep < MARKERS.length - 1) { setTestStep(testStep + 1); setInputValue(''); setInputNotes('') }
              else { setTestMode(false); setTestStep(0) }
            }}>{testStep < MARKERS.length - 1 ? 'Save & Next →' : '🏁 Finish Test Day'}</button>
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
        <div className="lon-vital-ring" style={{ borderColor: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
          <div className="lon-vital-age">{testedCount > 0 ? vitalAge : '?'}</div>
          <div className="lon-vital-label">Vital Age</div>
        </div>
        <div className="lon-vital-info">
          <div className="lon-vital-title">🧬 Your Vital Age</div>
          {testedCount > 0 ? (
            <>
              <div className="lon-vital-diff" style={{ color: ageDiff <= -5 ? '#22d3ee' : ageDiff <= 0 ? '#4ade80' : ageDiff <= 5 ? '#e0c81e' : '#e01e1e' }}>
                {ageDiff < 0 ? `${Math.abs(ageDiff)} years younger` : ageDiff === 0 ? 'On track for your age' : `${ageDiff} years older`} than your age of {age}
              </div>
              <div className="lon-vital-index">Longevity Index: {longevityIndex}/100 • {testedCount}/{MARKERS.length} tested</div>
            </>
          ) : (
            <div className="lon-vital-index">Complete your first test to see your Vital Age</div>
          )}
          <button className="lon-test-day-btn" onClick={() => { setTestMode(true); setTestStep(0); setInputValue(''); setInputNotes('') }}>
            🧪 Start Test Day
          </button>
        </div>
      </div>

      {/* Marker Cards */}
      <div className="lon-markers">
        {MARKERS.map(m => {
          const result = markerResults[m.key]
          const isExpanded = expandedMarker === m.key
          const a = parseInt(age) || 30
          const bracket = getAgeBracket(a)
          const benchmarks = m.benchmarks?.[gender]?.[bracket] || []
          const hasScore = result?.value != null

          return (
            <div key={m.key} className={`lon-marker${isExpanded ? ' expanded' : ''}${m.optional ? ' optional' : ''}`}>
              <div className="lon-marker-hd" onClick={() => setExpandedMarker(isExpanded ? null : m.key)}>
                <span className="lon-marker-icon">{m.icon}</span>
                <div className="lon-marker-info">
                  <div className="lon-marker-name">{m.name}{m.optional ? ' (optional)' : ''}</div>
                  <div className="lon-marker-domain">{m.domain}</div>
                </div>
                {hasScore ? (
                  <div className="lon-marker-score-wrap">
                    <div className="lon-marker-value">{result.value} <span className="lon-marker-unit">{m.unit}</span></div>
                    <div className="lon-marker-level" style={{ color: result.level >= 0 ? LEVEL_COLORS[result.level] : 'var(--tx3)' }}>
                      {result.levelLabel} • {result.score}/10
                    </div>
                  </div>
                ) : (
                  <div className="lon-marker-empty">Not tested</div>
                )}
                <span className={`lon-marker-arrow${isExpanded ? ' open' : ''}`}>▾</span>
              </div>

              {/* Progress bar */}
              {hasScore && (
                <div className="lon-marker-bar">
                  <div className="lon-marker-fill" style={{ width: `${(result.score / 10) * 100}%`, background: result.level >= 0 ? LEVEL_COLORS[result.level] : 'var(--tx3)' }}></div>
                </div>
              )}

              {/* Expanded */}
              {isExpanded && (
                <div className="lon-marker-body">
                  <p className="lon-marker-desc">{m.desc}</p>

                  <div className="lon-test-how">
                    <div className="lon-test-how-label">How to Test</div>
                    <p>{m.howToTest}</p>
                  </div>

                  <div className="lon-marker-source">📚 {m.source}</div>

                  {/* Benchmarks */}
                  {benchmarks.length > 0 && (
                    <div className="lon-test-benchmarks">
                      {LEVEL_LABELS.map((l, i) => (
                        <div key={l} className={`lon-test-bench${hasScore && result.level === i ? ' current' : ''}`}>
                          <span className="lon-bench-dot" style={{ background: LEVEL_COLORS[i] }}></span>
                          <span className="lon-bench-label">{l}</span>
                          <span className="lon-bench-val">{benchmarks[i]} {m.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick log */}
                  <div className="lon-quick-log">
                    <input type="number" className="orm-input" placeholder={m.inputLabel} value={expandedMarker === m.key ? inputValue : ''} onChange={e => setInputValue(e.target.value)} style={{ flex: 1 }} />
                    <button className="ab p" disabled={saving || !inputValue} onClick={() => saveScore(m.key)}>{saving ? '...' : '💾 Log'}</button>
                  </div>

                  {/* History toggle */}
                  <button className="lon-history-btn" onClick={() => setShowHistory(showHistory === m.key ? null : m.key)}>
                    {showHistory === m.key ? 'Hide History' : '📊 Show History'}
                  </button>

                  {showHistory === m.key && markerHistory.length > 0 && (
                    <div className="lon-history">
                      {markerHistory.map(h => (
                        <div key={h.id} className="lon-history-row">
                          <span className="lon-history-date">{h.tested_at}</span>
                          <span className="lon-history-val">{h.value} {h.unit}</span>
                          {h.notes && <span className="lon-history-notes">{h.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {showHistory === m.key && markerHistory.length === 0 && (
                    <div className="lon-history-empty">No history yet — log your first test!</div>
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
