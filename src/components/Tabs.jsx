export default function Tabs({ tab, setTab, counts, prsCount, collectionsCount, hideMainOnMobile }) {
  const mainTabs = [
    { key: 'all', label: 'All', short: 'All', count: counts.total },
    { key: 'done', label: 'Completed', short: 'Done', count: counts.done },
    { key: 'queue', label: 'Queue', short: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', short: 'Favs', count: counts.favs },
  ]

  // Bottom nav: 3 items
  const bottomNavTabs = [
    { key: 'longevity', label: 'Longevity', icon: '🧬' },
    { key: 'ai', label: 'AI', icon: '🤖' },
    { key: 'prs', label: 'Strength', icon: '💪' },
  ]

  const featureTabs = ['deck', 'ai', 'timer', 'longevity', 'prs', 'activity', 'stats', 'collections']
  const isSecondary = featureTabs.includes(tab)

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
