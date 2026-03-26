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

    // Solid dark background
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ── RED FRAME ──
    const pad = 40
    const frameX = pad
    const frameY = pad
    const frameW = W - pad * 2
    const frameH = H - pad * 2
    const radius = 20

    ctx.strokeStyle = accent
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.roundRect(frameX, frameY, frameW, frameH, radius)
    ctx.stroke()

    // Content area inside frame
    const cx = frameX + 44
    const cw = frameW - 88
    let y = frameY + 56

    // ── LOGO: RONAPUMP as one tight word ──
    ctx.font = 'bold 44px monospace'
    ctx.textAlign = 'left'
    // Measure RONA to position PUMP right after it
    const ronaText = 'RONA'
    const pumpText = 'PUMP'
    const ronaWidth = ctx.measureText(ronaText).width
    ctx.fillStyle = white
    ctx.fillText(ronaText, cx, y)
    ctx.fillStyle = accent
    ctx.fillText(pumpText, cx + ronaWidth, y)

    // Gorilla on the right
    ctx.font = '40px serif'
    ctx.textAlign = 'right'
    ctx.fillText('🦍', cx + cw, y + 2)

    // ── THIN RED DIVIDER ──
    y += 24
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.3
    ctx.fillRect(cx, y, cw, 1.5)
    ctx.globalAlpha = 1

    // ── WORKOUT NAME ──
    y += 40
    ctx.textAlign = 'left'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillStyle = white
    const wName = w.name || 'Workout'
    const nameLines = wrapLines(ctx, wName, cw)
    for (const l of nameLines) {
      ctx.fillText(l, cx, y)
      y += 74
    }

    // ── METADATA ROW ──
    y += 4
    ctx.font = '500 28px sans-serif'
    const metaParts = []

    if (w.workout_types?.length) {
      const wt = w.workout_types.filter(t => t !== 'General')
      if (wt.length) metaParts.push({ text: wt[0], isAccent: true })
    }
    if (w.estimated_duration_mins) {
      metaParts.push({ text: w.estimated_duration_mins + ' min', isAccent: false })
    } else if (w.estimated_duration_min && w.estimated_duration_max) {
      metaParts.push({ text: w.estimated_duration_min + '-' + w.estimated_duration_max + ' min', isAccent: false })
    }
    const eqList = (w.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 4)
    if (eqList.length > 0) {
      metaParts.push({ text: eqList.join(' · '), isAccent: false })
    }

    if (metaParts.length > 0) {
      let mx = cx
      for (let i = 0; i < metaParts.length; i++) {
        const part = metaParts[i]
        if (i > 0) {
          // Dot separator
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillText('·', mx + 10, y)
          mx += 30
        }
        ctx.fillStyle = part.isAccent ? accent : 'rgba(255,255,255,0.4)'
        if (part.isAccent) ctx.font = '700 28px sans-serif'
        else ctx.font = '500 28px sans-serif'
        ctx.fillText(part.text, mx, y)
        mx += ctx.measureText(part.text).width
      }
      y += 42
    }

    // ── CONTENT DIVIDER ──
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(cx, y, cw, 2)
    y += 30

    // ── DESCRIPTION ──
    const descText = (w.description || '').replace(/\*\*(.*?)\*\*/g, '$1')
    const rawLines = descText.split('\n')

    // Auto-scale font based on content density
    const contentLines = rawLines.filter(l => l.trim()).length
    let fontSize, lineH
    if (contentLines > 16) {
      fontSize = 28; lineH = 40
    } else if (contentLines > 12) {
      fontSize = 30; lineH = 44
    } else {
      fontSize = 34; lineH = 50
    }

    const bottomLimit = frameY + frameH - 70
    let truncated = false

    for (const rawLine of rawLines) {
      if (y > bottomLimit - lineH) { truncated = true; break }

      const trimmed = rawLine.trim()

      // Blank line = small gap
      if (!trimmed) {
        y += lineH * 0.35
        continue
      }

      // Section header (--- prefix)
      if (rawLine.startsWith('--- ')) {
        y += 8
        ctx.font = '700 ' + (fontSize - 2) + 'px sans-serif'
        ctx.fillStyle = accent
        ctx.textAlign = 'left'
        ctx.fillText(rawLine.slice(4).toUpperCase(), cx, y)
        y += lineH
        continue
      }

      // Sub-bullet
      if (rawLine.startsWith('  • ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = white
        ctx.textAlign = 'left'
        const subLines = wrapLines(ctx, '     •  ' + rawLine.slice(4), cw)
        for (const sl of subLines) {
          if (y > bottomLimit - lineH) { truncated = true; break }
          ctx.fillText(sl, cx, y)
          y += lineH
        }
        continue
      }

      // Bullet
      if (rawLine.startsWith('• ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = white
        ctx.textAlign = 'left'
        const bulletLines = wrapLines(ctx, '•  ' + rawLine.slice(2), cw)
        for (const bl of bulletLines) {
          if (y > bottomLimit - lineH) { truncated = true; break }
          ctx.fillText(bl, cx, y)
          y += lineH
        }
        continue
      }

      // Label detection
      const isLabel = /^[\w].*:$/.test(trimmed) || /^(Part [A-Z]|Round \d)/i.test(trimmed)
      if (isLabel) {
        y += 4
        ctx.font = '600 ' + fontSize + 'px sans-serif'
      } else {
        ctx.font = fontSize + 'px sans-serif'
      }
      ctx.fillStyle = white
      ctx.textAlign = 'left'
      const wrapped = wrapLines(ctx, trimmed, cw)
      for (const wl of wrapped) {
        if (y > bottomLimit - lineH) { truncated = true; break }
        ctx.fillText(wl, cx, y)
        y += lineH
      }
    }

    if (truncated) {
      ctx.font = fontSize + 'px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.textAlign = 'left'
      ctx.fillText('...', cx, bottomLimit - 10)
    }

    // ── FOOTER (inside frame, very subtle) ──
    const footerY = frameY + frameH - 30
    ctx.font = '500 22px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillText('ronapump.com', cx, footerY)
    ctx.textAlign = 'right'
    ctx.fillText('@ronapump', cx + cw, footerY)
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
