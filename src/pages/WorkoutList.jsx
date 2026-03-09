import { useState, useMemo } from 'react'
import Filters from '../components/Filters'
import WorkoutCard from '../components/WorkoutCard'
import NewWorkoutModal from '../components/NewWorkoutModal'

const PP = 30 // per page

export default function WorkoutList({ workouts, tab, favorites, toggleFavorite, session, isAdmin, onAuthRequired, onWorkoutsChanged }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ eq: [], mv: [], cat: [], wt: [], durMin: null, durMax: null })
  const [showNewModal, setShowNewModal] = useState(false)

  // Extract all unique filter values
  const allEquipment = useMemo(() => [...new Set(workouts.flatMap(w => w.equipment || []))].sort(), [workouts])
  const allMovements = useMemo(() => [...new Set(workouts.flatMap(w => w.movement_categories || []))].sort(), [workouts])
  const allCategories = useMemo(() => [...new Set(workouts.flatMap(w => w.categories || []))].sort(), [workouts])
  const allWorkoutTypes = useMemo(() => [...new Set(workouts.flatMap(w => w.workout_types || []))].sort(), [workouts])

  const filtered = useMemo(() => {
    let w = [...workouts]

    // Tab filter
    if (tab === 'done') w = w.filter(x => x.performance_log && x.performance_log.length > 0)
    else if (tab === 'queue') w = w.filter(x => !x.performance_log || x.performance_log.length === 0)
    else if (tab === 'favs') w = w.filter(x => favorites.has(x.id))

    // Search (name, description, equipment, movements, categories, workout types)
    if (query) {
      const q = query.toLowerCase()
      w = w.filter(x =>
        (x.name && x.name.toLowerCase().includes(q)) ||
        x.description.toLowerCase().includes(q) ||
        x.equipment?.some(e => e.toLowerCase().includes(q)) ||
        x.movement_categories?.some(m => m.toLowerCase().includes(q)) ||
        x.categories?.some(c => c.toLowerCase().includes(q)) ||
        x.workout_types?.some(t => t.toLowerCase().includes(q))
      )
    }

    // Filters (AND logic)
    if (filters.eq.length) w = w.filter(x => filters.eq.every(f => x.equipment?.includes(f)))
    if (filters.mv.length) w = w.filter(x => filters.mv.every(f => x.movement_categories?.includes(f)))
    if (filters.cat.length) w = w.filter(x => filters.cat.every(f => x.categories?.includes(f)))
    if (filters.wt.length) w = w.filter(x => filters.wt.every(f => x.workout_types?.includes(f)))
    if (filters.durMin != null || filters.durMax != null) {
      const includeNoDur = filters.includeNoDur !== false
      w = w.filter(x => {
        const exact = x.estimated_duration_mins
        const rangeMin = x.estimated_duration_min
        const rangeMax = x.estimated_duration_max
        const hasAnyDur = exact || (rangeMin && rangeMax)
        if (!hasAnyDur) return includeNoDur
        // Check exact duration
        if (exact) {
          if (filters.durMin != null && exact < filters.durMin) return false
          if (filters.durMax != null && exact > filters.durMax) return false
          return true
        }
        // Check range overlap: workout range overlaps with filter range
        if (rangeMin && rangeMax) {
          if (filters.durMax != null && rangeMin > filters.durMax) return false
          if (filters.durMin != null && rangeMax < filters.durMin) return false
          return true
        }
        return includeNoDur
        return true
      })
    }

    // Sort
    if (sort === 'newest') w.sort((a, b) => (b.original_date || '').localeCompare(a.original_date || ''))
    else if (sort === 'oldest') w.sort((a, b) => (a.original_date || '9999').localeCompare(b.original_date || '9999'))
    else if (sort === 'name') w.sort((a, b) => (a.name || 'zzz').localeCompare(b.name || 'zzz'))
    else if (sort === 'dur_s') w.sort((a, b) => (a.estimated_duration_mins || 999) - (b.estimated_duration_mins || 999))
    else if (sort === 'dur_l') w.sort((a, b) => (b.estimated_duration_mins || 0) - (a.estimated_duration_mins || 0))

    return w
  }, [workouts, tab, query, filters, sort, favorites])

  const totalPages = Math.ceil(filtered.length / PP)
  const items = filtered.slice((page - 1) * PP, page * PP)

  const hasFilters = filters.eq.length || filters.mv.length || filters.cat.length || filters.wt.length || filters.durMin != null || filters.durMax != null

  function clearFilters() {
    setFilters({ eq: [], mv: [], cat: [], wt: [], durMin: null, durMax: null })
    setQuery('')
    setPage(1)
  }

  function randomWorkout() {
    if (!filtered.length) return
    const pick = filtered[Math.floor(Math.random() * filtered.length)]
    const idx = filtered.indexOf(pick)
    setPage(Math.floor(idx / PP) + 1)
    // Scroll handled by the card expanding
    setTimeout(() => {
      const el = document.getElementById('wc-' + pick.id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  return (
    <>
      <div className="srow">
        <div className="sbox">
          <input type="text" placeholder="Search by name, movement, keyword..." value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }} />
        </div>
        <button className="rbtn" onClick={randomWorkout} title="Random workout">🎲</button>
        {isAdmin && <button className="nbtn" onClick={() => setShowNewModal(true)}>+ New Workout</button>}
      </div>

      {showNewModal && <NewWorkoutModal onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); onWorkoutsChanged() }} />}

      <Filters filters={filters} setFilters={(f) => { setFilters(typeof f === 'function' ? f(filters) : f); setPage(1) }}
        allEquipment={allEquipment} allMovements={allMovements} allCategories={allCategories} allWorkoutTypes={allWorkoutTypes} />

      <div className="rbar">
        <span className="rcnt">
          {filtered.length} workout{filtered.length !== 1 ? 's' : ''}
          {hasFilters && <span className="clr" onClick={clearFilters}>clear filters</span>}
        </span>
        <select className="ssel" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">By name</option>
          <option value="dur_s">Duration ↑</option>
          <option value="dur_l">Duration ↓</option>
        </select>
      </div>

      <div className="wl">
        {items.map(w => (
          <WorkoutCard key={w.id} workout={w} isFav={favorites.has(w.id)} toggleFavorite={toggleFavorite}
            session={session} isAdmin={isAdmin} onAuthRequired={onAuthRequired} onWorkoutsChanged={onWorkoutsChanged} />
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
