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

    // Background gradient (angled)
    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H)
    bg.addColorStop(0, '#0c0c12')
    bg.addColorStop(0.4, '#08080d')
    bg.addColorStop(1, '#0a0a10')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Radial glow — top right
    const glow1 = ctx.createRadialGradient(W + 60, -80, 0, W + 60, -80, 400)
    glow1.addColorStop(0, hexAlpha(accent, 0.10))
    glow1.addColorStop(1, 'transparent')
    ctx.fillStyle = glow1
    ctx.fillRect(0, 0, W, H)

    // Radial glow — bottom left
    const glow2 = ctx.createRadialGradient(-40, H + 40, 0, -40, H + 40, 300)
    glow2.addColorStop(0, hexAlpha(accent, 0.05))
    glow2.addColorStop(1, 'transparent')
    ctx.fillStyle = glow2
    ctx.fillRect(0, 0, W, H)

    // Header row: RONAPUMP logo left, gorilla right
    ctx.textAlign = 'left'
    ctx.font = 'bold 48px monospace'
    ctx.fillStyle = text
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', 70, 88)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', 70 + ronaW + 8, 88)

    ctx.font = '42px serif'
    ctx.textAlign = 'right'
    ctx.fillText('🦍', W - 70, 90)

    // Thin divider under header
    ctx.fillStyle = hexAlpha(text, 0.06)
    ctx.fillRect(70, 118, W - 140, 1)

    // Workout name
    ctx.textAlign = 'left'
    ctx.font = 'bold 54px sans-serif'
    ctx.fillStyle = text
    const nameBottom = wrapText(ctx, w.name || 'Workout', 70, 190, W - 140, 64)

    // Accent line under name
    ctx.fillStyle = accent
    ctx.fillRect(70, nameBottom + 8, 140, 3)

    // Meta tags row
    let metaY = nameBottom + 48
    ctx.font = '500 26px sans-serif'
    const tags = []
    if (w.estimated_duration_mins) tags.push('⏱ ' + w.estimated_duration_mins + ' min')
    else if (w.estimated_duration_min && w.estimated_duration_max) tags.push('⏱ ' + w.estimated_duration_min + '-' + w.estimated_duration_max + ' min')
    if (w.workout_types?.length) {
      const wt = w.workout_types.filter(t => t !== 'General')
      if (wt.length) tags.push(wt[0])
    }
    if (w.score_type && w.score_type !== 'None') tags.push(w.score_type)

    if (tags.length) {
      let tagX = 70
      for (const tag of tags) {
        const tw = ctx.measureText(tag).width + 30
        // Tag background
        ctx.fillStyle = hexAlpha(accent, 0.08)
        ctx.beginPath()
        ctx.roundRect(tagX, metaY - 20, tw, 36, 8)
        ctx.fill()
        // Tag border
        ctx.strokeStyle = hexAlpha(accent, 0.12)
        ctx.lineWidth = 1
        ctx.stroke()
        // Tag text
        ctx.fillStyle = hexAlpha(accent, 0.7)
        ctx.fillText(tag, tagX + 15, metaY + 6)
        tagX += tw + 10
      }
      metaY += 50
    }

    // Description
    ctx.font = '30px sans-serif'
    ctx.fillStyle = hexAlpha(text, 0.5)
    const descText = (w.description || '').replace(/\*\*/g, '')
    const descLines = descText.split('\n').filter(l => l.trim())
    let y = metaY + 10
    const maxDescY = H - 200
    for (const line of descLines) {
      if (y > maxDescY) {
        ctx.fillStyle = hexAlpha(text, 0.25)
        ctx.fillText('...', 70, y)
        break
      }
      const cleaned = line.replace(/^  [•]\s*/, '     •  ').replace(/^[•]\s*/, '  •  ')
      y = wrapText(ctx, cleaned, 70, y, W - 140, 38)
    }

    // Equipment dots at bottom
    const eqList = (w.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 5)
    if (eqList.length > 0) {
      ctx.font = '500 24px sans-serif'
      ctx.fillStyle = hexAlpha(text, 0.25)
      ctx.textAlign = 'left'
      const eqStr = eqList.join('  ·  ')
      ctx.fillText(eqStr, 70, H - 130)
    }

    // Footer gradient
    const footerGrad = ctx.createLinearGradient(0, H - 100, 0, H)
    footerGrad.addColorStop(0, 'transparent')
    footerGrad.addColorStop(1, hexAlpha(accent, 0.1))
    ctx.fillStyle = footerGrad
    ctx.fillRect(0, H - 100, W, 100)

    // Footer content
    ctx.textAlign = 'left'
    ctx.font = '600 26px sans-serif'
    ctx.fillStyle = hexAlpha(text, 0.5)
    ctx.fillText('ronapump.com', 70, H - 42)

    ctx.textAlign = 'right'
    ctx.font = '24px sans-serif'
    ctx.fillStyle = hexAlpha(text, 0.25)
    ctx.fillText('@ronapump', W - 70, H - 42)
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let curY = y
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, curY)
        line = word + ' '
        curY += lineHeight
      } else {
        line = test
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, curY)
      curY += lineHeight
    }
    return curY
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
          Download or copy this image to share on your Instagram story or feed.
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
