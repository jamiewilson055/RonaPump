import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

webpush.setVapidDetails(
  'mailto:harambe@ronapump.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify webhook secret
  const secret = req.headers['x-webhook-secret']
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { record } = req.body || {}
    if (!record || !record.user_id) {
      return res.status(400).json({ error: 'Missing notification record' })
    }

    const { user_id, title, body, type, link } = record

    // Get push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) {
      return res.status(200).json({ message: 'No push subscriptions for user', user_id })
    }

    const icons = { approval: '✅', rejection: '❌', score: '🏆', comment: '💬', like: '❤️', challenge: '⚔️', milestone: '🎉' }
    const icon = icons[type] || '🦍'

    const payload = JSON.stringify({
      title: `${icon} ${title || 'RonaPump'}`,
      body: body || '',
      url: link ? `https://www.ronapump.com${link.startsWith('/') ? '' : '/'}${link}` : 'https://www.ronapump.com',
      tag: `ronapump-${type}-${Date.now()}`,
    })

    let sent = 0
    let expired = []

    for (const sub of subs) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }

      try {
        await webpush.sendNotification(pushSub, payload)
        sent++
      } catch (err) {
        // 404 or 410 = subscription expired, remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          expired.push(sub.id)
        }
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    return res.status(200).json({ sent, expired: expired.length, total: subs.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
