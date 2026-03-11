import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

export default async function handler(req, res) {
  const slug = req.query.slug
  if (!slug) {
    res.writeHead(302, { Location: '/' })
    res.end()
    return
  }

  const { data: workouts } = await supabase.from('workouts').select('name, description, estimated_duration_mins, equipment, workout_types, score_type')

  let workout = null
  if (workouts) {
    workout = workouts.find(w => {
      if (!w.name) return false
      const wSlug = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return wSlug === slug
    })
  }

  const name = workout?.name || 'Workout'
  const type = (workout?.workout_types || []).filter(t => t !== 'General')[0] || ''
  const dur = workout?.estimated_duration_mins ? workout.estimated_duration_mins + 'min' : ''
  const equip = (workout?.equipment || []).filter(e => e !== 'Bodyweight').slice(0, 3).join(', ')

  let desc = ''
  if (type) desc += type
  if (dur) desc += (desc ? ' \u00B7 ' : '') + dur
  if (equip) desc += (desc ? ' \u00B7 ' : '') + equip
  if (!desc && workout?.description) {
    desc = workout.description.replace(/\n/g, ' ').slice(0, 120)
    if (workout.description.length > 120) desc += '...'
  }
  if (!desc) desc = 'Free workout on RonaPump'

  const pageUrl = 'https://www.ronapump.com/workout/' + slug
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const html = '<!DOCTYPE html><html><head>' +
    '<meta charset="UTF-8" />' +
    '<title>' + esc(name) + ' \u2014 RonaPump</title>' +
    '<meta name="description" content="' + esc(desc) + '" />' +
    '<meta property="og:type" content="article" />' +
    '<meta property="og:url" content="' + pageUrl + '" />' +
    '<meta property="og:title" content="' + esc(name) + '" />' +
    '<meta property="og:description" content="' + esc(desc) + '" />' +
    '<meta property="og:site_name" content="RonaPump" />' +
    '<meta property="og:image" content="https://www.ronapump.com/logo-512.png" />' +
    '<meta property="og:image:width" content="512" />' +
    '<meta property="og:image:height" content="512" />' +
    '<meta name="twitter:card" content="summary" />' +
    '<meta name="twitter:title" content="' + esc(name) + '" />' +
    '<meta name="twitter:description" content="' + esc(desc) + '" />' +
    '<meta name="twitter:image" content="https://www.ronapump.com/logo-512.png" />' +
    '</head><body>' +
    '<h1>' + esc(name) + '</h1><p>' + esc(desc) + '</p>' +
    '<a href="' + pageUrl + '">Open on RonaPump</a>' +
    '</body></html>'

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).send(html)
}
