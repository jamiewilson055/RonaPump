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
    { name: 'Dark', bg: '#0a0a0e', txt: '#ffffff', accent: '#e01e1e', dur: '#2dd4bf' },
    { name: 'Light', bg: '#f5f0e8', txt: '#1a1a1a', accent: '#c41818', dur: '#0f8a6e' },
  ]

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.src = '/harambe.png'
  }, [])

  useEffect(() => { if (session) loadData() }, [session])
  useEffect(() => { if (imgLoaded) drawCard() }, [profile, streak, totalWorkouts, style, workout, score, imgLoaded])

  async function loadData() {
    const { data: p } = await supabase.from('profiles').select('display_name, gorilla_rank, xp').eq('id', session.user.id).single()
    if (p) setProfile(p)
    const { data: logs } = await supabase.from('performance_log').select('completed_at').eq('user_id', session.user.id).order('completed_at', { ascending: false }).limit(500)
    if (logs) {
      setTotalWorkouts(logs.length)
      const dates = new Set(logs.map(l => l.completed_at))
      let s = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        if (dates.has(d.toISOString().slice(0, 10))) s++
        else if (i > 0) break
      }
      setStreak(s)
    }
  }

  function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }

  function wrapCenter(ctx, str, maxW) {
    const words = str.split(' ')
    const lines = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
      else line = test
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  function drawCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 1080, H = 1080
    canvas.width = W; canvas.height = H

    const s = STYLES[style]
    const accent = s.accent, clr = s.txt, bg = s.bg, dur = s.dur
    const cx = W / 2, px = 80

    // ── BACKGROUND ──
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // ═══════════════════════════════════════
    // HEADER ROW: Harambe (left) + Logo (right)
    // ═══════════════════════════════════════
    const hdrY = 60
    const imgSz = 80, imgR = imgSz / 2

    // Harambe circle (left side)
    if (imgRef.current) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(px + imgR, hdrY + imgR, imgR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imgRef.current, px, hdrY, imgSz, imgSz)
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(px + imgR, hdrY + imgR, imgR + 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke()

    // RONAPUMP logo (right-aligned to Harambe)
    ctx.font = '700 34px monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = clr
    const pumpW = ctx.measureText('PUMP').width
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', W - px - pumpW, hdrY + 45)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', W - px, hdrY + 45)

    // Accent line under header
    const hdrBottom = hdrY + imgSz + 20
    ctx.fillStyle = accent
    ctx.fillRect(px, hdrBottom, W - px * 2, 3)

    // ═══════════════════════════════════════
    // WORKOUT COMPLETE
    // ═══════════════════════════════════════
    let y = hdrBottom + 44
    ctx.font = '700 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = accent
    ctx.letterSpacing = '4px'
    ctx.fillText('WORKOUT COMPLETE', cx, y)
    ctx.letterSpacing = '0px'

    // ═══════════════════════════════════════
    // WORKOUT NAME
    // ═══════════════════════════════════════
    y += 44
    const nameSize = score ? 70 : 90
    ctx.font = '700 ' + nameSize + 'px sans-serif'
    ctx.fillStyle = clr
    ctx.textAlign = 'center'
    const nameStr = "' " + (workout?.name || 'Workout') + " '"
    const nameLines = wrapCenter(ctx, nameStr, W - 120)
    for (const nl of nameLines) {
      ctx.fillText(nl, cx, y)
      y += nameSize + 8
    }

    // ═══════════════════════════════════════
    // TAGS
    // ═══════════════════════════════════════
    y += 4
    const tags = []
    const cats = (workout?.categories || []).slice(0, 2)
    cats.forEach(c => tags.push({ label: c, type: 'cat' }))
    if (workout?.estimated_duration_mins) {
      tags.push({ label: workout.estimated_duration_mins + ' min', type: 'dur' })
    } else if (workout?.estimated_duration_min && workout?.estimated_duration_max) {
      tags.push({ label: workout.estimated_duration_min + '-' + workout.estimated_duration_max + ' min', type: 'dur' })
    }
    ;(workout?.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 3).forEach(e => tags.push({ label: e, type: 'eq' }))

    if (tags.length) {
      const tH = 36, tP = 14, tG = 8, tF = 21
      let tw = -tG
      for (const t of tags) { ctx.font = '600 ' + tF + 'px sans-serif'; tw += ctx.measureText(t.label).width + tP * 2 + tG }
      let tx = cx - tw / 2
      for (const t of tags) {
        ctx.font = '600 ' + tF + 'px sans-serif'
        const w = ctx.measureText(t.label).width + tP * 2
        ctx.fillStyle = t.type === 'cat' ? hexA(accent, 0.14) : t.type === 'dur' ? hexA(dur, 0.14) : hexA(clr, 0.06)
        ctx.beginPath(); ctx.roundRect(tx, y, w, tH, 18); ctx.fill()
        ctx.fillStyle = t.type === 'cat' ? accent : t.type === 'dur' ? dur : hexA(clr, 0.5)
        ctx.font = (t.type === 'eq' ? '500 ' : '700 ') + tF + 'px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(t.label, tx + w / 2, y + 24)
        tx += w + tG
      }
      y += tH + 16
    }

    // ═══════════════════════════════════════
    // SCORE SECTION
    // ═══════════════════════════════════════
    if (score) {
      // Divider before score
      y += 10
      ctx.fillStyle = hexA(clr, 0.08)
      ctx.fillRect(px, y, W - px * 2, 1)
      y += 32

      ctx.font = '500 22px monospace'
      ctx.fillStyle = hexA(clr, 0.4)
      ctx.textAlign = 'center'
      ctx.letterSpacing = '3px'
      ctx.fillText('YOUR SCORE', cx, y)
      ctx.letterSpacing = '0px'
      y += 16

      // The score — BIG
      ctx.font = '700 130px monospace'
      ctx.fillStyle = accent
      const scoreStr = String(score)
      if (ctx.measureText(scoreStr).width > W - 160) ctx.font = '700 90px monospace'
      ctx.fillText(scoreStr, cx, y + 100)
      y += 112

      if (workout?.score_type && workout.score_type !== 'None') {
        y += 4
        ctx.font = '500 26px monospace'
        ctx.fillStyle = hexA(clr, 0.3)
        ctx.fillText(workout.score_type.toUpperCase(), cx, y)
        y += 20
      }
    }

    // ═══════════════════════════════════════
    // PERSONAL INFO
    // ═══════════════════════════════════════
    // Divider
    y += 16
    ctx.fillStyle = hexA(clr, 0.08)
    ctx.fillRect(px, y, W - px * 2, 1)
    y += 32

    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.font = '700 38px sans-serif'
    ctx.fillStyle = clr
    ctx.textAlign = 'center'
    ctx.fillText(userName, cx, y)
    y += 32

    ctx.font = '600 26px sans-serif'
    ctx.fillStyle = accent
    ctx.fillText(rank, cx, y)
    y += 34

    // Date line with optional streak and total
    const parts = []
    parts.push(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    if (streak >= 3) parts.push('\uD83D\uDD25 ' + streak + ' day streak')
    if (totalWorkouts > 1) parts.push('#' + totalWorkouts)
    ctx.font = '400 22px sans-serif'
    ctx.fillStyle = hexA(clr, 0.35)
    ctx.fillText(parts.join('  \u00B7  '), cx, y)

    // ═══════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════
    y += 40
    ctx.fillStyle = hexA(clr, 0.06)
    ctx.fillRect(px, y, W - px * 2, 1)
    y += 28
    ctx.font = '500 22px monospace'
    ctx.fillStyle = hexA(clr, 0.4)
    ctx.textAlign = 'center'
    ctx.fillText('ronapump.com  \u00B7  @ronapump', cx, y)
  }

  function downloadImage() {
    drawCard()
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `ronapump-${(workout?.name || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-story.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setDownloaded(true); setTimeout(() => setDownloaded(false), 2000)
  }

  async function copyImage() {
    drawCard()
    const canvas = canvasRef.current
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setDownloaded(true); setTimeout(() => setDownloaded(false), 2000)
    } catch { downloadImage() }
  }

  return (
    <div className="mo" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mc" style={{ maxWidth: '480px' }}>
        <h2 style={{ marginBottom: '4px' }}>📸 Story Card</h2>
        <p style={{ fontSize: '12px', color: 'var(--tx3)', marginBottom: '10px' }}>Share your workout completion on Instagram.</p>
        <div className="story-styles">
          {STYLES.map((st, i) => (
            <button key={i} className={`story-style-btn${style === i ? ' on' : ''}`}
              style={{ background: st.bg, borderColor: style === i ? st.accent : 'var(--brd)' }}
              onClick={() => setStyle(i)}>
              <span style={{ color: st.accent, fontSize: '10px', fontWeight: 700 }}>{st.name}</span>
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
