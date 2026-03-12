export default function Tabs({ tab, setTab, counts, prsCount, collectionsCount, hideMainOnMobile }) {
  const mainTabs = [
    { key: 'all', label: 'All', short: 'All', count: counts.total },
    { key: 'done', label: 'Completed', short: 'Done', count: counts.done },
    { key: 'queue', label: 'Queue', short: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', short: 'Favs', count: counts.favs },
  ]

  const secondaryTabs = [
    { key: 'deck', label: 'Deck', icon: '🃏', count: null },
    { key: 'ai', label: 'AI', icon: '🤖', count: null },
    { key: 'prs', label: 'PRs', icon: '🏆', count: prsCount },
    { key: 'h2h', label: 'H2H', icon: '⚔️', count: null },
    { key: 'activity', label: 'Activity', icon: '👥', count: null },
    { key: 'collections', label: 'Collections', icon: '📁', count: collectionsCount || null },
    { key: 'stats', label: 'Stats', icon: '📊', count: null },
  ]

  // Bottom nav: 3 items
  const bottomNavTabs = [
    { key: 'deck', label: 'Deck', icon: '🃏' },
    { key: 'ai', label: 'AI', icon: '🤖' },
    { key: 'prs', label: 'PRs', icon: '🏆' },
  ]

  const isSecondary = secondaryTabs.some(t => t.key === tab)

  return (
    <>
      <div className={`tabs${hideMainOnMobile ? ' mobile-hide' : ''}`}>
        {mainTabs.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            <span className="tab-full">{t.label}</span>
            <span className="tab-short">{t.short}</span>
            {t.count != null && <i>{t.count}</i>}
          </button>
        ))}
      </div>

      <div className="tabs-secondary">
        {secondaryTabs.map(t => (
          <button key={t.key} className={`tab-sec${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            <span className="tab-sec-icon">{t.icon}</span>
            <span className="tab-sec-label">{t.label}</span>
            {t.count != null && t.count > 0 && <i>{t.count}</i>}
          </button>
        ))}
      </div>

      <div className="bottom-nav">
        <button className={`bnav${!isSecondary ? ' on' : ''}`} onClick={() => setTab('all')}>
          <span>🏋</span><span>Workouts</span>
        </button>
        {bottomNavTabs.map(t => (
          <button key={t.key} className={`bnav${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
