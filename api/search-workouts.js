export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET = health check
  if (req.method === 'GET') {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY || '').trim()
    return res.status(200).json({ status: 'ok', hasKey })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not found in environment' })
  }

  const query = (req.body?.query || '').toString().slice(0, 500).trim()
  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }

  const vocab = req.body?.vocab || {}
  const equipment = Array.isArray(vocab.equipment) ? vocab.equipment : []
  const movements = Array.isArray(vocab.movements) ? vocab.movements : []
  const categories = Array.isArray(vocab.categories) ? vocab.categories : []
  const workoutTypes = Array.isArray(vocab.workoutTypes) ? vocab.workoutTypes : []
  const bodyParts = Array.isArray(vocab.bodyParts) ? vocab.bodyParts : []

  const prompt = `You convert a natural-language workout search into structured filters for the RonaPump workout library. Map the request ONLY to values from the vocabularies below. If part of the request does not map to any vocabulary value, omit it rather than inventing a value.

EQUIPMENT: ${equipment.join(', ') || '(none)'}
MOVEMENTS: ${movements.join(', ') || '(none)'}
CATEGORIES: ${categories.join(', ') || '(none)'}
WORKOUT_TYPES: ${workoutTypes.join(', ') || '(none)'}
BODY_PARTS: ${bodyParts.join(', ') || '(none)'}

USER SEARCH: "${query}"

Respond ONLY with valid JSON, no markdown, no backticks, no extra text, in exactly this shape:
{"eq":[],"eqEx":[],"mv":[],"mvEx":[],"cat":[],"wt":[],"bp":[],"durMin":null,"durMax":null,"keywords":""}

Rules:
- eq, mv, cat, wt, bp = REQUIRED tags the workout must have. Arrays of EXACT strings copied from the vocabularies above. Use [] if none apply.
- eqEx = equipment to EXCLUDE (e.g. "no barbell" -> eqEx:["Barbell"]). mvEx = movements to EXCLUDE (e.g. "no running" -> mvEx:["Run"]). Only use values present in the vocabularies.
- durMin, durMax = duration bounds in whole minutes, or null. "under 20 min" -> durMax:20. "at least 30" -> durMin:30. "20 to 30 minutes" -> durMin:20, durMax:30. "quick" or "short" -> durMax:15. "long" or "grinder" -> durMin:30.
- keywords = any leftover free text useful for matching a workout name or description (e.g. a named workout like "Murph", or "partner"), otherwise "".
- Map synonyms to vocabulary values: "DBs"/"dumbbells" -> Dumbbell; "KB"/"kettlebells" -> Kettlebell; "bodyweight"/"no equipment" -> Bodyweight; "running" -> Run; "pull ups" -> Pull-Up; "wall balls" -> Wall Ball; etc. Only if the target exists in the vocabularies.
- Never output any value that is not in the vocabularies. Output JSON only.`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const text = await aiRes.text()
    if (!aiRes.ok) {
      return res.status(500).json({ error: 'Anthropic error: ' + text.slice(0, 200) })
    }

    let data
    try { data = JSON.parse(text) } catch { return res.status(500).json({ error: 'Bad Anthropic response' }) }

    const content = (data.content || []).map(c => c.text || '').join('')
    const clean = content.replace(/```json|```/g, '').trim()

    let f
    try { f = JSON.parse(clean) } catch { return res.status(500).json({ error: 'Could not parse search JSON', raw: clean.slice(0, 200) }) }

    // Validate everything against the supplied vocab so a hallucinated tag can
    // never reach the filter state (which would silently return 0 results).
    const inSet = (arr, allowed) => (Array.isArray(arr) ? arr.filter(x => allowed.includes(x)) : [])
    const toInt = (v) => {
      if (v == null) return null
      const n = typeof v === 'number' ? v : parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null
    }

    const filters = {
      eq: inSet(f.eq, equipment),
      eqEx: inSet(f.eqEx, equipment),
      mv: inSet(f.mv, movements),
      mvEx: inSet(f.mvEx, movements),
      cat: inSet(f.cat, categories),
      wt: inSet(f.wt, workoutTypes),
      bp: inSet(f.bp, bodyParts),
      durMin: toInt(f.durMin),
      durMax: toInt(f.durMax),
      keywords: typeof f.keywords === 'string' ? f.keywords.slice(0, 100) : '',
    }

    return res.status(200).json({ filters })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed' })
  }
}
