import { useState } from 'react'

function FilterSection({ label, items, active, onToggle }) {
  const [open, setOpen] = useState(false)
  const n = active.length

  return (
    <div className="fsec">
      <div className="fhd" onClick={() => setOpen(!open)}>
        <span className={`ar${open ? '' : ' shut'}`}>▾</span>
        {label}
        {n > 0 && <span className="cn">{n}</span>}
      </div>
      {open && (
        <div className="fr">
          {items.map(i => (
            <button key={i} className={`fb${active.includes(i) ? ' on' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggle(i) }}>{i}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Filters({ filters, setFilters, allEquipment, allMovements, allCategories, allWorkoutTypes }) {
  function toggle(key, val) {
    setFilters(prev => {
      const arr = [...prev[key]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [key]: arr }
    })
  }

  return (
    <>
      <FilterSection label="Equipment" items={allEquipment} active={filters.eq} onToggle={v => toggle('eq', v)} />
      <FilterSection label="Movement Type" items={allMovements} active={filters.mv} onToggle={v => toggle('mv', v)} />
      <FilterSection label="Category" items={allCategories} active={filters.cat} onToggle={v => toggle('cat', v)} />
      <FilterSection label="Workout Type" items={allWorkoutTypes} active={filters.wt} onToggle={v => toggle('wt', v)} />
      <div className="dur-filter">
        <span className="dur-label">Duration:</span>
        <input type="number" className="dur-inp" placeholder="Min"
          value={filters.durMin ?? ''} onChange={e => setFilters(prev => ({ ...prev, durMin: e.target.value ? parseInt(e.target.value) : null }))} min="0" />
        <span className="dur-dash">–</span>
        <input type="number" className="dur-inp" placeholder="Max"
          value={filters.durMax ?? ''} onChange={e => setFilters(prev => ({ ...prev, durMax: e.target.value ? parseInt(e.target.value) : null }))} min="0" />
        <span className="dur-unit">min</span>
        {(filters.durMin != null || filters.durMax != null) && (
          <button className="dur-clr" onClick={() => setFilters(prev => ({ ...prev, durMin: null, durMax: null }))}>✕</button>
        )}
      </div>
    </>
  )
}
