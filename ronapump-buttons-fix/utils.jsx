// src/utils.jsx — Shared utilities for RonaPump
// Single source of truth for slug generation, description formatting, and clipboard

// Generate URL slug from workout name
export function toSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Render markdown-like workout descriptions to JSX
// Supports: bullets (•), sub-bullets (  •), sections (---), bold (**text**)
export function formatDesc(text) {
  function renderBold(str) {
    const parts = str.split(/\*\*(.*?)\*\*/)
    if (parts.length === 1) return str
    return parts.map((part, i) => i % 2 === 1 ? <b key={i}>{part}</b> : part)
  }
  return (text || '').split('\n').map((line, i) => {
    if (line.startsWith('  • ')) return <div key={i} className="desc-li sub">{renderBold(line.slice(4))}</div>
    if (line.startsWith('• ')) return <div key={i} className="desc-li">{renderBold(line.slice(2))}</div>
    if (line.startsWith('--- ')) return <div key={i} className="desc-section">{renderBold(line.slice(4))}</div>
    if (line.trim() === '') return <br key={i} />
    return <div key={i}>{renderBold(line)}</div>
  })
}

// Clipboard copy with mobile fallback
// Returns true on success, false on failure
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for mobile browsers where clipboard API fails
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(ta)
    }
  }
}
