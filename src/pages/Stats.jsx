import { useMemo } from 'react'

function Bar({ val, max, color }) {
  const pct = Math.round((val / max) * 100)
  return <div className="stat-bar"><div className="stat-fill" style={{ width: `${pct}%`, background: color }}></div></div>
}

export default function Stats({ workouts, favorites }) {
  const stats = useMemo(() => {
    // Use performance log dates for user-specific stats
    const logsWithDates = workouts
      .filter(w => w.performance_log && w.performance_log.length > 0)
      .flatMap(w => w.performance_log.map(p => p.completed_at).filter(Boolean))
    const done = workouts.filter(w => w.performance_log && w.performance_log.length > 0)
    const queue = workouts.filter(w => !w.performance_log || w.performance_log.length === 0)

    // Years
    const years = {}
    logsWithDates.forEach(d => { const y = d.slice(0, 4); years[y] = (years[y] || 0) + 1 })

    // Months (last 12)
    const months = {}
    logsWithDates.forEach(d => { const m = d.slice(0, 7); months[m] = (months[m] || 0) + 1 })
    const monthKeys = Object.keys(months).sort().slice(-12)
    const maxMonth = Math.max(...monthKeys.map(k => months[k]), 1)

    // Equipment
    const eqCount = {}
    workouts.forEach(w => w.equipment?.forEach(e => { if (e !== 'Bodyweight') eqCount[e] = (eqCount[e] || 0) + 1 }))
    const topEq = Object.entries(eqCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // Movement types
    const mcCount = {}
    workouts.forEach(w => w.movement_categories?.forEach(m => { if (m !== 'General' && m !== 'Cardio') mcCount[m] = (mcCount[m] || 0) + 1 }))
    const topMc = Object.entries(mcCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // Workout types
    const wtCount = {}
    workouts.forEach(w => w.workout_types?.forEach(t => { if (t !== 'General') wtCount[t] = (wtCount[t] || 0) + 1 }))
    const topWt = Object.entries(wtCount).sort((a, b) => b[1] - a[1])

    // Heatmap (last 180 days)
    const dates = new Set(logsWithDates)
    const today = new Date()
    const calDays = []
    for (let i = 179; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const count = logsWithDates.filter(ld => ld === ds).length
      calDays.push({ d: ds, n: count, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    }

    // Streak
    let best = 0, cur = 0, cStreak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      if (dates.has(ds)) { cur++; if (cur > best) best = cur } else { if (i === 0) continue; cur = 0 }
    }
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      if (dates.has(ds)) cStreak++; else if (i > 0) break
    }

    return { done, queue, dated, years, months, monthKeys, maxMonth, topEq, topMc, topWt, calDays, best, cStreak }
  }, [workouts])

  return (
    <div className="stats-section">
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{workouts.length}</div><div className="stat-lbl">Total Workouts</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--grn)' }}>{stats.done.length}</div><div className="stat-lbl">Completed</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--cyn)' }}>{stats.queue.length}</div><div className="stat-lbl">In Queue</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--ylw)' }}>{stats.cStreak}</div><div className="stat-lbl">Current Streak</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--acc)' }}>{stats.best}</div><div className="stat-lbl">Best Streak</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: 'var(--prp)' }}>{favorites.size}</div><div className="stat-lbl">Favorites</div></div>
      </div>

      <div className="stat-panel">
        <h4>Activity Heatmap <span>(last 6 months)</span></h4>
        <div className="heatmap">
          {stats.calDays.map(d => (
            <div key={d.d} className={`hm-day${d.n > 0 ? ' active' : ''}${d.n > 1 ? ' multi' : ''}`} title={`${d.label}: ${d.n} workout${d.n !== 1 ? 's' : ''}`}></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--tx3)', marginTop: '4px' }}>
          <span>{stats.calDays[0]?.label}</span><span>Today</span>
        </div>
      </div>

      <div className="stat-panel">
        <h4>Workouts by Year</h4>
        {Object.entries(stats.years).sort((a, b) => a[0].localeCompare(b[0])).map(([y, n]) => (
          <div key={y} className="stat-row">
            <span className="stat-key">{y}</span>
            <span className="stat-val">{n}</span>
            <Bar val={n} max={Math.max(...Object.values(stats.years))} color="var(--acc)" />
          </div>
        ))}
      </div>

      <div className="stat-panel">
        <h4>Workouts by Month <span>(last 12)</span></h4>
        {stats.monthKeys.map(m => {
          const label = new Date(m + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          return (
            <div key={m} className="stat-row">
              <span className="stat-key">{label}</span>
              <span className="stat-val">{stats.months[m]}</span>
              <Bar val={stats.months[m]} max={stats.maxMonth} color="var(--grn)" />
            </div>
          )
        })}
      </div>

      <div className="stats-2col">
        <div className="stat-panel">
          <h4>Top Equipment</h4>
          {stats.topEq.map(([e, n]) => (
            <div key={e} className="stat-row">
              <span className="stat-key">{e}</span>
              <span className="stat-val">{n}</span>
              <Bar val={n} max={stats.topEq[0]?.[1] || 1} color="var(--prp)" />
            </div>
          ))}
        </div>
        <div className="stat-panel">
          <h4>Top Movements</h4>
          {stats.topMc.map(([m, n]) => (
            <div key={m} className="stat-row">
              <span className="stat-key">{m}</span>
              <span className="stat-val">{n}</span>
              <Bar val={n} max={stats.topMc[0]?.[1] || 1} color="var(--ylw)" />
            </div>
          ))}
        </div>
      </div>

      <div className="stat-panel">
        <h4>Workout Types</h4>
        <div className="stats-2col" style={{ gap: 0 }}>
          {stats.topWt.map(([t, n]) => (
            <div key={t} className="stat-row">
              <span className="stat-key">{t}</span>
              <span className="stat-val">{n}</span>
              <Bar val={n} max={stats.topWt[0]?.[1] || 1} color="var(--blu)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
