import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StoryCard({ workout, score, session, onClose }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(0)
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [downloaded, setDownloaded] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [style, setStyle] = useState(1)

  const STYLES = [
    { name: 'Dark', bg: '#0a0a0e', text: '#ffffff', accent: '#e01e1e', dur: '#2dd4bf' },
    { name: 'Light', bg: '#f5f0e8', text: '#1a1a1a', accent: '#c41818', dur: '#0f8a6e' },
  ]

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = '/harambe.png'
  }, [])

  useEffect(() => {
    if (session) loadData()
  }, [session])

  useEffect(() => {
    if (imgLoaded) drawCard()
  }, [profile, streak, totalWorkouts, style, workout, score, imgLoaded])

  async function loadData() {
    const { data: p } = await supabase.from('profiles').select('display_name, gorilla_rank, xp').eq('id', session.user.id).single()
    if (p) setProfile(p)

    const { data: logs } = await supabase
      .from('performance_log')
      .select('completed_at')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(500)

    if (logs) {
      setTotalWorkouts(logs.length)
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

  function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }

  function wrapLines(ctx, lineText, maxW) {
    const words = lineText.split(' ')
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

  function drawCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 1080, H = 1350
    canvas.width = W
    canvas.height = H

    const st = STYLES[style]
    const accent = st.accent
    const text = st.text
    const bg = st.bg
    const dur = st.dur
    const cx = W / 2

    // ── BACKGROUND ──
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Warm glow behind Harambe area
    const glow = ctx.createRadialGradient(cx, 220, 0, cx, 220, 400)
    glow.addColorStop(0, hexA(accent, 0.04))
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    // ── RONAPUMP LOGO (centered) ──
    ctx.font = '700 44px monospace'
    const ronaW = ctx.measureText('RONA').width
    const pumpW = ctx.measureText('PUMP').width
    const logoTotal = ronaW + pumpW
    ctx.textAlign = 'left'
    ctx.fillStyle = text
    ctx.fillText('RONA', cx - logoTotal / 2, 72)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', cx - logoTotal / 2 + ronaW, 72)

    // ── HARAMBE (centered, big) ──
    const imgSize = 180
    const imgR = imgSize / 2
    const imgCy = 200
    const borderW = 4

    if (imgRef.current) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, imgCy, imgR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imgRef.current, cx - imgR, imgCy - imgR, imgSize, imgSize)
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(cx, imgCy, imgR + borderW / 2, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = borderW
    ctx.stroke()

    // ── "WORKOUT COMPLETE" (bold, accent, prominent) ──
    let y = imgCy + imgR + 50
    ctx.font = '700 38px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = accent
    ctx.letterSpacing = '3px'
    ctx.fillText('WORKOUT COMPLETE', cx, y)
    ctx.letterSpacing = '0px'

    // ── WORKOUT NAME (centered, in quotes) ──
    y += 50
    const nameSize = score ? 66 : 76
    ctx.font = '700 ' + nameSize + 'px sans-serif'
    ctx.fillStyle = text
    ctx.textAlign = 'center'
    const nameRaw = workout?.name || 'Workout'
    const nameLines = wrapLines(ctx, "' " + nameRaw + " '", W - 120)
    for (const nl of nameLines) {
      ctx.fillText(nl, cx, y)
      y += nameSize + 8
    }

    // ── TAGS (centered) ──
    y += 6
    const tags = []
    const cats = (workout?.categories || []).slice(0, 2)
    cats.forEach(c => tags.push({ label: c, color: 'category' }))
    if (workout?.estimated_duration_mins) {
      tags.push({ label: workout.estimated_duration_mins + ' min', color: 'duration' })
    } else if (workout?.estimated_duration_min && workout?.estimated_duration_max) {
      tags.push({ label: workout.estimated_duration_min + '-' + workout.estimated_duration_max + ' min', color: 'duration' })
    }
    const equip = (workout?.equipment || []).filter(e => e !== 'Bodyweight')
    equip.slice(0, 3).forEach(e => tags.push({ label: e, color: 'equip' }))

    if (tags.length) {
      const tagH = 40, tagPad = 16, tagGap = 10, tagFont = 22
      let totalTagW = -tagGap
      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        totalTagW += ctx.measureText(tag.label).width + tagPad * 2 + tagGap
      }
      let tx = cx - totalTagW / 2

      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        const tw = ctx.measureText(tag.label).width + tagPad * 2

        ctx.fillStyle = tag.color === 'category' ? hexA(accent, 0.14)
          : tag.color === 'duration' ? hexA(dur, 0.14)
          : hexA(text, 0.06)
        ctx.beginPath()
        ctx.roundRect(tx, y, tw, tagH, 20)
        ctx.fill()

        ctx.fillStyle = tag.color === 'category' ? accent
          : tag.color === 'duration' ? dur
          : hexA(text, 0.5)
        ctx.font = (tag.color === 'equip' ? '500 ' : '700 ') + tagFont + 'px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(tag.label, tx + tw / 2, y + 27)
        tx += tw + tagGap
      }
      y += tagH
    }

    // ── SCORE (the hero — only when score exists) ──
    if (score) {
      y += 50

      // Accent circle behind score
      const scoreCy = y + 80
      ctx.beginPath()
      ctx.arc(cx, scoreCy, 130, 0, Math.PI * 2)
      ctx.fillStyle = hexA(accent, 0.06)
      ctx.fill()

      ctx.font = '500 22px monospace'
      ctx.fillStyle = hexA(text, 0.4)
      ctx.textAlign = 'center'
      ctx.letterSpacing = '3px'
      ctx.fillText('YOUR SCORE', cx, y + 10)
      ctx.letterSpacing = '0px'

      // Score value
      ctx.font = '700 140px monospace'
      ctx.fillStyle = accent
      const scoreStr = String(score)
      if (ctx.measureText(scoreStr).width > W - 160) {
        ctx.font = '700 100px monospace'
      }
      ctx.fillText(scoreStr, cx, y + 130)

      // Score type
      if (workout?.score_type && workout.score_type !== 'None') {
        ctx.font = '500 26px monospace'
        ctx.fillStyle = hexA(text, 0.35)
        ctx.fillText(workout.score_type.toUpperCase(), cx, y + 170)
      }

      y += 200
    } else {
      y += 40
    }

    // ── PERSONAL INFO ──
    const infoY = score ? Math.max(y + 20, 1020) : Math.max(y + 40, 900)
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.font = '700 46px sans-serif'
    ctx.fillStyle = text
    ctx.textAlign = 'center'
    ctx.fillText(userName, cx, infoY)

    ctx.font = '600 28px sans-serif'
    ctx.fillStyle = accent
    ctx.fillText(rank, cx, infoY + 42)

    // Streak (only if 3+)
    let subY = infoY + 84
    if (streak >= 3) {
      ctx.font = '500 26px sans-serif'
      ctx.fillStyle = hexA(text, 0.45)
      ctx.fillText('\uD83D\uDD25 ' + streak + ' day streak', cx, subY)
      subY += 36
    }

    // Total workouts
    if (totalWorkouts > 1) {
      ctx.font = '400 24px sans-serif'
      ctx.fillStyle = hexA(text, 0.3)
      ctx.fillText('Workout #' + totalWorkouts, cx, subY)
      subY += 36
    }

    // Date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    ctx.font = '400 24px sans-serif'
    ctx.fillStyle = hexA(text, 0.25)
    ctx.fillText(dateStr, cx, subY)

    // ── FOOTER ──
    const footerY = H - 60
    ctx.fillStyle = hexA(text, 0.08)
    ctx.fillRect(120, footerY, W - 240, 1)

    ctx.font = '500 24px monospace'
    ctx.fillStyle = hexA(text, 0.45)
    ctx.textAlign = 'center'
    ctx.fillText('ronapump.com  \u00B7  @ronapump', cx, footerY + 36)
  }

  function downloadImage() {
    drawCard()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `ronapump-${(workout?.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-story.png`
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
        <h2 style={{ marginBottom: '4px' }}>📸 Story Card</h2>
        <p style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' }}>
          Share your workout completion to Instagram Stories.
        </p>
        <div className="story-styles">
          {STYLES.map((s, i) => (
            <button key={i} className={`story-style-btn${style === i ? ' on' : ''}`}
              style={{ background: s.bg, borderColor: style === i ? s.accent : 'var(--brd)' }}
              onClick={() => setStyle(i)}>
              <span style={{ color: s.accent, fontSize: '10px', fontWeight: 700 }}>{s.name}</span>
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--brd)' }} />
        <div className="mf" style={{ marginTop: '10px' }}>
          <button className="ab" onClick={onClose}>Close</button>
          <button className="ab" onClick={copyImage}>{downloaded ? '✓ Copied!' : '📋 Copy'}</button>
          <button className="ab p" onClick={downloadImage}>{downloaded ? '✓ Done!' : '📥 Download'}</button>
        </div>
      </div>
    </div>
  )
}
