import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

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

    const emails = subs.map(s => s.email)

    // Format workout description (first 300 chars, clean up)
    const desc = (wod.description || '').replace(/\*\*/g, '').slice(0, 300)
    const equipment = (wod.equipment || []).filter(e => e !== 'Bodyweight').join(', ') || 'Bodyweight'
    const duration = wod.estimated_duration_mins ? `${wod.estimated_duration_mins} min` : ''
    const types = (wod.workout_types || []).join(', ')
    const slug = wod.name ? wod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
    const link = `https://www.ronapump.com/workout/${slug}`

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0f; color: #ededf0; border-radius: 12px; overflow: hidden;">
      <div style="background: #e01e1e; padding: 20px 24px; text-align: center;">
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 1px;">🦍 RONAPUMP</div>
        <div style="font-size: 12px; color: rgba(255,255,255,.7); margin-top: 4px;">WORKOUT OF THE DAY</div>
      </div>
      <div style="padding: 24px;">
        <div style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">${wod.name}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          ${duration ? `<span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${duration}</span>` : ''}
          ${types ? `<span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${types}</span>` : ''}
          <span style="background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 12px; font-size: 12px;">${equipment}</span>
        </div>
        <div style="font-size: 14px; line-height: 1.7; color: #b0b0b8; white-space: pre-line; margin-bottom: 20px;">${desc}${wod.description.length > 300 ? '...' : ''}</div>
        <a href="${link}" style="display: block; background: #e01e1e; color: white; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none;">Open Workout →</a>
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #1a1a25; text-align: center; font-size: 11px; color: #6e6e7a;">
        <a href="https://www.ronapump.com" style="color: #6e6e7a;">www.ronapump.com</a> · You're receiving this because you subscribed to the Daily WOD.
      </div>
    </div>`

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return res.status(200).json({ message: 'No Resend key configured', wod: wod.name, subscribers: emails.length })
    }

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'RonaPump <wod@ronapump.com>',
        to: emails,
        subject: `🦍 WOD: ${wod.name}`,
        html: html,
      })
    })

    const sendData = await sendRes.json()

    // Log to digest_log
    await supabase.from('digest_log').insert({
      type: 'daily_wod',
      workout_id: wod.id,
      recipients: emails.length,
      sent_at: new Date().toISOString(),
    })

    return res.status(200).json({
      message: 'Daily WOD sent',
      wod: wod.name,
      subscribers: emails.length,
      resend: sendData,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
