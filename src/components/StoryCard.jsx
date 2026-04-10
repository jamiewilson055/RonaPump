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
    const px = 72
    const cw = W - px * 2

    // ── BACKGROUND ──
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle accent glow top-right
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 600)
    glow.addColorStop(0, hexA(accent, 0.05))
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    let y = 80

    // ── LOGO ROW ──
    ctx.font = '700 46px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = text
    const ronaW = ctx.measureText('RONA').width
    ctx.fillText('RONA', px, y)
    ctx.fillStyle = accent
    ctx.fillText('PUMP', px + ronaW, y)

    // ── HARAMBE CIRCLE ──
    const imgSize = 90
    const imgR = imgSize / 2
    const imgCx = W - px - imgR
    const imgCy = y - 10
    const borderW = 3

    if (imgRef.current) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(imgCx, imgCy, imgR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(imgRef.current, imgCx - imgR, imgCy - imgR, imgSize, imgSize)
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(imgCx, imgCy, imgR + borderW / 2, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = borderW
    ctx.stroke()

    // ── ACCENT DIVIDER ──
    y += 18
    const dividerEnd = imgCx - imgR - 20
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(px, y, dividerEnd - px, 5, 3)
    ctx.fill()

    // ── "WORKOUT COMPLETE" LABEL ──
    y += 36
    ctx.font = '500 24px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = hexA(text, 0.45)
    ctx.letterSpacing = '5px'
    ctx.fillText('WORKOUT COMPLETE', px, y)
    ctx.letterSpacing = '0px'

    // ── WORKOUT NAME (in quotes) ──
    y += 16
    ctx.font = '700 62px sans-serif'
    ctx.fillStyle = text
    ctx.textAlign = 'left'
    const nameRaw = workout?.name || 'Workout'
    const nameLines = wrapLines(ctx, "' " + nameRaw + " '", cw)
    for (const nl of nameLines) {
      y += 62
      ctx.fillText(nl, px, y)
    }

    // ── TAGS ROW ──
    y += 24
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
      let tx = px
      const tagH = 40, tagPad = 18, tagGap = 10, tagFont = 24
      for (const tag of tags) {
        ctx.font = '600 ' + tagFont + 'px sans-serif'
        const tw = ctx.measureText(tag.label).width + tagPad * 2
        if (tx + tw > W - px) break

        if (tag.color === 'category') {
          ctx.fillStyle = hexA(accent, 0.14)
        } else if (tag.color === 'duration') {
          ctx.fillStyle = hexA(dur, 0.14)
        } else {
          ctx.fillStyle = hexA(text, 0.06)
        }
        ctx.beginPath()
        ctx.roundRect(tx, y, tw, tagH, 20)
        ctx.fill()

        if (tag.color === 'category') {
          ctx.fillStyle = accent
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else if (tag.color === 'duration') {
          ctx.fillStyle = dur
          ctx.font = '700 ' + tagFont + 'px sans-serif'
        } else {
          ctx.fillStyle = hexA(text, 0.55)
          ctx.font = '500 ' + tagFont + 'px sans-serif'
        }
        ctx.textAlign = 'left'
        ctx.fillText(tag.label, tx + tagPad, y + 28)
        tx += tw + tagGap
      }
      y += tagH + 20
    } else {
      y += 12
    }

    // ── WORKOUT DESCRIPTION (abbreviated) ──
    let desc = workout?.description || ''
    if (workout?.name) {
      const nm = workout.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      desc = desc.replace(new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi'), '')
      desc = desc.replace(/^\s*[\n\r]+/, '')
      desc = desc.replace(/^\s*[-:](?!-)\s*/, '')
    }
    desc = desc.replace(/[\{\}]/g, '').trim()

    if (desc) {
      const rawLines = desc.split('\n')
      const descFontSize = 38
      const descLineH = 50
      const descBottom = y + 520

      for (const rl of rawLines) {
        if (y + descFontSize > descBottom) break
        const trimmed = rl.trim()
        if (trimmed === '') { y += descLineH * 0.5; continue }

        if (trimmed.startsWith('---')) {
          const sectionText = trimmed.replace(/^-{3,}\s*/, '').trim()
          if (!sectionText) {
            y += 10
            ctx.fillStyle = hexA(accent, 0.35)
            ctx.beginPath()
            ctx.roundRect(px, y, cw, 3, 2)
            ctx.fill()
            y += 18
            continue
          }
          y += 8
          ctx.font = '700 ' + descFontSize + 'px sans-serif'
          ctx.fillStyle = accent
          ctx.textAlign = 'left'
          const wrapped = wrapLines(ctx, sectionText.toUpperCase(), cw)
          for (const wl of wrapped) {
            if (y + descFontSize > descBottom) break
            ctx.fillText(wl, px, y + descFontSize)
            y += descLineH
          }
          y += 4
          continue
        }

        const isLabel = /^[\w].*:$/.test(trimmed) || /^(Part [A-Z]|Round \d)/i.test(trimmed)

        let lineText = trimmed
        let indent = 0
        if (lineText.startsWith('  \u2022 ') || lineText.startsWith('  - ')) {
          lineText = lineText.slice(4); indent = 36
        } else if (lineText.startsWith('\u2022 ')) {
          lineText = lineText.slice(2)
        } else if (lineText.startsWith('- ')) {
          lineText = lineText.slice(2)
        }

        if (isLabel) {
          y += 4
          ctx.font = '700 ' + descFontSize + 'px sans-serif'
          ctx.fillStyle = accent
          lineText = lineText.toUpperCase()
        } else {
          ctx.font = descFontSize + 'px sans-serif'
          ctx.fillStyle = hexA(text, 0.88)
        }

        ctx.textAlign = 'left'
        const isBullet = trimmed.startsWith('\u2022 ') || trimmed.startsWith('  \u2022 ') || trimmed.startsWith('- ') || trimmed.startsWith('  - ')
        const bulletPrefix = isBullet ? '\u2022  ' : ''
        const bpW = bulletPrefix ? ctx.measureText(bulletPrefix).width : 0
        const wrapped = wrapLines(ctx, lineText, cw - indent - bpW)

        for (let wi = 0; wi < wrapped.length; wi++) {
          if (y + descFontSize > descBottom) break
          const prefix = (wi === 0 && bulletPrefix) ? bulletPrefix : (wi > 0 && bulletPrefix ? '    ' : '')
          ctx.fillText(prefix + wrapped[wi], px + indent, y + descFontSize)
          y += descLineH
        }
      }
    }

    // ── SCORE SECTION ──
    y = Math.max(y + 30, 1050)

    if (score) {
      ctx.font = '500 24px monospace'
      ctx.fillStyle = hexA(text, 0.45)
      ctx.textAlign = 'left'
      ctx.letterSpacing = '4px'
      ctx.fillText('YOUR SCORE', px, y)
      ctx.letterSpacing = '0px'

      y += 14
      ctx.font = '700 96px monospace'
      ctx.fillStyle = accent
      ctx.textAlign = 'left'
      ctx.fillText(score, px, y + 80)
      y += 110

      y += 16
      ctx.fillStyle = hexA(text, 0.08)
      ctx.fillRect(px, y, cw, 1)
      y += 30
    } else {
      y += 20
    }

    // ── STATS ROW ──
    y = Math.max(y, 1300)
    const statW = Math.floor((cw - 24) / 3)

    function drawStat(x, value, label) {
      ctx.fillStyle = hexA(text, 0.04)
      ctx.beginPath()
      ctx.roundRect(x, y, statW, 120, 12)
      ctx.fill()

      ctx.textAlign = 'center'
      ctx.font = '700 44px monospace'
      ctx.fillStyle = text
      ctx.fillText(value, x + statW / 2, y + 52)

      ctx.font = '500 20px monospace'
      ctx.fillStyle = hexA(text, 0.45)
      ctx.fillText(label, x + statW / 2, y + 92)
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    drawStat(px, `${streak}`, 'STREAK')
    drawStat(px + statW + 12, dateStr.toUpperCase(), 'DATE')
    if (workout?.estimated_duration_mins) {
      drawStat(px + (statW + 12) * 2, `${workout.estimated_duration_mins}m`, 'DURATION')
    } else if (workout?.score_type && workout.score_type !== 'None') {
      drawStat(px + (statW + 12) * 2, workout.score_type.slice(0, 8), 'TYPE')
    } else {
      drawStat(px + (statW + 12) * 2, '\u{1F98D}', 'RONA')
    }

    // ── USER INFO ──
    y += 170
    const userName = profile?.display_name || 'Athlete'
    const rank = profile?.gorilla_rank || 'Baby Gorilla'

    ctx.textAlign = 'left'
    ctx.font = '700 40px sans-serif'
    ctx.fillStyle = text
    ctx.fillText(userName, px, y)

    ctx.font = '500 28px sans-serif'
    ctx.fillStyle = accent
    ctx.fillText(rank, px, y + 40)

    // ── FOOTER ──
    const footerY = H - 72
    ctx.fillStyle = hexA(text, 0.08)
    ctx.fillRect(px, footerY, cw, 1)

    ctx.font = '500 28px monospace'
    ctx.fillStyle = hexA(text, 0.6)
    ctx.textAlign = 'left'
    ctx.fillText('ronapump.com', px, footerY + 44)
    ctx.textAlign = 'right'
    ctx.fillText('@ronapump', W - px, footerY + 44)
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
