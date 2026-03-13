import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ============= Formulas =============
const FORMULAS = {
  epley:    { name: 'Epley',    calc: (w, r) => r === 1 ? w : w * (1 + r / 30), tip: 'General purpose' },
  brzycki:  { name: 'Brzycki',  calc: (w, r) => r === 1 ? w : w * (36 / (37 - r)), tip: 'Best for 1-6 reps' },
  lombardi: { name: 'Lombardi', calc: (w, r) => r === 1 ? w : w * Math.pow(r, 0.10), tip: 'Higher rep ranges' },
  mayhew:   { name: 'Mayhew',   calc: (w, r) => r === 1 ? w : (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)), tip: 'Bench press focused' },
  oconner:  { name: "O'Conner", calc: (w, r) => r === 1 ? w : w * (1 + r * 0.025), tip: 'Conservative' },
  wathan:   { name: 'Wathan',   calc: (w, r) => r === 1 ? w : (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)), tip: 'Moderate reps' },
}

// RPE
const RPE_RIR = { 10: 0, 9.5: 0.5, 9: 1, 8.5: 1.5, 8: 2, 7.5: 2.5, 7: 3, 6.5: 3.5, 6: 4 }

// Strength Standards (BW multipliers: [Beginner, Novice, Intermediate, Advanced, Elite])
const STD_M = {
  'Bench Press': [0.50, 0.75, 1.00, 1.50, 2.00], 'Squat': [0.75, 1.00, 1.50, 2.00, 2.75],
  'Deadlift': [1.00, 1.25, 1.75, 2.50, 3.25], 'Overhead Press': [0.35, 0.50, 0.75, 1.00, 1.40],
  'Barbell Row': [0.40, 0.60, 0.85, 1.20, 1.60], 'Power Clean': [0.50, 0.75, 1.00, 1.35, 1.75],
  'Front Squat': [0.55, 0.80, 1.15, 1.55, 2.05],
}
const STD_F = {
  'Bench Press': [0.25, 0.40, 0.60, 0.85, 1.20], 'Squat': [0.50, 0.75, 1.00, 1.50, 2.00],
  'Deadlift': [0.60, 0.85, 1.25, 1.75, 2.50], 'Overhead Press': [0.20, 0.30, 0.45, 0.65, 0.90],
  'Barbell Row': [0.25, 0.40, 0.60, 0.85, 1.15], 'Power Clean': [0.30, 0.45, 0.65, 0.90, 1.25],
  'Front Squat': [0.40, 0.55, 0.80, 1.15, 1.60],
}
const LVL = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
const LVL_C = ['#6b7280', '#60a5fa', '#4ade80', '#fbbf24', '#e01e1e']
const LVL_D = ['New to lifting (<3mo)', 'Some experience (3-12mo)', 'Consistent (1-3yr)', 'Dedicated (3-5+yr)', 'Competitive (5+yr)']
const MOVEMENTS = Object.keys(STD_M)

// Percentage chart
const PCT = [
  { p: 100, r: 1, u: 'Max effort' }, { p: 95, r: 2, u: 'Peaking' }, { p: 90, r: 3, u: 'Heavy strength' },
  { p: 85, r: 5, u: 'Strength building' }, { p: 80, r: 8, u: 'Hypertrophy/strength' },
  { p: 75, r: 10, u: 'Hypertrophy' }, { p: 70, r: 12, u: 'Volume' },
  { p: 65, r: 15, u: 'Endurance' }, { p: 60, r: 18, u: 'Technique' },
]

// Plate calculator
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5]
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
function calcPlates(target, bar, unit) {
  const plates = unit === 'lbs' ? PLATES_LBS : PLATES_KG
  let side = (target - bar) / 2
  if (side <= 0) return []
  const res = []
  for (const p of plates) { while (side >= p - 0.01) { res.push(p); side -= p } }
  return res
}

