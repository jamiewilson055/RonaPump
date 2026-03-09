import { useState } from 'react'

// States: null = not selected, 'include' = green/on, 'exclude' = red/excluded
function ExcludableFilterSection({ label, items, active, excluded, onToggle }) {
  const [open, setOpen] = useState(false)
  const nActive = active.length
  const nExcluded = excluded.length

  return (
    <div className="fsec">
      <div className="fhd" onClick={() => setOpen(!open)}>
        <span className={`ar${open ? '' : ' shut'}`}>▾</span>
        {label}
        {nActive > 0 && <span className="cn">{nActive}</span>}
        {nExcluded > 0 && <span className="cn ex">{nExcluded}✕</span>}
      </div>
      {open && (
        <>
          <div className="fr">
            {items.map(i => {
              const isIncluded = active.includes(i)
              const isExcluded = excluded.includes(i)
              return (
                <button key={i}
                  className={`fb${isIncluded ? ' on' : ''}${isExcluded ? ' ex' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggle(i) }}
                  title={isExcluded ? `Excluding ${i} — click to clear` : isIncluded ? `Including ${i} — click again to exclude` : `Click to include ${i}`}
                >
                  {isExcluded && <span style={{ marginRight: '3px' }}>✕</span>}
                  {i}
                </button>
              )
            })}
          </div>
          {(nActive > 0 || nExcluded > 0) && (
            <div style={{ padding: '0 10px 4px', fontSize: '10px', color: 'var(--tx3)' }}>
              Click = include • Click again = exclude • Click again = clear
            </div>
          )}
        </>
      )}
    </div>
  )
}

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

export default function Filters({ filters, setFilters, allEquipment, allMovements, allCategories, allWorkoutTypes, allBodyParts }) {
  function toggle(key, val) {
    setFilters(prev => {
      const arr = [...prev[key]]
      const idx = arr.indexOf(val)
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val)
      return { ...prev, [key]: arr }
    })
  }

  // Three-state toggle: not selected → include → exclude → not selected
  function toggleExcludable(includeKey, excludeKey, val) {
    setFilters(prev => {
      const inc = [...prev[includeKey]]
      const exc = [...prev[excludeKey]]
      const inIdx = inc.indexOf(val)
      const exIdx = exc.indexOf(val)

      if (inIdx >= 0) {
        // Currently included → move to excluded
        inc.splice(inIdx, 1)
        exc.push(val)
      } else if (exIdx >= 0) {
        // Currently excluded → clear
        exc.splice(exIdx, 1)
      } else {
        // Not selected → include
        inc.push(val)
      }
      return { ...prev, [includeKey]: inc, [excludeKey]: exc }
    })
  }

  return (
    <>
      {allBodyParts && allBodyParts.length > 0 && (
        <FilterSection label="Body Part" items={allBodyParts} active={filters.bp || []} onToggle={v => toggle('bp', v)} />
      )}
      <ExcludableFilterSection
        label="Equipment"
        items={allEquipment}
        active={filters.eq}
        excluded={filters.eqEx || []}
        onToggle={v => toggleExcludable('eq', 'eqEx', v)}
      />
      <ExcludableFilterSection
        label="Movement Type"
        items={allMovements}
        active={filters.mv}
        excluded={filters.mvEx || []}
        onToggle={v => toggleExcludable('mv', 'mvEx', v)}
      />
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
          <>
            <label className="dur-check">
              <input type="checkbox" checked={filters.includeNoDur !== false}
                onChange={e => setFilters(prev => ({ ...prev, includeNoDur: e.target.checked }))} />
              <span>Include unset</span>
            </label>
            <button className="dur-clr" onClick={() => setFilters(prev => ({ ...prev, durMin: null, durMax: null }))}>✕</button>
          </>
        )}
      </div>
    </>
  )
}
