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

// Parse a raw score string into a comparable number for its score type.
// Returns null when nothing parseable is found.
// - Time: "17:45" → seconds; "1:02:30" → seconds; bare "17" → minutes. Lower is better.
// - Rounds + Reps: "7 Rounds + 19 WBs + 2 Cals" → rounds dominate, remaining
//   numbers sum as a tiebreaker. Higher is better.
// - Everything else (Reps/Calories/Load/Distance): first number found. Higher is better.
export function parseScoreValue(score, scoreType) {
  if (!score) return null
  const s = String(score).trim()
  if (scoreType === 'Time') {
    const t = s.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/)
    if (t) {
      if (t[3] !== undefined) return (+t[1]) * 3600 + (+t[2]) * 60 + (+t[3])
      return (+t[1]) * 60 + (+t[2])
    }
    const n = s.match(/\d+(?:\.\d+)?/)
    return n ? parseFloat(n[0]) * 60 : null
  }
  if (scoreType === 'Rounds + Reps') {
    const nums = s.match(/\d+(?:\.\d+)?/g)
    if (!nums) return null
    const rounds = parseFloat(nums[0])
    const reps = nums.slice(1).reduce((t, x) => t + parseFloat(x), 0)
    return rounds * 100000 + reps
  }
  const n = s.match(/\d+(?:\.\d+)?/)
  return n ? parseFloat(n[0]) : null
}

// Leaderboard comparator for performance_log entries.
// Order: Rx ALWAYS above Scaled → better score → scoreless entries last →
// ties broken by earliest date (first to post the score ranks higher).
export function compareLogs(a, b, scoreType) {
  const aRx = a.is_rx !== false
  const bRx = b.is_rx !== false
  if (aRx !== bRx) return aRx ? -1 : 1
  const av = parseScoreValue(a.score, scoreType)
  const bv = parseScoreValue(b.score, scoreType)
  if (av === null && bv === null) return (b.completed_at || '').localeCompare(a.completed_at || '')
  if (av === null) return 1
  if (bv === null) return -1
  if (av !== bv) return scoreType === 'Time' ? av - bv : bv - av
  return (a.completed_at || '9999').localeCompare(b.completed_at || '9999')
}

// Best score on the board = the top-ranked entry (Rx beats Scaled, proper
// numeric comparison). Used for the card-header badge and the ★ marker.
export function bestScore(w) {
  const pl = (w.performance_log || []).filter(e => e.score)
  if (!pl.length) return null
  const sorted = [...pl].sort((a, b) => compareLogs(a, b, w.score_type))
  return sorted[0].score
}
