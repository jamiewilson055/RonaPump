import { useRef, useState, useEffect } from 'react'

export default function ShareImage({ workout, onClose }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const w = workout

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = '/harambe.png'
  }, [])

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
    const W = 1080, H = 1350
    canvas.width = W
    canvas.height = H

    const accent = '#e01e1e'
    const white = '#ffffff'
    const bg = '#0a0a0e'
    const px = 72
    const cw = W - px * 2

    // ── BACKGROUND ──
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle top-right glow
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 500)
    glow.addColorStop(0, hexA(accent, 0.05))
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    let y = 72

    // ── LOGO ROW ──
    ctx.font = '700 46px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = white
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', px, y)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', px + ronaW, y)

    // ── HARAMBE CIRCLE (top right) ──
    const imgSize = 72
    const imgR = imgSize / 2
    const imgCx = W - px - imgR
    const imgCy = y - 10
    const borderW = 3

    if (imgRef.current) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(imgCx, imgCy, imgR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imgRef.current, imgCx - imgR, imgCy - imgR, imgSize, imgSize)
      ctx.restore()
    }
    // Red circle border
    ctx.beginPath()
    ctx.arc(imgCx, imgCy, imgR + borderW / 2, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = borderW
    ctx.stroke()

    // ── ACCENT DIVIDER — stops before Harambe ──
    y += 18
    const dividerEnd = imgCx - imgR - 20
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(px, y, dividerEnd - px, 5, 3)
    ctx.fill()

    // ── "WORKOUT OF THE DAY" LABEL ──
    y += 30
    ctx.font = '500 22px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = hexA(white, 0.3)
    ctx.letterSpacing = '4px'
    ctx.fillText('WORKOUT OF THE DAY', px, y)
    ctx.letterSpacing = '0px'

    // ── WORKOUT NAME ──
    y += 10
    ctx.font = '700 62px sans-serif'
    ctx.fillStyle = white
    ctx.textAlign = 'left'
    const nameLines = wrapLines(ctx, w.name || 'Unnamed Workout', cw)
    for (const nl of nameLines) {
      y += 62
      ctx.fillText(nl, px, y)
    }

    // ── ACCENT UNDERLINE BELOW NAME ──
    y += 12
    ctx.fillStyle = hexA(accent, 0.6)
    ctx.beginPath()
    ctx.roundRect(px, y, Math.min(ctx.measureText(nameLines[nameLines.length - 1] || '').width, 320), 4, 2)
    ctx.fill()

    // ── TAGS ROW ──
    y += 18
    const tags = []
    const teal = '#2dd4bf'

    // Category (red accent) — up to 2
    const cats = (w.categories || []).slice(0, 2)
    cats.forEach(c => tags.push({ text: c, color: 'category' }))

    // Duration (teal) — exact or range
    if (w.estimated_duration_mins) {
      tags.push({ text: w.estimated_duration_mins + ' min', color: 'duration' })
    } else if (w.estimated_duration_min && w.estimated_duration_max) {
      tags.push({ text: w.estimated_duration_min + '-' + w.estimated_duration_max + ' min', color: 'duration' })
    }

    // Equipment (grey) — up to 3, excluding Bodyweight
    const equip = (w.equipment || []).filter(e => e !== 'Bodyweight')
    equip.slice(0, 3).forEach(e => tags.push({ text: e, color: 'equip' }))

    if (tags.length) {
      let tx = px
      const tagH = 40, tagPad = 18, tagGap = 10, tagFont = 24
      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        const tw = ctx.measureText(tag.text).width + tagPad * 2
        if (tx + tw > W - px) break

        if (tag.color === 'category') {
          ctx.fillStyle = hexA(accent, 0.14)
        } else if (tag.color === 'duration') {
          ctx.fillStyle = hexA(teal, 0.14)
        } else {
          ctx.fillStyle = hexA(white, 0.06)
        }
        ctx.beginPath()
        ctx.roundRect(tx, y, tw, tagH, 20)
        ctx.fill()

        if (tag.color === 'category') {
          ctx.fillStyle = accent
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else if (tag.color === 'duration') {
          ctx.fillStyle = teal
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else {
          ctx.fillStyle = hexA(white, 0.42)
          ctx.font = '500 ' + tagFont + 'px sans-serif'
        }
        ctx.textAlign = 'left'
        ctx.fillText(tag.text, tx + tagPad, y + 28)
        tx += tw + tagGap
      }
      y += tagH + 22
    } else {
      y += 12
    }

    // ── FOOTER (reserve space) ──
    const footerH = 58
    const footerY = H - footerH

    ctx.fillStyle = hexA(white, 0.08)
    ctx.fillRect(px, footerY, cw, 1)

    ctx.font = '500 28px monospace'
    ctx.fillStyle = hexA(white, 0.6)
    ctx.textAlign = 'left'
    ctx.fillText('ronapump.com', px, footerY + 38)
    ctx.textAlign = 'right'
    ctx.fillText('@ronapump', W - px, footerY + 38)

    // ── DESCRIPTION ──
    const descTop = y
    const bannerH = 48
    // Reserve banner space — if text fits, the extra padding is fine
    const descBottom = footerY - 14 - bannerH

    // Clean the description
    let desc = w.description || ''
    if (w.name) {
      const nm = w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      desc = desc.replace(new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi'), '')
      desc = desc.replace(/^\s*[\n\r]+/, '')
      // Only strip a leading dash/colon if NOT followed by another dash (protects --- sections)
      desc = desc.replace(/^\s*[-:](?!-)\s*/, '')
    }
    desc = desc.replace(/[\{\}]/g, '').trim()

    const rawLines = desc.split('\n')

    // Count effective lines to pick font size
    let effectiveLines = 0
    ctx.font = '38px sans-serif'
    for (const rl of rawLines) {
      const trimmed = rl.trim()
      if (trimmed === '') { effectiveLines += 0.4; continue }
      if (trimmed.startsWith('---')) {
        const st = trimmed.replace(/^-{3,}\s*/, '').trim()
        if (st) {
          ctx.font = '700 38px sans-serif'
          effectiveLines += wrapLines(ctx, st, cw - 20).length + 0.4
        } else {
          effectiveLines += 0.6
        }
        continue
      }
      ctx.font = '38px sans-serif'
      effectiveLines += wrapLines(ctx, trimmed, cw).length
    }

    let fontSize, lineH
    if (effectiveLines <= 4) { fontSize = 60; lineH = 76 }
    else if (effectiveLines <= 6) { fontSize = 54; lineH = 68 }
    else if (effectiveLines <= 10) { fontSize = 52; lineH = 66 }
    else if (effectiveLines <= 14) { fontSize = 46; lineH = 60 }
    else if (effectiveLines <= 20) { fontSize = 44; lineH = 56 }
    else if (effectiveLines <= 26) { fontSize = 38; lineH = 50 }
    else { fontSize = 34; lineH = 44 }

    let dy = descTop
    let truncated = false

    for (const rl of rawLines) {
      if (truncated) break
      const trimmed = rl.trim()

      if (trimmed === '') { dy += lineH * 0.5; continue }

      // Section lines: anything starting with ---
      if (trimmed.startsWith('---')) {
        const sectionText = trimmed.replace(/^-{3,}\s*/, '').trim()

        // Bare "---" with no text = visual divider (full width accent line)
        if (!sectionText) {
          dy += 10
          ctx.fillStyle = hexA(accent, 0.35)
          ctx.beginPath()
          ctx.roundRect(px, dy, cw, 3, 2)
          ctx.fill()
          dy += 18
          continue
        }

        // Section with text (e.g. "Block 1 – Every 4 minutes × 4 rounds")
        dy += 10
        ctx.font = '700 ' + fontSize + 'px sans-serif'
        ctx.fillStyle = accent
        ctx.textAlign = 'left'

        // Wrap section text so long headers don't overflow
        const sectionWrapped = wrapLines(ctx, sectionText, cw)
        for (let si = 0; si < sectionWrapped.length; si++) {
          if (dy + fontSize > descBottom) { truncated = true; break }

          ctx.fillStyle = accent
          ctx.font = '700 ' + fontSize + 'px sans-serif'
          ctx.fillText(sectionWrapped[si], px, dy + fontSize)
          dy += lineH
        }
        dy += 4
        continue
      }

      // Detect labels: "5 Rounds For Time:", "Part A:", "Round 1:"
      const isLabel = /^[\w].*:$/.test(trimmed) || /^(Part [A-Z]|Round \d)/i.test(trimmed)

      // Bullet handling — require dash+space to avoid matching --- sections
      let text = trimmed
      let indent = 0
      if (text.startsWith('  \u2022 ') || text.startsWith('  - ')) {
        text = text.slice(4)
        indent = 36
      } else if (text.startsWith('\u2022 ')) {
        text = text.slice(2)
      } else if (text.startsWith('- ')) {
        text = text.slice(2)
      }

      if (isLabel) {
        dy += 4
        ctx.font = '600 ' + fontSize + 'px sans-serif'
        ctx.fillStyle = white
      } else {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = hexA(white, 0.88)
      }

      ctx.textAlign = 'left'
      // Only add bullet prefix for actual bullets (• or single dash+space), NOT -- or ---
      const isBullet = trimmed.startsWith('\u2022 ') || trimmed.startsWith('  \u2022 ') || trimmed.startsWith('- ') || trimmed.startsWith('  - ')
      const bulletPrefix = isBullet ? '\u2022  ' : ''
      const bpW = bulletPrefix ? ctx.measureText(bulletPrefix).width : 0
      const wrapped = wrapLines(ctx, text, cw - indent - bpW)

      for (let wi = 0; wi < wrapped.length; wi++) {
        if (dy + fontSize > descBottom) { truncated = true; break }
        const prefix = (wi === 0 && bulletPrefix) ? bulletPrefix : (wi > 0 && bulletPrefix ? '    ' : '')
        ctx.fillText(prefix + wrapped[wi], px + indent, dy + fontSize)
        dy += lineH
      }
    }

    // Truncation banner — only when content overflows
    if (truncated) {
      const bannerY = footerY - bannerH - 6

      // Solid bg to cover any text that bled into banner zone
      ctx.fillStyle = bg
      ctx.fillRect(0, bannerY - 4, W, bannerH + 10)

      // Banner background
      ctx.fillStyle = hexA(accent, 0.1)
      ctx.beginPath()
      ctx.roundRect(px, bannerY, cw, bannerH, 8)
      ctx.fill()

      // Banner border
      ctx.strokeStyle = hexA(accent, 0.3)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(px, bannerY, cw, bannerH, 8)
      ctx.stroke()

      // Banner text
      ctx.font = '600 24px monospace'
      ctx.fillStyle = accent
      ctx.textAlign = 'center'
      ctx.fillText('\u25BE  Full workout at ronapump.com  \u25BE', W / 2, bannerY + 30)
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

  useEffect(() => { if (imgLoaded) drawImage() }, [imgLoaded])

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
