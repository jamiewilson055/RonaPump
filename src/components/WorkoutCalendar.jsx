import { useState, useMemo } from 'react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function WorkoutCalendar({ workouts, session }) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Build map of date -> logs
  const logsByDate = useMemo(() => {
    const map = {}
    if (!session) return map
    workouts.forEach(w => {
      (w.performance_log || []).forEach(p => {
        if (p.user_id === session.user.id && p.completed_at) {
          if (!map[p.completed_at]) map[p.completed_at] = []
          map[p.completed_at].push({ workoutName: w.name || 'Unnamed', score: p.score, notes: p.notes, is_rx: p.is_rx })
        }
      })
    })
    return map
  }, [workouts, session])

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  const selectedLogs = selectedDate ? (logsByDate[selectedDate] || []) : []

  // Streak calculation
  const streak = useMemo(() => {
    let s = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const ds = new Date(d)
      ds.setDate(ds.getDate() - i)
      const key = ds.toISOString().slice(0, 10)
      if (logsByDate[key]) s++
      else if (i > 0) break
      else continue
    }
    return s
  }, [logsByDate])

  // Month stats
  const monthLogs = useMemo(() => {
    let count = 0
    let days = new Set()
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(d)
      if (logsByDate[ds]) {
        count += logsByDate[ds].length
        days.add(ds)
      }
    }
    return { count, days: days.size }
  }, [logsByDate, year, month, daysInMonth])

  return (
    <div className="cal-wrap">
      <div className="cal-top">
        <div className="cal-streak">
          {streak > 0 && <span>🔥 {streak} day streak</span>}
        </div>
        <div className="cal-month-stats">
          {monthLogs.days} days · {monthLogs.count} workouts this month
        </div>
      </div>

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-title">{MONTHS[month]} {year}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-grid">
        {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="cal-cell empty"></div>
          const ds = dateStr(d)
          const hasLogs = !!logsByDate[ds]
          const logCount = logsByDate[ds]?.length || 0
          const isToday = ds === today
          const isSelected = ds === selectedDate
          return (
            <div
              key={ds}
              className={`cal-cell${hasLogs ? ' active' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => setSelectedDate(isSelected ? null : ds)}
            >
              <span className="cal-cell-num">{d}</span>
              {hasLogs && <span className="cal-cell-dot">{logCount > 1 ? logCount : '•'}</span>}
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <div className="cal-detail">
          <div className="cal-detail-date">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {selectedLogs.length === 0 ? (
            <div className="cal-detail-empty">No workouts logged</div>
          ) : (
            selectedLogs.map((l, i) => (
              <div key={i} className="cal-detail-item">
                <div className="cal-detail-name">{l.workoutName}</div>
                <div className="cal-detail-score">
                  {l.score || '✓ Completed'}
                  {l.is_rx === true && l.score && <span className="rx-tag">Rx</span>}
                  {l.is_rx === false && <span className="scaled-tag">Scaled</span>}
                </div>
                {l.notes && l.notes !== 'Quick logged' && <div className="cal-detail-notes">{l.notes}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
