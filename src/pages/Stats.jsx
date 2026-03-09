import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Bar({ val, max, color }) {
  const pct = Math.round((val / max) * 100)
  return <div className="stat-bar"><div className="stat-fill" style={{ width: `${pct}%`, background: color }}></div></div>
}

export default function Stats({ workouts, favorites }) {
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    // Get all performance logs with profiles and workout names
    const { data } = await supabase
      .from('performance_log')
      .select('score, completed_at, workout_id, user_id, profiles(display_name), workouts(name, score_type)')
      .not('score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(200)
    if (data) {
      // Group by workout, find best scores per user
      const byWorkout = {}
      data.forEach(entry => {
        const wName = entry.workouts?.name || 'Unnamed'
        const scoreType = entry.workouts?.score_type || 'None'
        if (scoreType === 'None') return
        if (!byWorkout[wName]) byWorkout[wName] = { name: wName, scoreType, entries: [] }
        byWorkout[wName].entries.push({
          user: entry.profiles?.display_name || 'Anonymous',
          score: entry.score,
          date: entry.completed_at,
          userId: entry.user_id,
        })
      })
      // Only show workouts with 1+ entries that have real scores
      const boards = Object.values(byWorkout)
        .filter(b => b.entries.length >= 1)
        .map(b => {
          // Best per user
          const userBest = {}
          b.entries.forEach(e => {
            if (!userBest[e.userId] || (b.scoreType === 'Time' ? e.score < userBest[e.userId].score : e.score > userBest[e.userId].score)) {
              userBest[e.userId] = e
            }
          })
          const ranked = Object.values(userBest).sort((a, c) => b.scoreType === 'Time' ? a.score.localeCompare(c.score) : c.score.localeCompare(a.score))
          return { ...b, ranked }
        })
        .filter(b => b.ranked.length >= 1)
        .sort((a, b) => b.ranked.length - a.ranked.length)
        .slice(0, 10)
      setLeaderboard(boards)
    }
  }
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

      {leaderboard.length > 0 && (
        <div className="stat-panel">
          <h4>Leaderboard <span>(top scores across users)</span></h4>
          {leaderboard.map(b => (
            <div key={b.name} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginBottom: '4px' }}>
                {b.name} <span style={{ fontSize: '10px', color: 'var(--cyn)', fontWeight: 400 }}>{b.scoreType}</span>
              </div>
              {b.ranked.map((entry, i) => (
                <div key={i} className="stat-row">
                  <span style={{ width: '20px', color: i === 0 ? 'var(--ylw)' : 'var(--tx3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <span className="stat-key" style={{ flex: 1 }}>{entry.user}</span>
                  <span className="stat-val" style={{ color: i === 0 ? 'var(--grn)' : 'var(--tx)' }}>{entry.score}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
