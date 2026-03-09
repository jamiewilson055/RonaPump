export default function Header({ counts, session, profile, onAuthClick }) {
  return (
    <div className="hdr">
      <div>
        <div className="logo"><b>RONA</b>PUMP</div>
        <div style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '1px' }}>Workout Explorer</div>
      </div>
      <div className="hdr-r">
        <div className="hs"><div className="hs-n">{counts.total}</div><div className="hs-l">Workouts</div></div>
        <div className="hs"><div className="hs-n">{counts.done}</div><div className="hs-l">Done</div></div>
        <div className="hs"><div className="hs-n">{counts.queue}</div><div className="hs-l">Queue</div></div>
        <div className="hs"><div className="hs-n">{counts.favs}</div><div className="hs-l">Favs</div></div>
        {session ? (
          <button className="user-btn" onClick={onAuthClick}>
            {profile?.avatar_url && <img src={profile.avatar_url} className="user-avatar-sm" alt="" />}
            {profile?.display_name || 'Profile'}
          </button>
        ) : (
          <button className="user-btn" onClick={onAuthClick}>Sign In</button>
        )}
      </div>
    </div>
  )
}
