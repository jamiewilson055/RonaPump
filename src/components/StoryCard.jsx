import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StoryCard({ workout, score, session, onClose }) {
  const canvasRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const [style, setStyle] = useState(0)

  const STYLES = [
    { name: 'Dark', bg: '#07070a', accent: '#e01e1e', text: '#ededf0', sub: '#6e6e7a', grad1: '#0f0f15', grad2: '#07070a' },
    { name: 'Fire', bg: '#1a0500', accent: '#ff4422', text: '#fff', sub: '#ff9977', grad1: '#2a0800', grad2: '#0a0200' },
    { name: 'Midnight', bg: '#030818', accent: '#4f88ff', text: '#e0e8ff', sub: '#6080b0', grad1: '#081028', grad2: '#020510' },
    { name: 'Gold', bg: '#0a0800', accent: '#fbbf24', text: '#fff', sub: '#d4a520', grad1: '#1a1400', grad2: '#050300' },
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

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, s.grad1)
    grad.addColorStop(0.5, s.bg)
    grad.addColorStop(1, s.grad2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Subtle grid pattern
    ctx.strokeStyle = s.accent + '10'
    ctx.lineWidth = 1
    for (let i = 0; i < W; i += 60) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke()
    }
    for (let i = 0; i < H; i += 60) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke()
    }

    // Top accent bar
    ctx.fillStyle = s.accent
    ctx.fillRect(0, 0, W, 6)

    // RONAPUMP logo — one word, big
    ctx.textAlign = 'center'
    ctx.font = 'bold 72px monospace'
    ctx.fillStyle = s.accent
    ctx.fillText('RONAPUMP', W / 2, 100)

    // Gorilla emoji
    ctx.font = '120px serif'
    ctx.fillText('\u{1F98D}', W / 2, 260)

    // "WORKOUT COMPLETE"
    ctx.font = 'bold 48px monospace'
    ctx.fillStyle = s.accent
    ctx.fillText('WORKOUT COMPLETE', W / 2, 360)

    // Divider
    ctx.fillStyle = s.accent
    ctx.fillRect(W / 2 - 200, 390, 400, 3)

    // Workout name
    const wName = workout?.name || 'Workout'
    ctx.font = 'bold 60px monospace'
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

    let y = 470
    for (const l of lines) {
      ctx.fillText(l, W / 2, y)
      y += 68
    }

    // Score box
    if (score) {
      y += 16
      ctx.fillStyle = s.accent + '20'
      const boxW = 500, boxH = 140
      ctx.beginPath()
      ctx.roundRect(W / 2 - boxW / 2, y - 10, boxW, boxH, 20)
      ctx.fill()
      ctx.strokeStyle = s.accent
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = '30px monospace'
      ctx.fillStyle = s.sub
      ctx.fillText('SCORE', W / 2, y + 38)

      ctx.font = 'bold 68px monospace'
      ctx.fillStyle = s.text
      ctx.fillText(score, W / 2, y + 108)
      y += boxH + 30
    } else {
      y += 30
    }

    // Meta tags row (duration + type)
    const metaTags = []
    if (workout?.estimated_duration_mins) metaTags.push('\u23F1 ' + workout.estimated_duration_mins + ' min')
    if (workout?.workout_types?.length) {
      const wt = workout.workout_types.filter(t => t !== 'General')
      if (wt.length) metaTags.push(wt[0])
    }
    if (workout?.score_type && workout.score_type !== 'None') metaTags.push(workout.score_type)

    if (metaTags.length) {
      ctx.font = 'bold 26px monospace'
      const totalW = metaTags.reduce((a, t) => a + ctx.measureText(t).width + 40, -12)
      let tagX = W / 2 - totalW / 2
      for (const tag of metaTags) {
        const tw = ctx.measureText(tag).width + 28
        ctx.fillStyle = s.accent + '20'
        ctx.beginPath()
        ctx.roundRect(tagX, y - 18, tw, 36, 6)
        ctx.fill()
        ctx.fillStyle = s.accent
        ctx.textAlign = 'center'
        ctx.fillText(tag, tagX + tw / 2, y + 8)
        tagX += tw + 12
      }
      y += 50
    }

    // Workout description
    y += 20
    ctx.textAlign = 'left'
    ctx.font = '28px sans-serif'
    ctx.fillStyle = s.sub
    const descText = (workout?.description || '').replace(/\*\*/g, '')
    const descLines = descText.split('\n').filter(l => l.trim())
    const maxDescY = H - 460
    for (const dl of descLines) {
      if (y > maxDescY) {
        ctx.fillText('...', 100, y)
        y += 36
        break
      }
      const cleaned = dl.replace(/^  [•]\s*/, '     \u2022  ').replace(/^[•]\s*/, '  \u2022  ')
      y = wrapText(ctx, cleaned, 100, y, W - 200, 36)
    }

    // Equipment tags
    ctx.textAlign = 'center'
    const eqList = (workout?.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 4)
    if (eqList.length > 0) {
      const tagY = Math.max(y + 30, H - 420)
      ctx.font = '26px monospace'
      const totalEqW = eqList.reduce((a, e) => a + ctx.measureText(e).width + 36, -12)
      let eqX = W / 2 - totalEqW / 2

      for (const eq of eqList) {
        const tw = ctx.measureText(eq).width + 36
        ctx.fillStyle = s.accent + '20'
        ctx.beginPath()
        ctx.roundRect(eqX, tagY - 24, tw, 40, 8)
        ctx.fill()
        ctx.fillStyle = s.accent
        ctx.fillText(eq, eqX + tw / 2, tagY + 6)
        eqX += tw + 12
      }
    }

    // User info
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.textAlign = 'center'
    ctx.font = 'bold 40px monospace'
    ctx.fillStyle = s.text
    ctx.fillText(userName, W / 2, H - 310)

    ctx.font = '28px monospace'
    ctx.fillStyle = s.accent
    ctx.fillText(rank, W / 2, H - 260)

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    ctx.font = '26px monospace'
    ctx.fillStyle = s.sub
    ctx.fillText(dateStr, W / 2, H - 210)

    // Bottom bar
    ctx.fillStyle = s.accent
    ctx.fillRect(0, H - 120, W, 120)

    ctx.font = 'bold 36px monospace'
    ctx.fillStyle = '#fff'
    ctx.fillText('www.ronapump.com', W / 2, H - 70)

    ctx.font = '24px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText('@ronapump', W / 2, H - 35)
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
    drawCard()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = 'ronapump-' + (workout?.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png'
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
        <h2 style={{ marginBottom: '4px' }}>{'\u{1F4F8}'} Share to Instagram</h2>
        <p style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' }}>
          Download or copy this story card to share on Instagram.
        </p>

        {/* Style picker */}
        <div className="story-styles">
          {STYLES.map((s, i) => (
            <button key={i} className={'story-style-btn' + (style === i ? ' on' : '')}
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
          <button className="ab" onClick={copyImage}>{downloaded ? '\u2713 Copied!' : '\u{1F4CB} Copy'}</button>
          <button className="ab p" onClick={downloadImage}>{downloaded ? '\u2713 Done!' : '\u{1F4E5} Download'}</button>
        </div>
      </div>
    </div>
  )
}
