import { createClient } from '@supabase/supabase-js'

// Weekly retest nudge: notifies users whose most recent Longevity Test Day is more than
// STALE_DAYS old. One nudge per user per COOLDOWN_DAYS, never more. Additive only.
//
// Requires Vercel env:
//   SUPABASE_SERVICE_ROLE_KEY   (RLS blocks the publishable key from inserting other users' notifications)
//   CRON_SECRET                 (optional, same behavior as daily-wod)
//
// Manual test after deploy:
//   GET /api/retest-nudge?dry=1   → lists who WOULD be nudged, writes nothing
//   GET /api/retest-nudge         → writes notifications

const SUPABASE_URL = 'https://zspyhtcyapkwyphhfdwy.supabase.co'
const STALE_DAYS = 90     // must match STALE_DAYS in Longevity.jsx
const COOLDOWN_DAYS = 30  // don't nag more than once a month

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const dry = req.query?.dry === '1' || req.query?.dry === 'true'
  if (!serviceKey) return res.status(200).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing — add it in Vercel env and redeploy', sent: 0 })

  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    // Latest test date per user
    const { data: rows, error } = await supabase.from('longevity_scores').select('user_id, tested_at')
    if (error) return res.status(500).json({ error: error.message })
    const latest = {}
    for (const r of rows || []) { if (!latest[r.user_id] || r.tested_at > latest[r.user_id]) latest[r.user_id] = r.tested_at }

    const now = Date.now()
    const staleUsers = Object.entries(latest)
      .map(([user_id, tested_at]) => ({ user_id, tested_at, days: Math.floor((now - new Date(tested_at + 'T00:00:00Z').getTime()) / 86400000) }))
      .filter(u => u.days > STALE_DAYS)

    if (staleUsers.length === 0) return res.status(200).json({ message: 'Nobody is due for a retest', sent: 0 })

    // Cooldown: skip anyone nudged in the last COOLDOWN_DAYS
    const since = new Date(now - COOLDOWN_DAYS * 86400000).toISOString()
    const { data: recent } = await supabase.from('notifications').select('user_id').eq('type', 'longevity').gte('created_at', since)
    const cooled = new Set((recent || []).map(n => n.user_id))
    const targets = staleUsers.filter(u => !cooled.has(u.user_id))

    if (dry) return res.status(200).json({ message: 'Dry run', due: staleUsers.length, would_send: targets.length, targets })

    let sent = 0, errors = []
    for (const u of targets) {
      const { error: insErr } = await supabase.from('notifications').insert({
        user_id: u.user_id,
        type: 'longevity',
        title: '🧬 Time to retest your Vital Age',
        body: `Your last Test Day was ${u.days} days ago. Markers drift — retest to keep your score honest.`,
        link: 'longevity',
        read: false,
      })
      if (insErr) errors.push({ user_id: u.user_id, error: insErr.message })
      else sent++
    }

    return res.status(200).json({ message: 'Retest nudges sent', due: staleUsers.length, skipped_cooldown: staleUsers.length - targets.length, sent, errors: errors.length ? errors : undefined })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
