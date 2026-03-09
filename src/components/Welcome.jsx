export default function Welcome({ onSignIn }) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-text">
          <h2>Welcome to <b>RonaPump</b> 🦍</h2>
          <p>Browse 790+ functional fitness workouts, track your scores, log PRs, and build custom collections. Sign in to start your journey.</p>
          <div className="welcome-features">
            <div className="wf-item"><span>🏋</span><span>790+ Workouts</span></div>
            <div className="wf-item"><span>⏱</span><span>Filter by Duration</span></div>
            <div className="wf-item"><span>🏆</span><span>Track PRs</span></div>
            <div className="wf-item"><span>📁</span><span>Build Collections</span></div>
            <div className="wf-item"><span>📊</span><span>Stats & Streaks</span></div>
            <div className="wf-item"><span>🎲</span><span>Random WOD</span></div>
          </div>
          <div className="welcome-actions">
            <button className="ab p" onClick={onSignIn} style={{ padding: '10px 24px', fontSize: '14px' }}>Sign In / Create Account</button>
            <a href="https://www.instagram.com/ronapump/" target="_blank" rel="noopener noreferrer" className="ab" style={{ padding: '10px 18px', fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>📸 @ronapump</a>
          </div>
        </div>
      </div>
    </div>
  )
}
