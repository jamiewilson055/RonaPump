import { useState, useMemo } from 'react'
import Filters from '../components/Filters'
import WorkoutCard from '../components/WorkoutCard'
import NewWorkoutModal from '../components/NewWorkoutModal'

const PP = 30

export default function WorkoutList({ workouts, tab, favorites, toggleFavorite, session, isAdmin, onAuthRequired, onWorkoutsChanged, collections, onCollectionsChanged }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('added')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    eq: [], eqEx: [], mv: [], mvEx: [], cat: [], wt: [], bp: [],
    durMin: null, durMax: null, includeNoDur: true
  })
  const [sourceFilter, setSourceFilter] = useState('all') // all, official, community, mine
  const [showNewModal, setShowNewModal] = useState(false)

  const allEquipment = useMemo(() => [...new Set(workouts.flatMap(w => w.equipment || []))].sort(), [workouts])
  const allMovements = useMemo(() => [...new Set(workouts.flatMap(w => w.movement_categories || []))].sort(), [workouts])
  const allCategories = useMemo(() => [...new Set(workouts.flatMap(w => w.categories || []))].sort(), [workouts])
  const allWorkoutTypes = useMemo(() => [...new Set(workouts.flatMap(w => w.workout_types || []))].sort(), [workouts])
  const allBodyParts = useMemo(() => [...new Set(workouts.flatMap(w => w.body_parts || []))].sort(), [workouts])

  const filtered = useMemo(() => {
    let w = [...workouts]

    if (tab === 'done') w = w.filter(x => x.my_log_count > 0)
    else if (tab === 'queue') w = w.filter(x => !x.my_log_count || x.my_log_count === 0)
    else if (tab === 'favs') w = w.filter(x => favorites.has(x.id))

    // Source filter
    if (sourceFilter === 'official') w = w.filter(x => x.visibility === 'official')
    else if (sourceFilter === 'community') w = w.filter(x => x.visibility === 'community')
    else if (sourceFilter === 'mine') w = w.filter(x => x.created_by === session?.user?.id)

    if (query) {
      const q = query.toLowerCase()
      w = w.filter(x =>
        (x.name && x.name.toLowerCase().includes(q)) ||
        x.description.toLowerCase().includes(q) ||
        x.equipment?.some(e => e.toLowerCase().includes(q)) ||
        x.movement_categories?.some(m => m.toLowerCase().includes(q)) ||
        x.categories?.some(c => c.toLowerCase().includes(q)) ||
        x.workout_types?.some(t => t.toLowerCase().includes(q)) ||
        x.body_parts?.some(b => b.toLowerCase().includes(q))
      )
    }

    // Include filters (AND)
    if (filters.eq.length) w = w.filter(x => filters.eq.every(f => x.equipment?.includes(f)))
    if (filters.mv.length) w = w.filter(x => filters.mv.every(f => x.movement_categories?.includes(f)))
    if (filters.cat.length) w = w.filter(x => filters.cat.every(f => x.categories?.includes(f)))
    if (filters.wt.length) w = w.filter(x => filters.wt.every(f => x.workout_types?.includes(f)))
    if (filters.bp?.length) w = w.filter(x => filters.bp.every(f => x.body_parts?.includes(f)))

    // Exclude filters
    if (filters.eqEx?.length) w = w.filter(x => !filters.eqEx.some(f => x.equipment?.includes(f)))
    if (filters.mvEx?.length) w = w.filter(x => !filters.mvEx.some(f => x.movement_categories?.includes(f)))

    // Duration
    if (filters.durMin != null || filters.durMax != null) {
      const includeNoDur = filters.includeNoDur !== false
      w = w.filter(x => {
        const exact = x.estimated_duration_mins
        const rangeMin = x.estimated_duration_min
        const rangeMax = x.estimated_duration_max
        const hasAnyDur = exact || (rangeMin && rangeMax)
        if (!hasAnyDur) return includeNoDur
        if (exact) {
          if (filters.durMin != null && exact < filters.durMin) return false
          if (filters.durMax != null && exact > filters.durMax) return false
          return true
        }
        if (rangeMin && rangeMax) {
          if (filters.durMax != null && rangeMin > filters.durMax) return false
          if (filters.durMin != null && rangeMax < filters.durMin) return false
          return true
        }
        return includeNoDur
      })
    }

    if (sort === 'added') w.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    else if (sort === 'newest') w.sort((a, b) => (b.original_date || '').localeCompare(a.original_date || ''))
    else if (sort === 'oldest') w.sort((a, b) => (a.original_date || '9999').localeCompare(b.original_date || '9999'))
    else if (sort === 'name') w.sort((a, b) => (a.name || 'zzz').localeCompare(b.name || 'zzz'))
    else if (sort === 'dur_s') w.sort((a, b) => (a.estimated_duration_mins || 999) - (b.estimated_duration_mins || 999))
    else if (sort === 'dur_l') w.sort((a, b) => (b.estimated_duration_mins || 0) - (a.estimated_duration_mins || 0))

    return w
  }, [workouts, tab, query, filters, sort, favorites, sourceFilter, session])

  const totalPages = Math.ceil(filtered.length / PP)
  const items = filtered.slice((page - 1) * PP, page * PP)

  const hasFilters = filters.eq.length || filters.eqEx?.length || filters.mv.length || filters.mvEx?.length || filters.cat.length || filters.wt.length || filters.bp?.length || filters.durMin != null || filters.durMax != null

  function clearFilters() {
    setFilters({ eq: [], eqEx: [], mv: [], mvEx: [], cat: [], wt: [], bp: [], durMin: null, durMax: null, includeNoDur: true })
    setQuery('')
    setPage(1)
  }

  function randomWorkout() {
    if (!filtered.length) return
    const pick = filtered[Math.floor(Math.random() * filtered.length)]
    const idx = filtered.indexOf(pick)
    setPage(Math.floor(idx / PP) + 1)
    setTimeout(() => {
      const el = document.getElementById('wc-' + pick.id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  // Find similar workouts to a given workout
  function getSimilar(workout) {
    if (!workout) return []
    return workouts
      .filter(w => w.id !== workout.id)
      .map(w => {
        let score = 0
        // Shared equipment
        const sharedEq = (w.equipment || []).filter(e => workout.equipment?.includes(e)).length
        score += sharedEq * 2
        // Shared movements
        const sharedMv = (w.movement_categories || []).filter(m => workout.movement_categories?.includes(m)).length
        score += sharedMv * 3
        // Shared workout type
        const sharedWt = (w.workout_types || []).filter(t => workout.workout_types?.includes(t)).length
        score += sharedWt * 2
        // Similar duration
        if (w.estimated_duration_mins && workout.estimated_duration_mins) {
          const diff = Math.abs(w.estimated_duration_mins - workout.estimated_duration_mins)
          if (diff <= 5) score += 3
          else if (diff <= 10) score += 1
        }
        // Shared body parts
        const sharedBp = (w.body_parts || []).filter(b => workout.body_parts?.includes(b)).length
        score += sharedBp
        return { ...w, similarityScore: score }
      })
      .filter(w => w.similarityScore > 3)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 3)
  }

  return (
    <>
      <div className="srow">
        <div className="sbox">
          <input type="text" placeholder="Search by name, movement, equipment, keyword..." value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }} />
          {query && <button className="sbox-clear" onClick={() => { setQuery(''); setPage(1) }}>✕</button>}
        </div>
        <button className="rbtn" onClick={randomWorkout} title="Random workout">🎲</button>
        {session && <button className="nbtn" onClick={() => setShowNewModal(true)}>+ New Workout</button>}
      </div>

      {showNewModal && <NewWorkoutModal onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); onWorkoutsChanged() }} session={session} isAdmin={isAdmin} />}

      <Filters
        filters={filters}
        setFilters={(f) => { setFilters(typeof f === 'function' ? f(filters) : f); setPage(1) }}
        allEquipment={allEquipment}
        allMovements={allMovements}
        allCategories={allCategories}
        allWorkoutTypes={allWorkoutTypes}
        allBodyParts={allBodyParts}
      />

      <div className="source-filter">
        <button className={`sf-btn${sourceFilter === 'all' ? ' on' : ''}`} onClick={() => { setSourceFilter('all'); setPage(1) }}>All</button>
        <button className={`sf-btn${sourceFilter === 'official' ? ' on' : ''}`} onClick={() => { setSourceFilter('official'); setPage(1) }}>🦍 Official</button>
        <button className={`sf-btn${sourceFilter === 'community' ? ' on' : ''}`} onClick={() => { setSourceFilter('community'); setPage(1) }}>👤 Community</button>
        {session && <button className={`sf-btn${sourceFilter === 'mine' ? ' on' : ''}`} onClick={() => { setSourceFilter('mine'); setPage(1) }}>🔒 My Workouts</button>}
      </div>

      <div className="rbar">
        <span className="rcnt">
          {filtered.length} workout{filtered.length !== 1 ? 's' : ''}
          {hasFilters && <span className="clr" onClick={clearFilters}>clear filters</span>}
        </span>
        <select className="ssel" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="added">Recently Added</option>
          <option value="newest">Newest (by date)</option>
          <option value="oldest">Oldest (by date)</option>
          <option value="name">By name</option>
          <option value="dur_s">Duration ↑</option>
          <option value="dur_l">Duration ↓</option>
        </select>
      </div>

      <div className="wl">
        {items.map(w => (
          <WorkoutCard
            key={w.id}
            workout={w}
            isFav={favorites.has(w.id)}
            toggleFavorite={toggleFavorite}
            session={session}
            isAdmin={isAdmin}
            onAuthRequired={onAuthRequired}
            onWorkoutsChanged={onWorkoutsChanged}
            getSimilar={getSimilar}
            collections={collections}
            onCollectionsChanged={onCollectionsChanged}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pgr">
          {page > 1 && <button className="pg" onClick={() => { setPage(page - 1); window.scrollTo(0, 250) }}>←</button>}
          {Array.from({ length: Math.min(9, totalPages) }, (_, i) => {
            let p
            if (totalPages <= 9) p = i + 1
            else if (page <= 5) p = i + 1
            else if (page >= totalPages - 4) p = totalPages - 8 + i
            else p = page - 4 + i
            return <button key={p} className={`pg${page === p ? ' cur' : ''}`} onClick={() => { setPage(p); window.scrollTo(0, 250) }}>{p}</button>
          })}
          {page < totalPages && <button className="pg" onClick={() => { setPage(page + 1); window.scrollTo(0, 250) }}>→</button>}
        </div>
      )}
    </>
  )
}
