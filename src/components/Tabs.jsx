export default function Tabs({ tab, setTab, counts, prsCount, collectionsCount, hideMainOnMobile }) {
  const mainTabs = [
    { key: 'all', label: 'All', short: 'All', count: counts.total },
    { key: 'done', label: 'Completed', short: 'Done', count: counts.done },
    { key: 'queue', label: 'Queue', short: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', short: 'Favs', count: counts.favs },
  ]

  const isWorkoutsTab = ['all', 'done', 'queue', 'favs'].includes(tab)
  const isTrainTab = ['train', 'ai', 'deck', 'timer'].includes(tab)
  const isTrackTab = ['track', 'longevity', 'prs', 'stats', 'collections'].includes(tab)
  const isSocialTab = ['social', 'activity', 'h2h'].includes(tab)

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
        <button className={`bnav${isWorkoutsTab ? ' on' : ''}`} onClick={() => setTab('all')}>
          <span>🏋</span><span>Workouts</span>
        </button>
        <button className={`bnav${isTrainTab ? ' on' : ''}`} onClick={() => setTab('ai-coach')}>
          <span>⚡</span><span>Train</span>
        </button>
        <button className={`bnav${isTrackTab ? ' on' : ''}`} onClick={() => setTab('stats')}>
          <span>📊</span><span>Track</span>
        </button>
        <button className={`bnav${isSocialTab ? ' on' : ''}`} onClick={() => setTab('activity')}>
          <span>👥</span><span>Social</span>
        </button>
      </div>
    </>
  )
}
