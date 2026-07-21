export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET = health check
  if (req.method === 'GET') {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY || '').trim()
    return res.status(200).json({ status: 'ok', route: 'log-workout', hasKey, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not found in environment' })
  }

  const text = (req.body?.text || '').trim()
  const names = Array.isArray(req.body?.names) ? req.body.names.filter(n => typeof n === 'string').slice(0, 1200) : []

  if (!text) {
    return res.status(400).json({ error: 'Text is required' })
  }

  const prompt = `You parse a fitness logging sentence into structured JSON for the RonaPump app. The user is describing a workout they completed.

USER SENTENCE: "${text.slice(0, 400)}"

LIBRARY WORKOUT NAMES (one per line):
${names.join('\n')}

RULES:
1. If the sentence refers to one of the LIBRARY WORKOUT NAMES (allow fuzzy matching, nicknames, partial names), put its EXACT name from the list in "matched" and set "new_workout" to null.
2. If it describes an activity NOT in the library (e.g. a run, a swim, a gym session), set "matched" to null and describe it in "new_workout" with a short clean name and a one-line description.
3. "score" = the performance value exactly as stated (a time like "39:55", reps, calories, distance, rounds) or null if none stated.
4. "is_rx" = false ONLY if the sentence says scaled/modified/lighter; otherwise true.
5. "notes" = remaining context worth keeping (how it felt, weights used, conditions) or null. Do not duplicate the score into notes.
6. "days_ago" = 0 for today, 1 for "yesterday", 2 for "two days ago", etc. Default 0.
7. new_workout tag vocabularies (use ONLY these values):
- equipment: Air Bike, Barbell, Bench, Bodyweight, Box, Dumbbell, Kettlebell, Medicine Ball, Pull-Up Bar, Rower, Sandbag, Ski Erg, Sled, Jump Rope, Weighted Vest
- movement_categories: Bench Press, Burpee, DB Snatch, Deadlift, Farmers Carry, Jump, KB Swing, Lunge, Pull-Up, Push-Up, Run, Shoulder Press, Squat, Thruster, Wall Ball
- body_parts: Upper Body, Lower Body, Full Body
- workout_types: AMRAP, EMOM, For Calories, For Distance, For Time, Interval, Ladder, Rounds, Strength
- score_type: Time, Rounds + Reps, Reps, Calories, Distance, Load, None

Respond ONLY with valid JSON, no markdown, no backticks:
{"matched": "Exact Library Name or null", "new_workout": null, "score": "39:55", "is_rx": true, "notes": null, "days_ago": 0}

If new_workout is needed, its shape is:
{"name": "10K Run", "description": "10,000 meter run", "equipment": ["Bodyweight"], "movement_categories": ["Run"], "body_parts": ["Full Body"], "workout_types": ["For Distance"], "score_type": "Time", "estimated_duration_mins": null}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const respText = await response.text()

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error: ' + respText.slice(0, 200) })
    }

    let data
    try { data = JSON.parse(respText) } catch { return res.status(500).json({ error: 'Bad Anthropic response' }) }

    const content = (data.content || []).map(c => c.text || '').join('')
    const clean = content.replace(/```json|```/g, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) } catch { return res.status(500).json({ error: 'Could not parse log JSON', raw: clean.slice(0, 300) }) }

    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