export default function OneRMCalculator({ session, onAuthRequired, existingPRs }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [formula, setFormula] = useState('epley')
  const [rpe, setRpe] = useState('')
  const [useRpe, setUseRpe] = useState(false)
  const [bodyweight, setBodyweight] = useState('')
  const [gender, setGender] = useState('male')
  const [movement, setMovement] = useState('Bench Press')
  const [unit, setUnit] = useState('lbs')
  const [tab, setTab] = useState('calc')
  const [plateTarget, setPlateTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const bar = unit === 'lbs' ? 45 : 20

  // 1RM
  const results = useMemo(() => {
    const w = parseFloat(weight), r = parseInt(reps)
    if (!w || !r || r < 1) return null
    const adj = useRpe && rpe ? r + (RPE_RIR[parseFloat(rpe)] ?? 0) : r
    const all = {}; let sum = 0
    for (const [k, f] of Object.entries(FORMULAS)) { const v = Math.round(f.calc(w, adj)); all[k] = v; sum += v }
    return { all, avg: Math.round(sum / 6), selected: all[formula], reps: r, adj }
  }, [weight, reps, formula, rpe, useRpe])

  // Strength level
  const level = useMemo(() => {
    if (!results || !bodyweight) return null
    const bw = parseFloat(bodyweight)
    if (!bw) return null
    const stds = (gender === 'male' ? STD_M : STD_F)[movement]
    if (!stds) return null
    const th = stds.map(m => Math.round(m * bw))
    let lvl = -1
    for (let i = 0; i < th.length; i++) { if (results.selected >= th[i]) lvl = i }
    if (lvl < 0) lvl = 0
    const next = lvl < 4 ? th[lvl + 1] : null
    const prog = next ? Math.min(100, Math.max(0, Math.round(((results.selected - th[lvl]) / (next - th[lvl])) * 100))) : 100
    return { lvl, ratio: (results.selected / bw).toFixed(2), th, prog, next }
  }, [results, bodyweight, gender, movement])

  // 1RM History from existing PRs
  const history = useMemo(() => {
    if (!existingPRs?.length) return []
    const byMvt = {}
    existingPRs.filter(p => p.type === 'strength' && p.weight).forEach(p => {
      const key = p.movement
      if (!byMvt[key]) byMvt[key] = []
      const w = parseFloat(p.weight)
      const r = parseInt(p.score) || 1
      const e1rm = Math.round(FORMULAS.epley.calc(w, r))
      byMvt[key].push({ date: p.completed_at, weight: w, reps: r, e1rm })
    })
    return Object.entries(byMvt).map(([mvt, entries]) => ({
      movement: mvt,
      entries: entries.sort((a, b) => new Date(b.date) - new Date(a.date)),
      best: Math.max(...entries.map(e => e.e1rm)),
    })).sort((a, b) => b.best - a.best)
  }, [existingPRs])

  // Warm-up
  const warmup = useMemo(() => {
    if (!results) return []
    const m = results.selected
    const r = p => Math.round(m * p / 5) * 5
    return [
      { l: 'Empty bar', w: bar, r: 10, p: 0 },
      { l: '40%', w: r(0.40), r: 8, p: 40 },
      { l: '55%', w: r(0.55), r: 5, p: 55 },
      { l: '70%', w: r(0.70), r: 3, p: 70 },
      { l: '80%', w: r(0.80), r: 2, p: 80 },
      { l: '90%', w: r(0.90), r: 1, p: 90 },
    ]
  }, [results, unit])

  // Save as PR
  async function saveAsPR() {
    if (!session) { onAuthRequired(); return }
    if (!results || !movement) return
    setSaving(true)
    await supabase.from('personal_records').insert({
      user_id: session.user.id,
      movement,
      type: 'strength',
      weight: `${weight} ${unit}`,
      score: `${reps}`,
      completed_at: new Date().toISOString().slice(0, 10),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="orm">
      <div className="orm-hero">
        <h3 className="orm-title">🏋️ Strength Calculator</h3>
        <p className="orm-sub">1RM estimates, strength standards, warm-ups, and plate loading.</p>
      </div>

      <div className="orm-tabs">
        {[['calc', '1RM Calculator'], ['standards', 'Standards'], ['warmup', 'Warm-Up'], ['history', 'PR History']].map(([k, l]) => (
          <button key={k} className={`orm-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ===== 1RM CALCULATOR ===== */}
      {tab === 'calc' && (
        <div className="orm-panel">
          <div className="orm-row-2">
            <div className="orm-fld">
              <label className="orm-lbl">Weight</label>
              <div className="orm-inp-grp">
                <input type="number" className="orm-inp" placeholder="225" value={weight} onChange={e => setWeight(e.target.value)} />
                <select className="orm-unit" value={unit} onChange={e => setUnit(e.target.value)}><option value="lbs">lbs</option><option value="kg">kg</option></select>
              </div>
            </div>
            <div className="orm-fld">
              <label className="orm-lbl">Reps</label>
              <input type="number" className="orm-inp" placeholder="5" value={reps} onChange={e => setReps(e.target.value)} min="1" max="30" />
            </div>
          </div>

          <div className="orm-rpe">
            <label className="orm-rpe-tog" onClick={() => setUseRpe(!useRpe)}>
              <span className={`orm-chk${useRpe ? ' on' : ''}`}>{useRpe ? '✓' : ''}</span> Adjust for RPE
            </label>
            {useRpe && (
              <select className="orm-sel" value={rpe} onChange={e => setRpe(e.target.value)}>
                <option value="">Select RPE</option>
                {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6].map(v => <option key={v} value={v}>RPE {v} ({RPE_RIR[v]} RIR)</option>)}
              </select>
            )}
          </div>

          <div className="orm-formulas">
            {Object.entries(FORMULAS).map(([k, f]) => (
              <button key={k} className={`orm-fm${formula === k ? ' on' : ''}`} onClick={() => setFormula(k)}>
                <b>{f.name}</b><span>{f.tip}</span>
              </button>
            ))}
          </div>

          {results && (
            <>
              <div className="orm-big">
                <div className="orm-big-label">Estimated 1RM</div>
                <div className="orm-big-num">{results.selected}<span className="orm-big-u">{unit}</span></div>
                <div className="orm-big-formula">{FORMULAS[formula].name}</div>
                {useRpe && rpe && results.adj !== results.reps && (
                  <div className="orm-rpe-note">RPE {rpe}: {results.reps} reps → {results.adj.toFixed(1)} effective</div>
                )}
                <div className="orm-big-actions">
                  <button className="orm-save-btn" onClick={saveAsPR} disabled={saving || saved}>
                    {saved ? '✓ Saved as PR!' : saving ? '...' : `💾 Save ${movement} PR`}
                  </button>
                  <select className="orm-sel sm" value={movement} onChange={e => setMovement(e.target.value)}>
                    {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="orm-section">
                <div className="orm-sec-label">All Formulas</div>
                {Object.entries(results.all).map(([k, v]) => {
                  const max = Math.max(...Object.values(results.all))
                  return (
                    <div key={k} className={`orm-cmp${k === formula ? ' sel' : ''}`}>
                      <span className="orm-cmp-n">{FORMULAS[k].name}</span>
                      <div className="orm-cmp-bar"><div className="orm-cmp-fill" style={{ width: `${(v / max) * 100}%` }}></div></div>
                      <span className="orm-cmp-v">{v}</span>
                    </div>
                  )
                })}
                <div className="orm-cmp avg"><span className="orm-cmp-n">Average</span><span className="orm-cmp-v">{results.avg} {unit}</span></div>
              </div>

              <div className="orm-section">
                <div className="orm-sec-label">Training Percentages</div>
                {PCT.map(row => {
                  const w = Math.round(results.selected * row.p / 100 / 5) * 5
                  const open = plateTarget === row.p
                  return (
                    <div key={row.p}>
                      <div className="orm-pct" onClick={() => setPlateTarget(open ? null : row.p)}>
                        <span className="orm-pct-p">{row.p}%</span>
                        <span className="orm-pct-w">{w} {unit}</span>
                        <span className="orm-pct-r">×{row.r}</span>
                        <span className="orm-pct-u">{row.u}</span>
                        <span className="orm-pct-btn">{open ? '▼' : '🔩'}</span>
                      </div>
                      {open && <PlateView weight={w} bar={bar} unit={unit} />}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== STRENGTH STANDARDS ===== */}
      {tab === 'standards' && (
        <div className="orm-panel">
          <div className="orm-row-2">
            <div className="orm-fld">
              <label className="orm-lbl">Bodyweight</label>
              <div className="orm-inp-grp">
                <input type="number" className="orm-inp" placeholder="180" value={bodyweight} onChange={e => setBodyweight(e.target.value)} />
                <span className="orm-unit-s">{unit}</span>
              </div>
            </div>
            <div className="orm-fld">
              <label className="orm-lbl">Gender</label>
              <div className="orm-gender">
                <button className={`orm-gb${gender === 'male' ? ' on' : ''}`} onClick={() => setGender('male')}>Male</button>
                <button className={`orm-gb${gender === 'female' ? ' on' : ''}`} onClick={() => setGender('female')}>Female</button>
              </div>
            </div>
          </div>

          <div className="orm-mvts">
            {MOVEMENTS.map(m => <button key={m} className={`orm-mvt${movement === m ? ' on' : ''}`} onClick={() => setMovement(m)}>{m}</button>)}
          </div>

          {bodyweight ? (
            <>
              {level && results && (
                <div className="orm-lvl-card" style={{ borderColor: LVL_C[level.lvl] }}>
                  <div className="orm-lvl-badge" style={{ background: LVL_C[level.lvl] }}>{LVL[level.lvl]}</div>
                  <div className="orm-lvl-info">
                    <span>{level.ratio}× BW</span> • <span>{results.selected} {unit} {movement}</span>
                  </div>
                  {level.next && (
                    <div className="orm-lvl-prog">
                      <div className="orm-lvl-bar"><div className="orm-lvl-fill" style={{ width: `${level.prog}%`, background: LVL_C[Math.min(level.lvl + 1, 4)] }}></div></div>
                      <span className="orm-lvl-gap">{level.next - results.selected} {unit} to {LVL[level.lvl + 1]}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="orm-std-tbl">
                <div className="orm-std-hdr">
                  <div className="orm-std-hdr-m">Movement</div>
                  {LVL.map((n, i) => <div key={n} className="orm-std-hdr-l"><span className="orm-dot" style={{ background: LVL_C[i] }}></span><span className="orm-std-hdr-t">{n}</span></div>)}
                </div>
                {MOVEMENTS.map(m => {
                  const stds = (gender === 'male' ? STD_M : STD_F)[m]
                  const bw = parseFloat(bodyweight) || 0
                  const act = m === movement
                  return (
                    <div key={m} className={`orm-std-row${act ? ' act' : ''}`} onClick={() => setMovement(m)}>
                      <div className="orm-std-m">{m}</div>
                      {stds.map((mult, i) => {
                        const v = Math.round(mult * bw)
                        const hit = level && act && results && results.selected >= v
                        return <div key={i} className={`orm-std-v${hit ? ' hit' : ''}`}>{v}</div>
                      })}
                    </div>
                  )
                })}
              </div>

              <div className="orm-legend">
                {LVL.map((n, i) => <div key={n} className="orm-leg"><span className="orm-dot" style={{ background: LVL_C[i] }}></span><b>{n}:</b> {LVL_D[i]}</div>)}
              </div>

              {!results && <div className="orm-hint">💡 Enter weight & reps in the Calculator tab to see your level.</div>}
            </>
          ) : <div className="orm-empty">Enter your bodyweight to see personalized standards.</div>}
        </div>
      )}

      {/* ===== WARM-UP ===== */}
      {tab === 'warmup' && (
        <div className="orm-panel">
          {!results ? <div className="orm-empty">Calculate your 1RM first (Calculator tab).</div> : (
            <>
              <div className="orm-warmup-hdr">Warm-up for <b>{results.selected} {unit}</b> 1RM</div>
              {warmup.map((s, i) => (
                <div key={i} className="orm-wu">
                  <div className="orm-wu-n">{i + 1}</div>
                  <div className="orm-wu-info">
                    <div className="orm-wu-w">{s.w} {unit}</div>
                    <div className="orm-wu-d">{s.l} • {s.r} rep{s.r > 1 ? 's' : ''}</div>
                  </div>
                  <div className="orm-wu-bar"><div className="orm-wu-fill" style={{ width: `${Math.min(100, (s.w / results.selected) * 100)}%` }}></div></div>
                  <button className="orm-wu-pl" onClick={() => setPlateTarget(plateTarget === `w${i}` ? null : `w${i}`)}>🔩</button>
                  {plateTarget === `w${i}` && <PlateView weight={s.w} bar={bar} unit={unit} />}
                </div>
              ))}
              <div className="orm-wu-note">Rest 60-90s between warm-ups, 2-3 min before working sets.</div>
            </>
          )}
        </div>
      )}

      {/* ===== PR HISTORY ===== */}
      {tab === 'history' && (
        <div className="orm-panel">
          {history.length === 0 ? (
            <div className="orm-empty">No strength PRs logged yet. Log PRs above and they'll appear here with estimated 1RMs.</div>
          ) : (
            <>
              <div className="orm-sec-label">Your Estimated 1RMs from PRs</div>
              {history.map(h => (
                <div key={h.movement} className="orm-hist-grp">
                  <div className="orm-hist-hdr">
                    <span className="orm-hist-mvt">{h.movement}</span>
                    <span className="orm-hist-best">Best e1RM: <b>{h.best} {unit}</b></span>
                  </div>
                  {h.entries.slice(0, 5).map((e, i) => (
                    <div key={i} className="orm-hist-row">
                      <span className="orm-hist-date">{e.date}</span>
                      <span className="orm-hist-set">{e.weight} × {e.reps}</span>
                      <span className="orm-hist-e1rm">e1RM: {e.e1rm}</span>
                      {i === 0 && <span className="orm-hist-flag">Latest</span>}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PlateView({ weight, bar, unit }) {
  const plates = calcPlates(weight, bar, unit)
  if (weight <= bar) return <div className="orm-plate-box">Bar only ({bar} {unit})</div>
  return (
    <div className="orm-plate-box">
      <div className="orm-plate-title">Each side:</div>
      <div className="orm-plate-chips">{plates.map((p, i) => <span key={i} className="orm-plate-chip">{p}</span>)}</div>
      <div className="orm-plate-bar">Bar: {bar} {unit}</div>
    </div>
  )
}
