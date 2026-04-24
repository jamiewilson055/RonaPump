import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

// Strip redundant workout name from start of description (mirrors WorkoutCard cleanDesc)
function cleanDesc(name, description) {
  let d = description || ''
  if (name) {
    const nm = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const p1 = new RegExp('[\\u201c"\\u201d]\\s*' + nm + '\\s*[\\u201c"\\u201d]\\s*[-:.]?\\s*', 'gi')
    d = d.replace(p1, '')
    d = d.replace(/^\s*[\n\r]+/, '').replace(/^\s*[-:]\s*/, '')
  }
  d = d.replace(/[\{\}]/g, '').trim()
  return d
}

// Escape HTML then convert **bold** → <strong>
function renderBold(str) {
  const esc = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

// Convert app-style markers to email-safe HTML (mirrors WorkoutCard/WODCard formatDesc)
// Uses padding-left + negative text-indent hanging indent — renders correctly in Gmail,
// Apple Mail, Outlook desktop/web, and mobile clients (no position:absolute required).
function formatDescForEmail(text) {
  if (!text) return ''
  return text.split('\n').map(line => {
    // Sub-bullet: '  • ' → deeper indent, hollow circle, dimmer text
    if (line.startsWith('  • ')) {
      return `<div style="padding: 2px 0 2px 40px; text-indent: -20px; color: #9090a0;"><span style="color: #6e6e7a;">◦ </span>${renderBold(line.slice(4))}</div>`
    }
    // Top-level bullet: '• ' → indented, red bullet
    if (line.startsWith('• ')) {
      return `<div style="padding: 2px 0 2px 20px; text-indent: -20px;"><span style="color: #e01e1e;">• </span>${renderBold(line.slice(2))}</div>`
    }
    // Section header: '--- ' → bold uppercase red, matches app
    if (line.startsWith('--- ')) {
      return `<div style="font-weight: 700; text-transform: uppercase; color: #e01e1e; font-size: 12px; letter-spacing: 0.5px; margin: 12px 0 4px;">${renderBold(line.slice(4))}</div>`
    }
    // Empty line → spacer
    if (line.trim() === '') return `<div style="height: 8px;"></div>`
    // Regular line
    return `<div style="padding: 2px 0;">${renderBold(line)}</div>`
  }).join('')
}

export default async function handler(req, res) {
  // Verify cron secret or allow manual trigger from admin
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow GET for testing
    if (req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    // Pick a random official workout
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, name, description, equipment, workout_types, estimated_duration_mins')
      .eq('visibility', 'official')
      .not('name', 'is', null)

    if (!workouts || workouts.length === 0) {
      return res.status(200).json({ message: 'No workouts found' })
    }

    const wod = workouts[Math.floor(Math.random() * workouts.length)]

    // Get subscribers
    const { data: subs } = await supabase
      .from('email_subscribers')
      .select('email')
      .eq('subscribed', true)

    if (!subs || subs.length === 0) {
      return res.status(200).json({ message: 'No subscribers', wod: wod.name })
    }

    // Format workout details — match app rendering exactly
    const cleanedDesc = cleanDesc(wod.name, wod.description)
    const descHtml = formatDescForEmail(cleanedDesc)
    const equipment = (wod.equipment || []).filter(e => e !== 'Bodyweight').join(', ') || 'Bodyweight'
    const duration = wod.estimated_duration_mins ? `${wod.estimated_duration_mins} min` : ''
    const types = (wod.workout_types || []).join(', ')
    const slug = wod.name ? wod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
    const link = `https://www.ronapump.com/workout/${slug}`

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return res.status(200).json({ message: 'No Resend key configured', wod: wod.name, subscribers: subs.length })
    }

    // Send individual emails so each has a personalized unsubscribe link
    let sent = 0
    let errors = []

    for (const sub of subs) {
      const unsubLink = `https://www.ronapump.com/api/unsubscribe?email=${encodeURIComponent(sub.email)}`

      const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0f; color: #ededf0; border-radius: 12px; overflow: hidden;">
      <div style="background: #e01e1e; padding: 20px 24px; text-align: center;">
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 1px;">🦍 RONAPUMP</div>
        <div style="font-size: 12px; color: rgba(255,255,255,.7); margin-top: 4px;">WORKOUT OF THE DAY</div>
      </div>
      <div style="padding: 24px;">
        <div style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">${wod.name}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          ${duration ? `<span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${duration}</span>` : ''}
          ${types ? `<span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${types}</span>` : ''}
          <span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${equipment}</span>
        </div>
        <div style="font-size: 14px; line-height: 1.7; color: #ededf0; margin-bottom: 20px;">${descHtml}</div>
        <a href="${link}" style="display: block; background: #e01e1e; color: white; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none;">Open Workout →</a>
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #1a1a25; text-align: center; font-size: 11px; color: #6e6e7a;">
        <a href="https://www.ronapump.com" style="color: #6e6e7a;">www.ronapump.com</a> · You're receiving this because you subscribed to the Daily WOD.
        <br><a href="${unsubLink}" style="color: #6e6e7a; text-decoration: underline;">Unsubscribe</a>
      </div>
    </div>`

      try {
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'RonaPump 🦍 <harambe@ronapump.com>',
            to: [sub.email],
            subject: `🦍 WOD: ${wod.name}`,
            html: html,
            headers: {
              'List-Unsubscribe': `<${unsubLink}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })
        })
        const sendData = await sendRes.json()
        if (sendData.id) sent++
        else errors.push({ email: sub.email, error: sendData })
      } catch (err) {
        errors.push({ email: sub.email, error: err.message })
      }
    }

    // Log to digest_log
    await supabase.from('digest_log').insert({
      type: 'daily_wod',
      workout_id: wod.id,
      recipients: sent,
      sent_at: new Date().toISOString(),
    })

    return res.status(200).json({
      message: 'Daily WOD sent',
      wod: wod.name,
      sent,
      total: subs.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
