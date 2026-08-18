// First-visit hero for signed-out visitors (mobile-first).
// The pitch is compact on purpose: headline → live proof → one primary CTA,
// with a no-signup path ("Try today's WOD") that scrolls straight to the WOD card,
// since the first 5 workout previews are free before the signup gate kicks in.
export default function Welcome({ onSignIn, workouts = [] }) {
  const totalWorkouts = workouts.filter(w => w.visibility !== 'private').length
  const totalResults = workouts.reduce((t, w) => t + (w.performance_log?.length || 0), 0)

  function scrollToWod() {
    const el = document.querySelector('.wod-card') || document.querySelector('.wc')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="hero-v2">
      <div className="hero-kicker">🦍 The @ronapump community gym</div>
      <h1 className="hero-title">Show up. Log it.<br /><b>Top the leaderboard.</b></h1>
      <p className="hero-sub">Functional workouts scored by the community — every result you log lands on a real leaderboard. Free.</p>
      <div className="hero-stats">
        <div className="hero-stat"><b>{totalWorkouts > 0 ? totalWorkouts : '800+'}</b><span>workouts</span></div>
        <div className="hero-stat"><b>{totalResults > 0 ? totalResults : '500+'}</b><span>results logged</span></div>
        <div className="hero-stat"><b>Daily</b><span>WOD + email</span></div>
      </div>
      <div className="hero-ctas">
        <button className="hero-cta-main" onClick={onSignIn}>Join Free</button>
        <button className="hero-cta-ghost" onClick={scrollToWod}>Try today's WOD ↓</button>
      </div>
      <a className="hero-ig" href="https://www.instagram.com/ronapump/" target="_blank" rel="noopener noreferrer">📸 Follow @ronapump</a>
    </div>
  )
}
