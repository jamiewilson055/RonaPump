export default function Tabs({ tab, setTab, counts, prsCount, collectionsCount, hideMainOnMobile, onTimerClick }) {
  const mainTabs = [
    { key: 'all', label: 'All', short: 'All', count: counts.total },
    { key: 'done', label: 'Completed', short: 'Done', count: counts.done },
    { key: 'queue', label: 'Queue', short: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', short: 'Favs', count: counts.favs },
    { key: 'collections', label: 'Collections', short: 'Colls', count: collectionsCount },
  ]

  const isWorkoutsTab = ['all', 'done', 'queue', 'favs', 'collections'].includes(tab)
  const isWodTab = ['train', 'ai', 'ai-coach', 'deck', 'timer'].includes(tab)
  const isProgressTab = ['track', 'longevity', 'prs', 'stats'].includes(tab)
  const isCommunityTab = ['social', 'activity', 'h2h'].includes(tab)

  // The four primary sections — shared by mobile bottom nav and desktop top nav
  const sections = [
    { key: 'workouts', icon: '🏋', label: 'Workouts', on: isWorkoutsTab, go: () => setTab('all') },
    { key: 'getwod', icon: '🤖', label: 'Get a WOD', on: isWodTab, go: () => setTab('ai') },
    { key: 'progress', icon: '📊', label: 'Progress', on: isProgressTab, go: () => setTab('stats') },
    { key: 'community', icon: '👥', label: 'Community', on: isCommunityTab, go: () => setTab('activity') },
  ]

  return (
    <>
      {/* Desktop section nav — replaces the old sidebar Train/Track/Social grid */}
      <div className="section-nav desktop-only">
        {sections.map(s => (
          <button key={s.key} className={`section-nav-btn${s.on ? ' on' : ''}`} onClick={s.go}>
            <span className="section-nav-ic">{s.icon}</span>{s.label}
          </button>
        ))}
        {onTimerClick && (
          <button className="section-nav-btn section-nav-timer" onClick={onTimerClick} title="Floating timer — keeps running while you browse">
            <span className="section-nav-ic">⏱</span>Timer
          </button>
        )}
      </div>

      <div className={`tabs${hideMainOnMobile ? ' mobile-hide' : ''}`}>
        {mainTabs.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            <span className="tab-full">{t.label}</span>
            <span className="tab-short">{t.short}</span>
            {t.count != null && <i>{t.count}</i>}
          </button>
        ))}
      </div>

      <div className="bottom-nav">
        {sections.map(s => (
          <button key={s.key} className={`bnav${s.on ? ' on' : ''}`} onClick={s.go}>
            <span>{s.icon}</span><span>{s.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
