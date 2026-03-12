import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'

const MILESTONES = [
  { count: 10, label: '10 🔥', color: '#ff9500' },
  { count: 25, label: '25 💪', color: '#ff6b00' },
  { count: 50, label: '50 ⚡', color: '#ff2d2d' },
  { count: 100, label: '100 🦍', color: '#ff2d2d' },
  { count: 200, label: '200 👑', color: '#ffd700' },
  { count: 365, label: '365 🏆', color: '#ffd700' },
  { count: 500, label: '500 💎', color: '#00d4ff' },
]

function getNextMilestone(total) {
  return MILESTONES.find(m => m.count > total) || null
}

function getCurrentMilestone(total) {
  let current = null
  for (const m of MILESTONES) {
    if (total >= m.count) current = m
  }
  return current
}

export default function Header({ counts, session, profile, onAuthClick, streak, totalCompleted, onLogoClick, onStatsClick, onActivityClick, onH2HClick, onCollectionsClick, onNotifNavigate }) {
  const currentMs = getCurrentMilestone(totalCompleted || 0)
  const nextMs = getNextMilestone(totalCompleted || 0)

  return (
    <div className="hdr">
      <div className="hdr-left">
        <div className="logo-row" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
          <img src="/harambe.png" alt="Harambe" className="harambe-img" />
          <div>
            <div className="logo"><b>RONA</b>PUMP</div>
            <div className="hdr-sub">
              <span>Workout Explorer</span>
              <a href="https://www.instagram.com/ronapump/" target="_blank" rel="noopener noreferrer" className="ig-link" title="@ronapump on Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                <span className="ig-handle">@ronapump</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="hdr-r">
        {session && (
          <button className="stats-btn" onClick={onStatsClick} title="Stats & Streaks">
            📊{streak > 0 && <span className="stats-streak">🔥{streak}</span>}
          </button>
        )}
        <div className="hs"><div className="hs-n">{counts.total}</div><div className="hs-l">Workouts</div></div>
        <div className="hs"><div className="hs-n">{counts.done}</div><div className="hs-l">Done</div></div>
        <div className="hs"><div className="hs-n">{counts.queue}</div><div className="hs-l">Queue</div></div>
        <ThemeToggle />
        {session && <NotificationBell session={session} onNavigate={onNotifNavigate} />}
        {session ? (
          <div className="hdr-user-group">
            <button className="user-btn" onClick={onAuthClick}>
              {profile?.display_name || 'Profile'}
            </button>
            <button className="stats-btn activity-btn" onClick={onActivityClick} title="Activity Feed">
              👥
            </button>
            <button className="stats-btn activity-btn" onClick={onH2HClick} title="Head-to-Head">
              ⚔️
            </button>
            <button className="stats-btn activity-btn" onClick={onCollectionsClick} title="Collections">
              📁
            </button>
          </div>
        ) : (
          <button className="user-btn" onClick={onAuthClick}>Sign In</button>
        )}
      </div>
    </div>
  )
}
