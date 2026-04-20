// src/lib/workoutFormat.jsx
// Shared helpers for workout description rendering and scoring.
// Used by WorkoutCard, WODCard, WorkoutPage, and any other surface that
// displays workout descriptions. DO NOT duplicate these functions elsewhere.

export function renderBold(str) {
  const parts = str.split(/\*\*(.*?)\*\*/)
  if (parts.length === 1) return str
  return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
}

export function formatDesc(text) {
  return (text || '').split('\n').map((line, i) => {
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{renderBold(line.slice(4))}</div>
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
    if (line.startsWith('--- ')) return <div key={i} className="desc-section">{renderBold(line.slice(4))}</div>
    // Lines ending with ':' (optionally wrapped in **bold**) become section headers,
    // with the trailing colon stripped and no top border (distinguishes from --- sections).
    const trimmed = line.trim()
    if (trimmed.endsWith(':**') && trimmed.length > 3) {
      return <div key={i} className="desc-section" style={{ borderTop: 'none', paddingTop: 0 }}>{renderBold(trimmed.slice(0, -3) + '**')}</div>
    }
    if (trimmed.endsWith(':') && trimmed.length > 1) {
      return <div key={i} className="desc-section" style={{ borderTop: 'none', paddingTop: 0 }}>{renderBold(trimmed.slice(0, -1))}</div>
    }
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{renderBold(line)}</div>
  })
}

export function cleanDesc(w) {
  let d = w.description || ''
  if (w.name) {
    const nm = w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const p1 = new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi')
    d = d.replace(p1, '')
    // Strip a single leading separator '-' or ':' but NOT the first dash of '---' (section marker).
    d = d.replace(/^\s*[\n\r]+/, '').replace(/^\s*[-:](?!-)\s*/, '')
  }
  d = d.replace(/[\{\}]/g, '').trim()
  return d
}

export function bestScore(w) {
  const pl = w.performance_log || []
  if (!pl.length) return null
  if (w.score_type === 'Time') {
    return pl.reduce((b, e) => (!b || (e.score && e.score < b)) ? e.score : b, null)
  }
  return pl.reduce((b, e) => (!b || (e.score && e.score > b)) ? e.score : b, null)
}
