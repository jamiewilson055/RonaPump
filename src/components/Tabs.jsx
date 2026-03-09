export default function Tabs({ tab, setTab, counts, prsCount, collectionsCount }) {
  const tabs = [
    { key: 'all', label: 'All', short: 'All', count: counts.total },
    { key: 'done', label: 'Completed', short: 'Done', count: counts.done },
    { key: 'queue', label: 'Queue', short: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', short: 'Favs', count: counts.favs },
    { key: 'prs', label: 'PRs', short: 'PRs', count: prsCount },
    { key: 'collections', label: 'Collections', short: '📁', count: collectionsCount || null },
    { key: 'stats', label: 'Stats', short: 'Stats', count: null },
  ]

  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.key} className={`tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
          <span className="tab-full">{t.label}</span>
          <span className="tab-short">{t.short}</span>
          {t.count != null && <i>{t.count}</i>}
        </button>
      ))}
    </div>
  )
}
