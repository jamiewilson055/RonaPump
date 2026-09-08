import { createClient } from '@supabase/supabase-js'

// Nightly backfill: writes a one-line `summary` for any official/community workout
// that doesn't have one yet. Additive only — never touches rows that already have a summary.
//
// Requires Vercel env:
//   ANTHROPIC_API_KEY           (already set — shared with generate-workout)
//   SUPABASE_SERVICE_ROLE_KEY   (NEW — RLS blocks the publishable key from updating workouts)
//   CRON_SECRET                 (optional, same behavior as daily-wod)
//
// Manual test after deploy:
//   GET /api/summarize-workouts?dry=1   → shows what it WOULD write, writes nothing
//   GET /api/summarize-workouts         → writes summaries

const SUPABASE_URL = 'https://zspyhtcyapkwyphhfdwy.supabase.co'
const BATCH = 25
const MAX_LEN = 75

const EXAMPLES = [
  ['The 250', '250 reps and 2.5 miles: 50 each of five movements, half-mile run between.'],
  ['Ludo', 'Six 1K runs w/ 25 heavy wall balls between, capped by 100 wall balls.'],
  ['Run Row', '6 rounds: 1K run, 1K row.'],
  ['Ellen', '3 rounds: 20 burpees, 21 DB snatches, 12 DB thrusters.'],
  ['Lower Body Lockdown', 'Two heavy lower-body supersets, then a 10-min tri-erg calorie finisher.'],
]

function buildPrompt(name, description) {
  return `Write a one-line summary of this workout for a card preview in a fitness app.

RULES:
- Under ${MAX_LEN} characters. This is a hard limit.
- One sentence or fragment. No line breaks. No quotes around it.
- Name the concrete movements and structure (rounds, reps, distances). Skip coaching notes, tempo details and rest periods unless they define the workout.
- Casual gym shorthand is good: w/, DB, KB, 1K, Z2, EMOM, AMRAP, alt.
- Do not repeat the workout name. Do not add commentary.
- Output ONLY the summary text.

EXAMPLES OF THE STYLE:
${EXAMPLES.map(([n, s]) => `${n} → ${s}`).join('\n')}

WORKOUT NAME: ${name}

WORKOUT:
${description}`
}

async function summarize(apiKey, name, description) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 120,
      messages: [{ role: 'user', content: buildPrompt(name, description) }],
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`)
  let text = (data?.content?.[0]?.text || '').trim()
  text = text.split('\n')[0].trim().replace(/^["'“”]+|["'“”]+$/g, '').trim()
  return text
}

export default async function handler(req, res) {
  // Same auth pattern as daily-wod: honor CRON_SECRET when set, allow GET for manual runs
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const dry = req.query?.dry === '1' || req.query?.dry === 'true'

  if (!apiKey) return res.status(200).json({ error: 'ANTHROPIC_API_KEY missing', wrote: 0 })
  if (!serviceKey) return res.status(200).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing — add it in Vercel env and redeploy', wrote: 0 })

  const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: rows, error } = await supabase
      .from('workouts')
      .select('id, name, description')
      .is('summary', null)
      .in('visibility', ['official', 'community'])
      .not('description', 'is', null)
      .order('created_at', { ascending: false })
      .limit(BATCH)

    if (error) return res.status(500).json({ error: error.message })
    if (!rows || rows.length === 0) return res.status(200).json({ message: 'Nothing to summarize', wrote: 0 })

    const results = []
    let wrote = 0

    for (const w of rows) {
      if (!w.description || w.description.trim().length < 10) {
        results.push({ name: w.name, skipped: 'description too short' })
        continue
      }
      try {
        let summary = await summarize(apiKey, w.name, w.description)
        if (summary.length > MAX_LEN + 10) {
          // One retry with a firmer nudge before giving up until tomorrow
          summary = await summarize(apiKey, w.name, `${w.description}\n\n(Your last attempt was ${summary.length} characters. Cut it to under ${MAX_LEN}.)`)
        }
        if (!summary || summary.length > MAX_LEN + 10) {
          results.push({ name: w.name, skipped: `too long (${summary.length})`, summary })
          continue
        }
        if (dry) {
          results.push({ name: w.name, summary, len: summary.length, dry: true })
          continue
        }
        const { error: upErr } = await supabase
          .from('workouts')
          .update({ summary })
          .eq('id', w.id)
          .is('summary', null) // never overwrite something written in the meantime
        if (upErr) results.push({ name: w.name, error: upErr.message })
        else { wrote++; results.push({ name: w.name, summary, len: summary.length }) }
      } catch (err) {
        results.push({ name: w.name, error: err.message })
      }
    }

    return res.status(200).json({ message: dry ? 'Dry run' : 'Summaries written', candidates: rows.length, wrote, results })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
