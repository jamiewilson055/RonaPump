import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StoryCard({ workout, score, session, onClose }) {
  const canvasRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(0)
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
  }, [profile, streak, style, workout, score])

  async function loadData() {
    const { data: p } = await supabase.from('profiles').select('display_name, gorilla_rank, xp').eq('id', session.user.id).single()
    if (p) setProfile(p)

    // Compute streak
    const { data: logs } = await supabase
      .from('performance_log')
      .select('completed_at')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(60)

    if (logs) {
      const dates = new Set(logs.map(l => l.completed_at))
      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        if (dates.has(ds)) s++
        else if (i > 0) break
      }
      setStreak(s)
    }
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
    ctx.strokeStyle = `${s.accent}10`
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

    // RONAPUMP logo
    ctx.textAlign = 'center'
    ctx.font = 'bold 42px monospace'
    ctx.fillStyle = s.text
    ctx.fillText('RONA', W / 2 - 60, 100)
    ctx.fillStyle = s.accent
    ctx.fillText('PUMP', W / 2 + 60, 100)

    // Gorilla emoji
    ctx.font = '120px serif'
    ctx.fillText('🦍', W / 2, 260)

    // "WORKOUT COMPLETE"
    ctx.font = 'bold 52px monospace'
    ctx.fillStyle = s.accent
    ctx.fillText('WORKOUT COMPLETE', W / 2, 370)

    // Divider
    ctx.fillStyle = s.accent
    ctx.fillRect(W / 2 - 200, 400, 400, 3)

    // Workout name
    const wName = workout?.name || 'Workout'
    ctx.font = 'bold 64px monospace'
    ctx.fillStyle = s.text
    // Word wrap for long names
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

    let y = 480
    for (const l of lines) {
      ctx.fillText(l, W / 2, y)
      y += 72
    }

    // Score box
    if (score) {
      y += 20
      // Score box background
      ctx.fillStyle = `${s.accent}20`
      const boxW = 500, boxH = 140
      ctx.beginPath()
      ctx.roundRect(W / 2 - boxW / 2, y - 10, boxW, boxH, 20)
      ctx.fill()
      ctx.strokeStyle = s.accent
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = '32px monospace'
      ctx.fillStyle = s.sub
      ctx.fillText('SCORE', W / 2, y + 40)

      ctx.font = 'bold 72px monospace'
      ctx.fillStyle = s.text
      ctx.fillText(score, W / 2, y + 110)
      y += boxH + 30
    } else {
      y += 40
    }

    // Stats row
    const statsY = Math.max(y + 40, 900)

    // Duration
    if (workout?.estimated_duration_mins) {
      drawStatBox(ctx, W / 2 - 280, statsY, 160, `${workout.estimated_duration_mins}`, 'MIN', s)
    }

    // Streak
    drawStatBox(ctx, W / 2 - 80, statsY, 160, `${streak}`, 'STREAK', s)

    // Score type
    if (workout?.score_type && workout.score_type !== 'None') {
      drawStatBox(ctx, W / 2 + 120, statsY, 160, workout.score_type.toUpperCase().slice(0, 6), 'TYPE', s)
    }

    // Equipment tags
    const eqList = (workout?.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 4)
    if (eqList.length > 0) {
      const tagY = statsY + 180
      ctx.font = '28px monospace'
      const totalW = eqList.reduce((a, e) => a + ctx.measureText(e).width + 40, -12)
      let tagX = W / 2 - totalW / 2

      for (const eq of eqList) {
        const tw = ctx.measureText(eq).width + 40
        ctx.fillStyle = `${s.accent}25`
        ctx.beginPath()
        ctx.roundRect(tagX, tagY - 28, tw, 44, 8)
        ctx.fill()
        ctx.fillStyle = s.accent
        ctx.textAlign = 'center'
        ctx.fillText(eq, tagX + tw / 2, tagY + 8)
        tagX += tw + 12
      }
    }

    // User info
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.textAlign = 'center'
    ctx.font = 'bold 40px monospace'
    ctx.fillStyle = s.text
    ctx.fillText(userName, W / 2, H - 340)

    ctx.font = '28px monospace'
    ctx.fillStyle = s.accent
    ctx.fillText(rank, W / 2, H - 290)

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    ctx.font = '26px monospace'
    ctx.fillStyle = s.sub
    ctx.fillText(dateStr, W / 2, H - 240)

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

  function drawStatBox(ctx, x, y, w, value, label, s) {
    ctx.fillStyle = `${s.accent}15`
    ctx.beginPath()
    ctx.roundRect(x, y, w, 120, 16)
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.font = 'bold 48px monospace'
    ctx.fillStyle = s.text
    ctx.fillText(value, x + w / 2, y + 58)

    ctx.font = '22px monospace'
    ctx.fillStyle = s.sub
    ctx.fillText(label, x + w / 2, y + 98)
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
