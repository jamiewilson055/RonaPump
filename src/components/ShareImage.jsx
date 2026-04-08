import { useRef, useState } from 'react'

export default function ShareImage({ workout, onClose }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const w = workout

  function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }

  function wrapLines(ctx, text, maxW) {
    const words = text.split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  function drawImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 1080, H = 1080
    canvas.width = W
    canvas.height = H

    const accent = '#e01e1e'
    const white = '#ffffff'
    const bg = '#0a0a0e'
    const px = 52
    const cw = W - px * 2

    // ── BACKGROUND ──
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle top-right glow
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 450)
    glow.addColorStop(0, hexA(accent, 0.05))
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    let y = 44

    // ── LOGO ROW ──
    ctx.font = '700 34px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = white
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', px, y)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', px + ronaW, y)

    ctx.font = '28px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('\u{1F98D}', W - px, y)

    // ── ACCENT DIVIDER ──
    y += 12
    const divGrad = ctx.createLinearGradient(px, 0, px + cw * 0.45, 0)
    divGrad.addColorStop(0, accent)
    divGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = divGrad
    ctx.beginPath()
    ctx.roundRect(px, y, cw, 4, 2)
    ctx.fill()

    // ── "WORKOUT OF THE DAY" LABEL ──
    y += 22
    ctx.font = '500 17px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = hexA(white, 0.28)
    ctx.letterSpacing = '3px'
    ctx.fillText('WORKOUT OF THE DAY', px, y)
    ctx.letterSpacing = '0px'

    // ── WORKOUT NAME ──
    y += 6
    ctx.font = '700 46px sans-serif'
    ctx.fillStyle = white
    ctx.textAlign = 'left'
    const nameLines = wrapLines(ctx, w.name || 'Unnamed Workout', cw)
    for (const nl of nameLines) {
      y += 46
      ctx.fillText(nl, px, y)
    }

    // ── TAGS ROW ──
    y += 14
    const tags = []
    if (w.score_type && w.score_type !== 'None') tags.push({ text: w.score_type, accent: true })
    const equip = (w.equipment || []).filter(e => e !== 'Bodyweight')
    equip.slice(0, 3).forEach(e => tags.push({ text: e }))
    if (w.estimated_duration_mins) tags.push({ text: w.estimated_duration_mins + ' min' })

    if (tags.length) {
      let tx = px
      const tagH = 26, tagPad = 12, tagGap = 6, tagFont = 18
      ctx.font = '600 ' + tagFont + 'px sans-serif'
      for (const tag of tags) {
        const tw = ctx.measureText(tag.text).width + tagPad * 2
        if (tx + tw > W - px) break

        ctx.fillStyle = tag.accent ? hexA(accent, 0.14) : hexA(white, 0.05)
        ctx.beginPath()
        ctx.roundRect(tx, y, tw, tagH, 13)
        ctx.fill()

        ctx.fillStyle = tag.accent ? accent : hexA(white, 0.4)
        ctx.font = (tag.accent ? '700 ' : '500 ') + tagFont + 'px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(tag.text, tx + tagPad, y + 19)
        tx += tw + tagGap
      }
      y += tagH + 12
    } else {
      y += 6
    }

    // ── FOOTER (reserve space) ──
    const footerH = 44
    const footerY = H - footerH

    ctx.fillStyle = hexA(white, 0.05)
    ctx.fillRect(px, footerY, cw, 1)

    ctx.font = '500 22px monospace'
    ctx.fillStyle = hexA(white, 0.4)
    ctx.textAlign = 'left'
    ctx.fillText('ronapump.com', px, footerY + 28)
    ctx.textAlign = 'right'
    ctx.fillText('@ronapump', W - px, footerY + 28)

    // ── DESCRIPTION ──
    const descTop = y
    const descBottom = footerY - 10
    const fadeH = 50

    // Clean the description
    let desc = w.description || ''
    if (w.name) {
      const nm = w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      desc = desc.replace(new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi'), '')
      desc = desc.replace(/^\s*[\n\r]+/, '').replace(/^\s*[-:]\s*/, '')
    }
    desc = desc.replace(/[\{\}]/g, '').trim()

    const rawLines = desc.split('\n')

    // Count effective lines to pick font size
    let effectiveLines = 0
    ctx.font = '28px sans-serif'
    for (const rl of rawLines) {
      const trimmed = rl.trim()
      if (trimmed === '') { effectiveLines += 0.4; continue }
      effectiveLines += wrapLines(ctx, trimmed, cw).length
    }

    let fontSize, lineH
    if (effectiveLines <= 10) { fontSize = 30; lineH = 40 }
    else if (effectiveLines <= 16) { fontSize = 27; lineH = 36 }
    else if (effectiveLines <= 22) { fontSize = 24; lineH = 32 }
    else { fontSize = 22; lineH = 30 }

    let dy = descTop
    let truncated = false

    for (const rl of rawLines) {
      if (truncated) break
      const trimmed = rl.trim()

      if (trimmed === '') { dy += lineH * 0.45; continue }

      // Section headers (--- PREFIX)
      if (trimmed.startsWith('--- ')) {
        dy += 4
        ctx.font = '700 ' + (fontSize - 2) + 'px sans-serif'
        ctx.fillStyle = hexA(accent, 0.65)
        ctx.textAlign = 'left'
        ctx.letterSpacing = '2px'
        const headerText = trimmed.slice(4).toUpperCase()
        if (dy + fontSize > descBottom - fadeH) { truncated = true; break }
        ctx.fillText(headerText, px, dy + fontSize)
        ctx.letterSpacing = '0px'
        dy += lineH + 2
        continue
      }

      // Detect labels
      const isLabel = /^[\w].*:$/.test(trimmed) || /^(Part [A-Z]|Round \d)/i.test(trimmed)

      // Bullet handling
      let text = trimmed
      let indent = 0
      if (text.startsWith('  \u2022 ') || text.startsWith('  - ')) {
        text = text.slice(4)
        indent = 28
      } else if (text.startsWith('\u2022 ') || text.startsWith('- ')) {
        text = text.slice(2)
        indent = 0
      }

      if (isLabel) {
        dy += 3
        ctx.font = '600 ' + fontSize + 'px sans-serif'
        ctx.fillStyle = white
      } else {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = hexA(white, 0.88)
      }

      ctx.textAlign = 'left'
      const bulletPrefix = (trimmed.startsWith('\u2022') || trimmed.startsWith('  \u2022') || trimmed.startsWith('-') || trimmed.startsWith('  -')) ? '\u2022  ' : ''
      const bpW = bulletPrefix ? ctx.measureText(bulletPrefix).width : 0
      const wrapped = wrapLines(ctx, text, cw - indent - bpW)

      for (let wi = 0; wi < wrapped.length; wi++) {
        if (dy + fontSize > descBottom - fadeH) { truncated = true; break }
        const prefix = (wi === 0 && bulletPrefix) ? bulletPrefix : (wi > 0 && bulletPrefix ? '    ' : '')
        ctx.fillText(prefix + wrapped[wi], px + indent, dy + fontSize)
        dy += lineH
      }
    }

    // Clean fade gradient if truncated
    if (truncated) {
      const fadeGrad = ctx.createLinearGradient(0, descBottom - fadeH, 0, descBottom)
      fadeGrad.addColorStop(0, hexA(bg, 0))
      fadeGrad.addColorStop(0.7, hexA(bg, 0.85))
      fadeGrad.addColorStop(1, bg)
      ctx.fillStyle = fadeGrad
      ctx.fillRect(0, descBottom - fadeH, W, fadeH)
    }
  }

  function downloadImage() {
    drawImage()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = 'ronapump-' + (w.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function copyImage() {
    drawImage()
    const canvas = canvasRef.current
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        downloadImage()
      }
    })
  }

  setTimeout(drawImage, 50)

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '560px' }}>
        <h2>Share to Instagram</h2>
        <div style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' }}>
          Download or copy this image to share on your Instagram feed.
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--brd)' }} />
        <div className="mf" style={{ marginTop: '12px' }}>
          <button className="ab" onClick={onClose}>Close</button>
          <button className="ab" onClick={copyImage}>{copied ? '\u2713 Copied!' : '\ud83d\udccb Copy Image'}</button>
          <button className="ab p" onClick={downloadImage}>{'\ud83d\udce5'} Download</button>
        </div>
      </div>
    </div>
  )
}
