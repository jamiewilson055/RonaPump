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
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, W, H)

    // Red accent border
    ctx.strokeStyle = '#ff2d2d'
    ctx.lineWidth = 4
    ctx.strokeRect(40, 40, W - 80, H - 80)

    // Corner accent
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(40, 40, 120, 4)
    ctx.fillRect(40, 40, 4, 120)
    ctx.fillRect(W - 160, H - 44, 120, 4)
    ctx.fillRect(W - 44, H - 160, 4, 120)

    // RONAPUMP header
    ctx.font = 'bold 42px monospace'
    ctx.fillStyle = '#ff2d2d'
    ctx.fillText('RONA', 80, 120)
    const ronaWidth = ctx.measureText('RONA').width
    ctx.fillStyle = '#ffffff'
    ctx.fillText('PUMP', 80 + ronaWidth, 120)

    // Workout name
    ctx.font = 'bold 52px monospace'
    ctx.fillStyle = '#ffffff'
    wrapText(ctx, w.name || 'Workout', 80, 210, W - 160, 60)

    // Divider
    const nameBottom = getWrappedTextBottom(ctx, w.name || 'Workout', 80, 210, W - 160, 60)
    ctx.fillStyle = '#ff2d2d'
    ctx.fillRect(80, nameBottom + 20, 200, 3)

    // Description
    ctx.font = '32px sans-serif'
    ctx.fillStyle = '#cccccc'
    const descLines = (w.description || '').split('\n').filter(l => l.trim())
    let y = nameBottom + 60
    for (const line of descLines) {
      if (y > H - 200) {
        ctx.fillText('...', 80, y)
        break
      }
      const cleaned = line.replace(/^[•]\s*/, '  •  ')
      y = wrapText(ctx, cleaned, 80, y, W - 160, 40)
    }

    // Tags bar
    const tags = []
    if (w.estimated_duration_mins) tags.push(`⏱ ${w.estimated_duration_mins}m`)
    if (w.workout_types?.length) tags.push(w.workout_types.filter(t => t !== 'General')[0])
    if (w.equipment?.filter(e => e !== 'Bodyweight').length) tags.push(w.equipment.filter(e => e !== 'Bodyweight')[0])

    if (tags.length) {
      ctx.font = 'bold 26px monospace'
      ctx.fillStyle = '#666666'
      ctx.fillText(tags.join('  ·  '), 80, H - 130)
    }

    // Footer
    ctx.font = 'bold 28px monospace'
    ctx.fillStyle = '#ff2d2d'
    ctx.fillText('🦍', 80, H - 70)
    ctx.fillStyle = '#888888'
    ctx.font = '24px monospace'
    ctx.fillText('www.ronapump.com  |  @ronapump', 120, H - 70)
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

  function getWrappedTextBottom(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let curY = y
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        line = word + ' '
        curY += lineHeight
      } else {
        line = test
      }
    }
    return curY
  }

  function downloadImage() {
    drawImage()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `ronapump-${(w.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
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
        // Fallback: download instead
        downloadImage()
      }
    })
  }

  // Draw on mount
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
