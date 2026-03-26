import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StoryCard({ workout, score, session, onClose }) {
  const canvasRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const [style, setStyle] = useState(0)

  const STYLES = [
    { name: 'Dark', bg: '#07070a', accent: '#e01e1e', text: '#ededf0', sub: '#6e6e7a', grad1: '#0a0a0f', grad2: '#111118', grad3: '#0d0d14', glow: 0.12 },
    { name: 'Fire', bg: '#1a0500', accent: '#ff4422', text: '#fff', sub: '#ff9977', grad1: '#0f0200', grad2: '#1a0500', grad3: '#0a0200', glow: 0.15 },
    { name: 'Midnight', bg: '#030818', accent: '#4f88ff', text: '#e0e8ff', sub: '#6080b0', grad1: '#060c1e', grad2: '#030818', grad3: '#040a1a', glow: 0.12 },
    { name: 'Gold', bg: '#0a0800', accent: '#fbbf24', text: '#fff', sub: '#d4a520', grad1: '#0d0a00', grad2: '#0a0800', grad3: '#080600', glow: 0.10 },
  ]

  useEffect(() => {
    if (session) loadData()
  }, [session])

  useEffect(() => {
    drawCard()
  }, [profile, style, workout, score])

  async function loadData() {
    const { data: p } = await supabase.from('profiles').select('display_name, gorilla_rank, xp').eq('id', session.user.id).single()
    if (p) setProfile(p)
  }

  function drawCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 1080, H = 1920
    canvas.width = W
    canvas.height = H

    const s = STYLES[style]

    // Background gradient (angled)
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H)
    grad.addColorStop(0, s.grad1)
    grad.addColorStop(0.4, s.grad2)
    grad.addColorStop(1, s.grad3)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Radial glow — top right
    const glow1 = ctx.createRadialGradient(W + 80, -120, 0, W + 80, -120, 500)
    glow1.addColorStop(0, hexAlpha(s.accent, s.glow))
    glow1.addColorStop(1, 'transparent')
    ctx.fillStyle = glow1
    ctx.fillRect(0, 0, W, H)

    // Radial glow — bottom left
    const glow2 = ctx.createRadialGradient(-60, H - 300, 0, -60, H - 300, 400)
    glow2.addColorStop(0, hexAlpha(s.accent, s.glow * 0.5))
    glow2.addColorStop(1, 'transparent')
    ctx.fillStyle = glow2
    ctx.fillRect(0, 0, W, H)

    // RONAPUMP logo — RONA white, PUMP accent
    ctx.textAlign = 'center'
    ctx.font = 'bold 44px monospace'
    const ronaW = ctx.measureText('RONA').width
    const pumpW = ctx.measureText('PUMP').width
    const totalW = ronaW + pumpW + 12
    const logoX = W / 2 - totalW / 2
    ctx.fillStyle = s.text
    ctx.fillText('RONA', logoX + ronaW / 2, 110)
    ctx.fillStyle = s.accent
    ctx.fillText('PUMP', logoX + ronaW + 12 + pumpW / 2, 110)

    // Gorilla emoji
    ctx.font = '120px serif'
    ctx.textAlign = 'center'
    ctx.fillText('🦍', W / 2, 270)

    // "WORKOUT COMPLETE" — subtle label
    ctx.font = '500 28px sans-serif'
    ctx.fillStyle = hexAlpha(s.text, 0.35)
    ctx.letterSpacing = '6px'
    ctx.fillText('WORKOUT COMPLETE', W / 2, 340)
    ctx.letterSpacing = '0px'

    // Workout name
    const wName = workout?.name || 'Workout'
    ctx.font = 'bold 68px sans-serif'
    ctx.fillStyle = s.text
    const words = wName.split(' ')
    let lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > W - 160) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)

    let y = 440
    for (const l of lines) {
      ctx.fillText(l, W / 2, y)
      y += 80
    }

    // Score box (frosted glass style)
    if (score) {
      y += 30
      const boxW = 520, boxH = 160
      const boxX = W / 2 - boxW / 2

      // Glass background
      ctx.fillStyle = hexAlpha(s.text, 0.04)
      ctx.beginPath()
      ctx.roundRect(boxX, y, boxW, boxH, 24)
      ctx.fill()

      // Border
      ctx.strokeStyle = hexAlpha(s.text, 0.06)
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Score value — big
      ctx.font = 'bold 80px sans-serif'
      ctx.fillStyle = s.text
      ctx.fillText(score, W / 2, y + 90)

      // "SCORE" label
      ctx.font = '500 24px sans-serif'
      ctx.fillStyle = hexAlpha(s.text, 0.35)
      ctx.letterSpacing = '4px'
      ctx.fillText('SCORE', W / 2, y + 135)
      ctx.letterSpacing = '0px'

      y += boxH + 40
    } else {
      y += 50
    }

    // Stats row — just Duration + Type (no streak)
    const statsY = Math.max(y + 20, 880)
    const statBoxes = []

    if (workout?.estimated_duration_mins) {
      statBoxes.push({ value: `${workout.estimated_duration_mins}`, label: 'MIN' })
    } else if (workout?.estimated_duration_min && workout?.estimated_duration_max) {
      statBoxes.push({ value: `${workout.estimated_duration_min}-${workout.estimated_duration_max}`, label: 'MIN' })
    }

    if (workout?.score_type && workout.score_type !== 'None') {
      statBoxes.push({ value: workout.score_type.toUpperCase().slice(0, 8), label: 'TYPE' })
    }

    if (statBoxes.length > 0) {
      const statW = 200
      const gap = 20
      const totalStatW = statBoxes.length * statW + (statBoxes.length - 1) * gap
      let statX = W / 2 - totalStatW / 2

      for (const stat of statBoxes) {
        // Glass box
        ctx.fillStyle = hexAlpha(s.text, 0.03)
        ctx.beginPath()
        ctx.roundRect(statX, statsY, statW, 120, 16)
        ctx.fill()
        ctx.strokeStyle = hexAlpha(s.text, 0.04)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.textAlign = 'center'
        ctx.font = 'bold 48px sans-serif'
        ctx.fillStyle = s.text
        ctx.fillText(stat.value, statX + statW / 2, statsY + 58)

        ctx.font = '500 20px sans-serif'
        ctx.fillStyle = hexAlpha(s.text, 0.3)
        ctx.letterSpacing = '2px'
        ctx.fillText(stat.label, statX + statW / 2, statsY + 100)
        ctx.letterSpacing = '0px'

        statX += statW + gap
      }
    }

    // Equipment tags
    const eqList = (workout?.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 4)
    if (eqList.length > 0) {
      const tagY = (statBoxes.length > 0 ? statsY + 160 : statsY + 20)
      ctx.font = '500 26px sans-serif'
      const totalTagW = eqList.reduce((a, e) => a + ctx.measureText(e).width + 36, -12)
      let tagX = W / 2 - totalTagW / 2

      for (const eq of eqList) {
        const tw = ctx.measureText(eq).width + 36
        // Tag background
        ctx.fillStyle = hexAlpha(s.accent, 0.08)
        ctx.beginPath()
        ctx.roundRect(tagX, tagY - 16, tw, 40, 8)
        ctx.fill()
        // Tag border
        ctx.strokeStyle = hexAlpha(s.accent, 0.12)
        ctx.lineWidth = 1
        ctx.stroke()
        // Tag text
        ctx.fillStyle = hexAlpha(s.accent, 0.6)
        ctx.textAlign = 'center'
        ctx.fillText(eq, tagX + tw / 2, tagY + 12)
        tagX += tw + 12
      }
    }

    // User info
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.textAlign = 'center'
    ctx.font = '600 40px sans-serif'
    ctx.fillStyle = hexAlpha(s.text, 0.9)
    ctx.fillText(userName, W / 2, H - 340)

    ctx.font = '500 28px sans-serif'
    ctx.fillStyle = hexAlpha(s.accent, 0.7)
    ctx.fillText(rank, W / 2, H - 290)

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    ctx.font = '26px sans-serif'
    ctx.fillStyle = hexAlpha(s.text, 0.2)
    ctx.fillText(dateStr, W / 2, H - 240)

    // Bottom gradient footer
    const footerGrad = ctx.createLinearGradient(0, H - 130, 0, H)
    footerGrad.addColorStop(0, 'transparent')
    footerGrad.addColorStop(1, hexAlpha(s.accent, 0.15))
    ctx.fillStyle = footerGrad
    ctx.fillRect(0, H - 130, W, 130)

    ctx.font = '600 30px sans-serif'
    ctx.fillStyle = hexAlpha(s.text, 0.6)
    ctx.letterSpacing = '2px'
    ctx.fillText('ronapump.com', W / 2, H - 60)
    ctx.letterSpacing = '0px'

    ctx.font = '24px sans-serif'
    ctx.fillStyle = hexAlpha(s.text, 0.3)
    ctx.fillText('@ronapump', W / 2, H - 28)
  }

  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  function downloadImage() {
    drawCard()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `ronapump-${(workout?.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  async function copyImage() {
    drawCard()
    const canvas = canvasRef.current
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2000)
    } catch {
      downloadImage()
    }
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '440px' }}>
        <h2 style={{ marginBottom: '4px' }}>📸 Share to Instagram</h2>
        <p style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' }}>
          Download or copy this story card to share on Instagram.
        </p>

        {/* Style picker */}
        <div className="story-styles">
          {STYLES.map((s, i) => (
            <button key={i} className={`story-style-btn${style === i ? ' on' : ''}`}
              style={{ background: s.bg, borderColor: style === i ? s.accent : 'var(--brd)' }}
              onClick={() => setStyle(i)}>
              <span style={{ color: s.accent, fontSize: '10px', fontWeight: 700 }}>{s.name}</span>
            </button>
          ))}
        </div>

        {/* Canvas preview */}
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--brd)' }} />

        {/* Actions */}
        <div className="mf" style={{ marginTop: '10px' }}>
          <button className="ab" onClick={onClose}>Close</button>
          <button className="ab" onClick={copyImage}>{downloaded ? '✓ Copied!' : '📋 Copy'}</button>
          <button className="ab p" onClick={downloadImage}>{downloaded ? '✓ Done!' : '📥 Download'}</button>
        </div>
      </div>
    </div>
  )
}
