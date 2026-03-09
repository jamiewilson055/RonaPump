export default function Tabs({ tab, setTab, counts, prsCount }) {
  const tabs = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'done', label: 'Completed', count: counts.done },
    { key: 'queue', label: 'Queue', count: counts.queue },
    { key: 'favs', label: 'Favorites', count: counts.favs },
    { key: 'prs', label: 'PRs', count: prsCount },
    { key: 'stats', label: 'Stats', count: null },
  ]

  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.key} className={`tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
          {t.label}{t.count != null && <i>{t.count}</i>}
        </button>
      ))}
    </div>
  )
}
