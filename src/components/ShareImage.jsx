import { useRef, useState } from 'react'

export default function ShareImage({ workout, onClose }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const w = workout

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
    const muted = 'rgba(255,255,255,0.4)'
    const subtle = 'rgba(255,255,255,0.25)'
    const divider = 'rgba(255,255,255,0.06)'

    // Solid dark background
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── TOP ACCENT BAR ──
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 6)

    // ── LOGO ROW ──
    const logoY = 72
    ctx.textAlign = 'left'
    ctx.font = 'bold 42px monospace'
    ctx.fillStyle = white
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', 60, logoY)
    ctx.fillStyle = accent
    const pumpX = 60 + ronaW + 16
    ctx.fillText('PUMP', pumpX, logoY)

    // Gorilla on the right
    ctx.font = '42px serif'
    ctx.textAlign = 'right'
    ctx.fillText('🦍', W - 60, logoY + 4)

    // ── WORKOUT NAME ──
    ctx.textAlign = 'left'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillStyle = white
    const wName = w.name || 'Workout'
    const nameLines = wrapLines(ctx, wName, W - 120)
    let y = 140
    for (const l of nameLines) {
      ctx.fillText(l, 60, y)
      y += 74
    }

    // ── TAGS ROW ──
    y += 8
    ctx.font = '600 28px sans-serif'
    const tags = []

    // Workout type gets accent treatment
    if (w.workout_types?.length) {
      const wt = w.workout_types.filter(t => t !== 'General')
      if (wt.length) tags.push({ text: wt[0], isAccent: true })
    }

    // Duration
    if (w.estimated_duration_mins) {
      tags.push({ text: w.estimated_duration_mins + ' min', isAccent: false })
    } else if (w.estimated_duration_min && w.estimated_duration_max) {
      tags.push({ text: w.estimated_duration_min + '-' + w.estimated_duration_max + ' min', isAccent: false })
    }

    // Equipment (skip Bodyweight)
    const eqList = (w.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 3)
    for (const eq of eqList) {
      tags.push({ text: eq, isAccent: false })
    }

    if (tags.length > 0) {
      let tagX = 60
      for (const tag of tags) {
        const tw = ctx.measureText(tag.text).width + 28
        if (tagX + tw > W - 60) break
        if (tag.isAccent) {
          ctx.fillStyle = 'rgba(224,30,30,0.18)'
          ctx.beginPath()
          ctx.roundRect(tagX, y - 22, tw, 38, 6)
          ctx.fill()
          ctx.fillStyle = accent
        } else {
          ctx.fillStyle = muted
        }
        ctx.textAlign = 'left'
        ctx.fillText(tag.text, tagX + 14, y + 6)
        tagX += tw + 12
      }
      y += 44
    }

    // ── DIVIDER LINE ──
    ctx.fillStyle = divider
    ctx.fillRect(60, y, W - 120, 2)
    y += 32

    // ── DESCRIPTION ──
    const descText = (w.description || '').replace(/\*\*(.*?)\*\*/g, '$1')
    const rawLines = descText.split('\n')

    // Count content lines to pick font size
    const contentLines = rawLines.filter(l => l.trim()).length
    let fontSize, lineH
    if (contentLines > 16) {
      fontSize = 28; lineH = 40
    } else if (contentLines > 12) {
      fontSize = 30; lineH = 44
    } else {
      fontSize = 34; lineH = 50
    }

    const footerY = H - 70
    let truncated = false

    for (const rawLine of rawLines) {
      if (y > footerY - lineH) { truncated = true; break }

      const trimmed = rawLine.trim()

      // Blank line = small gap
      if (!trimmed) {
        y += lineH * 0.35
        continue
      }

      // Section header (--- prefix from formatting toolbar)
      if (rawLine.startsWith('--- ')) {
        y += 8
        ctx.font = '700 ' + (fontSize - 2) + 'px sans-serif'
        ctx.fillStyle = accent
        ctx.textAlign = 'left'
        ctx.fillText(rawLine.slice(4).toUpperCase(), 60, y)
        y += lineH
        continue
      }

      // Sub-bullet (  • prefix)
      if (rawLine.startsWith('  • ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = white
        ctx.textAlign = 'left'
        const subLines = wrapLines(ctx, '     •  ' + rawLine.slice(4), W - 120)
        for (const sl of subLines) {
          if (y > footerY - lineH) { truncated = true; break }
          ctx.fillText(sl, 60, y)
          y += lineH
        }
        continue
      }

      // Bullet (• prefix)
      if (rawLine.startsWith('• ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = white
        ctx.textAlign = 'left'
        const bulletLines = wrapLines(ctx, '•  ' + rawLine.slice(2), W - 120)
        for (const bl of bulletLines) {
          if (y > footerY - lineH) { truncated = true; break }
          ctx.fillText(bl, 60, y)
          y += lineH
        }
        continue
      }

      // Detect label-style lines (e.g. "5 Rounds For Time:", "Part A:", etc.)
      const isLabel = /^[\w].*:$/.test(trimmed) || /^(Part [A-Z]|Round \d)/i.test(trimmed)

      if (isLabel) {
        y += 4
        ctx.font = '600 ' + fontSize + 'px sans-serif'
        ctx.fillStyle = white
      } else {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = white
      }

      ctx.textAlign = 'left'
      const wrapped = wrapLines(ctx, trimmed, W - 120)
      for (const wl of wrapped) {
        if (y > footerY - lineH) { truncated = true; break }
        ctx.fillText(wl, 60, y)
        y += lineH
      }
    }

    if (truncated) {
      ctx.font = fontSize + 'px sans-serif'
      ctx.fillStyle = subtle
      ctx.textAlign = 'left'
      ctx.fillText('...', 60, footerY - 14)
    }

    // ── FOOTER ──
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(0, footerY, W, H - footerY)

    ctx.font = '500 24px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = subtle
    ctx.fillText('ronapump.com', 60, footerY + 40)

    ctx.textAlign = 'right'
    ctx.fillText('@ronapump', W - 60, footerY + 40)
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
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
          <button className="ab" onClick={copyImage}>{copied ? '✓ Copied!' : '📋 Copy Image'}</button>
          <button className="ab p" onClick={downloadImage}>📥 Download</button>
        </div>
      </div>
    </div>
  )
}
