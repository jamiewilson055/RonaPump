const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

module.exports = async function handler(req, res) {
  const slug = req.query.slug
  if (!slug) return res.redirect('/')

  const ua = (req.headers['user-agent'] || '').toLowerCase()
  const isCrawler = /bot|crawl|spider|slack|discord|telegram|whatsapp|facebook|twitter|imessagebot|applebot|facebookexternalhit|linkedinbot|preview|Twitterbot|vkShare|W3C_Validator/i.test(ua)

  // Fetch workout
  let workout = null
  try {
    const { data } = await supabase
      .from('workouts')
      .select('name, description, equipment, workout_types, estimated_duration_mins, score_type')

    if (data) {
      workout = data.find(w => {
        if (!w.name) return false
        const wSlug = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        return wSlug === slug
      })
    }
  } catch (e) {}

  // If not a crawler or workout not found, serve the SPA
  if (!isCrawler || !workout) {
    // Read and serve the built index.html so the SPA handles it
    const fs = require('fs')
    const path = require('path')
    try {
      const indexPath = path.join(process.cwd(), 'dist', 'index.html')
      const html = fs.readFileSync(indexPath, 'utf-8')
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).send(html)
    } catch (e) {
      return res.redirect(`/?workout=${slug}`)
    }
  }

  const w = workout
  const name = w.name || 'Workout'
  const fullUrl = `https://www.ronapump.com/workout/${slug}`

  let meta = ''
  if (w.estimated_duration_mins) meta += `⏱ ${w.estimated_duration_mins} min`
  if (w.score_type && w.score_type !== 'None') meta += `${meta ? ' · ' : ''}${w.score_type}`
  const equip = (w.equipment || []).filter(e => e !== 'Bodyweight')
  if (equip.length) meta += `${meta ? ' · ' : ''}${equip.join(', ')}`

  const rawDesc = (w.description || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  const shortDesc = rawDesc.length > 100 ? rawDesc.slice(0, 97) + '...' : rawDesc

  const ogDesc = meta ? `${meta}\n${shortDesc}` : shortDesc || 'A workout on RonaPump'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(name)} — RonaPump 🦍</title>
<meta name="description" content="${esc(ogDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${fullUrl}">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:site_name" content="RonaPump 🦍">
<meta property="og:image" content="https://www.ronapump.com/logo-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta name="twitter:image" content="https://www.ronapump.com/logo-512.png">
</head>
<body>
<h1>${esc(name)}</h1>
<p>${esc(ogDesc)}</p>
<a href="${fullUrl}">View on RonaPump</a>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).send(html)
}
