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

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0c0c12')
    bg.addColorStop(1, '#07070a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle diagonal lines for texture
    ctx.strokeStyle = 'rgba(255,45,45,.03)'
    ctx.lineWidth = 1
    for (let i = -H; i < W + H; i += 80) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke()
    }

    // Top accent bar
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(0, 0, W, 5)

    // RONAPUMP header — one word, big
    ctx.textAlign = 'left'
    ctx.font = 'bold 72px monospace'
    ctx.fillStyle = '#ff2d2d'
    ctx.fillText('RONAPUMP', 70, 100)

    // Gorilla
    ctx.font = '48px serif'
    ctx.textAlign = 'right'
    ctx.fillText('\u{1F98D}', W - 70, 100)

    // Thin divider under header
    ctx.fillStyle = 'rgba(255,255,255,.06)'
    ctx.fillRect(70, 130, W - 140, 1)

    // Workout name
    ctx.textAlign = 'left'
    ctx.font = 'bold 56px monospace'
    ctx.fillStyle = '#ffffff'
    const nameBottom = wrapText(ctx, w.name || 'Workout', 70, 200, W - 140, 64)

    // Red accent line under name
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(70, nameBottom + 10, 160, 3)

    // Meta tags row
    let metaY = nameBottom + 50
    ctx.font = 'bold 26px monospace'
    const tags = []
    if (w.estimated_duration_mins) tags.push('\u23F1 ' + w.estimated_duration_mins + ' min')
    else if (w.estimated_duration_min && w.estimated_duration_max) tags.push('\u23F1 ' + w.estimated_duration_min + '-' + w.estimated_duration_max + ' min')
    if (w.workout_types?.length) {
      const wt = w.workout_types.filter(t => t !== 'General')
      if (wt.length) tags.push(wt[0])
    }
    if (w.score_type && w.score_type !== 'None') tags.push(w.score_type)

    if (tags.length) {
      let tagX = 70
      for (const tag of tags) {
        const tw = ctx.measureText(tag).width + 28
        ctx.fillStyle = 'rgba(255,45,45,.12)'
        ctx.beginPath()
        ctx.roundRect(tagX, metaY - 22, tw, 36, 6)
        ctx.fill()
        ctx.fillStyle = '#ff2d2d'
        ctx.fillText(tag, tagX + 14, metaY + 6)
        tagX += tw + 10
      }
      metaY += 50
    }

    // Description
    ctx.font = '30px sans-serif'
    ctx.fillStyle = '#b8b8c0'
    const descText = (w.description || '').replace(/\*\*/g, '')
    const descLines = descText.split('\n').filter(l => l.trim())
    let y = metaY + 10
    const maxDescY = H - 200
    for (const line of descLines) {
      if (y > maxDescY) {
        ctx.fillStyle = '#666670'
        ctx.fillText('...', 70, y)
        break
      }
      const cleaned = line.replace(/^  [•]\s*/, '     \u2022  ').replace(/^[•]\s*/, '  \u2022  ')
      y = wrapText(ctx, cleaned, 70, y, W - 140, 38)
    }

    // Equipment bar at bottom
    const eqList = (w.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 5)
    if (eqList.length > 0) {
      ctx.font = '24px monospace'
      ctx.fillStyle = '#4e4e58'
      ctx.textAlign = 'left'
      ctx.fillText(eqList.join('  \u00B7  '), 70, H - 140)
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,.04)'
    ctx.fillRect(0, H - 100, W, 100)

    ctx.textAlign = 'left'
    ctx.font = 'bold 28px monospace'
    ctx.fillStyle = '#ff2d2d'
    ctx.fillText('\u{1F98D}', 70, H - 50)
    ctx.fillStyle = '#6e6e7a'
    ctx.font = '24px monospace'
    ctx.fillText('www.ronapump.com  |  @ronapump', 110, H - 50)

    // Bottom accent bar
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(0, H - 5, W, 5)
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
          <button className="ab" onClick={copyImage}>{copied ? '\u2713 Copied!' : '\u{1F4CB} Copy Image'}</button>
          <button className="ab p" onClick={downloadImage}>{'\u{1F4E5}'} Download</button>
        </div>
      </div>
    </div>
  )
}
