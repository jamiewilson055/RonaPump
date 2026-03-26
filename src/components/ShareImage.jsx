import { useRef, useState } from 'react'

export default function ShareImage({ workout, onClose }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const w = workout

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  function drawImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 1080, H = 1080
    canvas.width = W
    canvas.height = H

    const accent = '#e01e1e'
    const text = '#ededf0'

    // Background
    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H)
    bg.addColorStop(0, '#0c0c12')
    bg.addColorStop(0.4, '#08080d')
    bg.addColorStop(1, '#0a0a10')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Radial glow — top right
    const glow1 = ctx.createRadialGradient(W + 80, -100, 0, W + 80, -100, 500)
    glow1.addColorStop(0, hexAlpha(accent, 0.08))
    glow1.addColorStop(1, 'transparent')
    ctx.fillStyle = glow1
    ctx.fillRect(0, 0, W, H)

    // ── HEADER ──
    ctx.textAlign = 'left'
    ctx.font = 'bold 36px monospace'
    ctx.fillStyle = text
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', 70, 78)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', 70 + ronaW + 8, 78)

    ctx.font = '36px serif'
    ctx.fillText('🦍', 70 + ronaW + 8 + ctx.measureText('PUMP').width + 16, 80)

    // ── WORKOUT NAME ──
    ctx.textAlign = 'left'
    ctx.font = 'bold 62px sans-serif'
    ctx.fillStyle = text
    const wName = w.name || 'Workout'
    const nameLines = wrapLines(ctx, wName, W - 140)
    let y = 160
    for (const l of nameLines) {
      ctx.fillText(l, 70, y)
      y += 72
    }

    // ── TAGS ROW ──
    y += 4
    ctx.font = '500 26px sans-serif'
    const tags = []
    if (w.workout_types?.length) {
      const wt = w.workout_types.filter(t => t !== 'General')
      if (wt.length) tags.push({ text: wt[0], isAccent: true })
    }
    if (w.estimated_duration_mins) {
      tags.push({ text: w.estimated_duration_mins + ' min', isAccent: false })
    } else if (w.estimated_duration_min && w.estimated_duration_max) {
      tags.push({ text: w.estimated_duration_min + '-' + w.estimated_duration_max + ' min', isAccent: false })
    }
    if (w.score_type && w.score_type !== 'None' && !tags.find(t => t.text === w.score_type)) {
      tags.push({ text: w.score_type, isAccent: false })
    }
    const eqList = (w.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 3)
    for (const eq of eqList) {
      tags.push({ text: eq, isAccent: false })
    }

    if (tags.length > 0) {
      let tagX = 70
      for (const tag of tags) {
        const tw = ctx.measureText(tag.text).width + 32
        if (tagX + tw > W - 70) break
        if (tag.isAccent) {
          ctx.fillStyle = hexAlpha(accent, 0.12)
          ctx.beginPath()
          ctx.roundRect(tagX, y - 20, tw, 38, 8)
          ctx.fill()
          ctx.strokeStyle = hexAlpha(accent, 0.18)
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = hexAlpha(accent, 0.8)
        } else {
          ctx.fillStyle = hexAlpha(text, 0.04)
          ctx.beginPath()
          ctx.roundRect(tagX, y - 20, tw, 38, 8)
          ctx.fill()
          ctx.strokeStyle = hexAlpha(text, 0.06)
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = hexAlpha(text, 0.4)
        }
        ctx.textAlign = 'left'
        ctx.fillText(tag.text, tagX + 16, y + 8)
        tagX += tw + 10
      }
      y += 48
    }

    // ── ACCENT DIVIDER ──
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(70, y, 60, 4, 2)
    ctx.fill()
    y += 30

    // ── DESCRIPTION ──
    const descText = (w.description || '').replace(/\*\*(.*?)\*\*/g, '$1')
    const rawLines = descText.split('\n')

    // Count content lines to pick font size
    const contentLines = rawLines.filter(l => l.trim()).length
    let fontSize, lineH
    if (contentLines > 14) {
      fontSize = 26; lineH = 36
    } else if (contentLines > 10) {
      fontSize = 28; lineH = 40
    } else {
      fontSize = 32; lineH = 44
    }

    const footerReserve = 80
    const maxDescY = H - footerReserve
    let truncated = false

    for (const rawLine of rawLines) {
      if (y > maxDescY - lineH) { truncated = true; break }

      const trimmed = rawLine.trim()
      if (!trimmed) {
        y += lineH * 0.4
        continue
      }

      // Section header (--- prefix from formatting toolbar)
      if (rawLine.startsWith('--- ')) {
        y += 6
        ctx.font = '600 ' + (fontSize - 4) + 'px sans-serif'
        ctx.fillStyle = hexAlpha(accent, 0.75)
        ctx.letterSpacing = '1.5px'
        ctx.textAlign = 'left'
        ctx.fillText(rawLine.slice(4).toUpperCase(), 70, y)
        ctx.letterSpacing = '0px'
        y += lineH
        continue
      }

      // Sub-bullet (  • prefix)
      if (rawLine.startsWith('  • ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = hexAlpha(text, 0.4)
        ctx.textAlign = 'left'
        const subLines = wrapLines(ctx, rawLine.slice(4), W - 220)
        for (const sl of subLines) {
          if (y > maxDescY - lineH) { truncated = true; break }
          ctx.fillText('       •  ' + sl, 70, y)
          y += lineH
        }
        continue
      }

      // Bullet (• prefix)
      if (rawLine.startsWith('• ')) {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = hexAlpha(text, 0.5)
        ctx.textAlign = 'left'
        const bulletLines = wrapLines(ctx, rawLine.slice(2), W - 180)
        for (const bl of bulletLines) {
          if (y > maxDescY - lineH) { truncated = true; break }
          ctx.fillText('  •  ' + bl, 70, y)
          y += lineH
        }
        continue
      }

      // Check if line looks like a section label (Part A:, Round 1:, etc.)
      const isLabel = /^(Part [A-Z]|Round \d|[A-Z][A-Za-z ]+:$)/.test(trimmed)
      if (isLabel) {
        y += 4
        ctx.font = '600 ' + fontSize + 'px sans-serif'
        ctx.fillStyle = hexAlpha(text, 0.65)
      } else {
        ctx.font = fontSize + 'px sans-serif'
        ctx.fillStyle = hexAlpha(text, 0.5)
      }

      ctx.textAlign = 'left'
      const wrapped = wrapLines(ctx, trimmed, W - 140)
      for (const wl of wrapped) {
        if (y > maxDescY - lineH) { truncated = true; break }
        ctx.fillText(wl, 70, y)
        y += lineH
      }
    }

    if (truncated) {
      ctx.font = fontSize + 'px sans-serif'
      ctx.fillStyle = hexAlpha(text, 0.2)
      ctx.textAlign = 'left'
      ctx.fillText('...', 70, maxDescY - 10)
    }

    // ── FOOTER ──
    const footerGrad = ctx.createLinearGradient(0, H - 70, 0, H)
    footerGrad.addColorStop(0, 'transparent')
    footerGrad.addColorStop(1, hexAlpha(accent, 0.08))
    ctx.fillStyle = footerGrad
    ctx.fillRect(0, H - 70, W, 70)

    ctx.font = '500 24px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = hexAlpha(text, 0.2)
    ctx.fillText('ronapump.com', 70, H - 30)

    ctx.textAlign = 'right'
    ctx.fillStyle = hexAlpha(text, 0.2)
    ctx.fillText('@ronapump', W - 70, H - 30)
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
