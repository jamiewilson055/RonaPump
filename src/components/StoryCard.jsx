import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StoryCard({ workout, score, session, onClose }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(0)
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
  }, [profile, streak, style, workout, score, imgLoaded])

  async function loadData() {
    const { data: p } = await supabase.from('profiles').select('display_name, gorilla_rank, xp').eq('id', session.user.id).single()
    if (p) setProfile(p)

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
    const W = 1080, H = 1920
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

    // Subtle accent glow center-top
    const glow = ctx.createRadialGradient(cx, 200, 0, cx, 200, 500)
    glow.addColorStop(0, hexA(accent, 0.04))
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    // ── RONAPUMP LOGO (centered) ──
    let y = 120
    ctx.font = '700 42px monospace'
    ctx.textAlign = 'center'
    const ronaW = ctx.measureText('RONA').width
    const pumpW = ctx.measureText('PUMP').width
    const logoW = ronaW + pumpW
    ctx.fillStyle = text
    ctx.fillText('RONA', cx - logoW / 2 + ronaW / 2, y)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', cx + pumpW / 2, y)

    // ── HARAMBE CIRCLE (centered) ──
    y += 50
    const imgSize = 130
    const imgR = imgSize / 2
    const imgCy = y + imgR
    const borderW = 3.5

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

    // ── "WORKOUT COMPLETE" with flanking accent lines ──
    y = imgCy + imgR + 60
    ctx.font = '500 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = hexA(text, 0.4)
    ctx.letterSpacing = '5px'
    const wcText = '\u2713  WORKOUT COMPLETE'
    const wcW = ctx.measureText(wcText).width
    ctx.fillText(wcText, cx, y)
    ctx.letterSpacing = '0px'

    // Flanking lines
    const lineGap = 20
    const lineLen = 80
    ctx.fillStyle = hexA(accent, 0.35)
    ctx.fillRect(cx - wcW / 2 - lineGap - lineLen, y - 4, lineLen, 2)
    ctx.fillRect(cx + wcW / 2 + lineGap, y - 4, lineLen, 2)

    // ── WORKOUT NAME (centered, in quotes) ──
    y += 50
    ctx.font = '700 64px sans-serif'
    ctx.fillStyle = text
    ctx.textAlign = 'center'
    const nameRaw = workout?.name || 'Workout'
    const nameLines = wrapLines(ctx, "' " + nameRaw + " '", W - 140)
    for (const nl of nameLines) {
      y += 68
      ctx.fillText(nl, cx, y)
    }

    // ── TAGS (centered) ──
    y += 30
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
      const tagH = 38, tagPad = 16, tagGap = 10, tagFont = 22
      // Measure total width to center
      let totalW = -tagGap
      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        totalW += ctx.measureText(tag.label).width + tagPad * 2 + tagGap
      }
      let tx = cx - totalW / 2

      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        const tw = ctx.measureText(tag.label).width + tagPad * 2

        if (tag.color === 'category') {
          ctx.fillStyle = hexA(accent, 0.14)
        } else if (tag.color === 'duration') {
          ctx.fillStyle = hexA(dur, 0.14)
        } else {
          ctx.fillStyle = hexA(text, 0.06)
        }
        ctx.beginPath()
        ctx.roundRect(tx, y, tw, tagH, 19)
        ctx.fill()

        if (tag.color === 'category') {
          ctx.fillStyle = accent
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else if (tag.color === 'duration') {
          ctx.fillStyle = dur
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else {
          ctx.fillStyle = hexA(text, 0.5)
          ctx.font = '500 ' + tagFont + 'px sans-serif'
        }
        ctx.textAlign = 'center'
        ctx.fillText(tag.label, tx + tw / 2, y + 26)
        tx += tw + tagGap
      }
      y += tagH
    }

    // ── SCORE SECTION (the hero) ──
    if (score) {
      y = Math.max(y + 80, 900)

      // Score label
      ctx.font = '500 22px monospace'
      ctx.fillStyle = hexA(text, 0.4)
      ctx.textAlign = 'center'
      ctx.letterSpacing = '4px'
      ctx.fillText('YOUR SCORE', cx, y)
      ctx.letterSpacing = '0px'

      // The score — MASSIVE
      y += 20
      ctx.font = '700 140px monospace'
      ctx.fillStyle = accent
      ctx.textAlign = 'center'
      ctx.fillText(score, cx, y + 110)
      y += 130

      // Score type below
      if (workout?.score_type && workout.score_type !== 'None') {
        y += 16
        ctx.font = '500 26px monospace'
        ctx.fillStyle = hexA(text, 0.35)
        ctx.fillText(workout.score_type.toUpperCase(), cx, y)
      }
    } else {
      // No score — add generous space
      y = Math.max(y + 60, 900)
    }

    // ── STATS LINE (centered, horizontal, clean) ──
    y = Math.max(y + 80, 1300)
    const stats = []
    if (streak > 0) stats.push(`\uD83D\uDD25 ${streak} day streak`)
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    stats.push(dateStr)
    if (workout?.estimated_duration_mins) stats.push(workout.estimated_duration_mins + ' min')

    ctx.font = '500 26px sans-serif'
    ctx.fillStyle = hexA(text, 0.4)
    ctx.textAlign = 'center'
    const statsText = stats.join('   \u00B7   ')
    ctx.fillText(statsText, cx, y)

    // ── USER INFO (centered) ──
    y += 80
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.font = '700 44px sans-serif'
    ctx.fillStyle = text
    ctx.textAlign = 'center'
    ctx.fillText(userName, cx, y)

    ctx.font = '500 28px sans-serif'
    ctx.fillStyle = accent
    ctx.fillText(rank, cx, y + 42)

    // ── FOOTER ──
    const footerY = H - 90
    ctx.fillStyle = hexA(text, 0.08)
    ctx.fillRect(100, footerY, W - 200, 1)

    ctx.font = '500 26px monospace'
    ctx.fillStyle = hexA(text, 0.5)
    ctx.textAlign = 'center'
    ctx.fillText('ronapump.com  \u00B7  @ronapump', cx, footerY + 42)
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
