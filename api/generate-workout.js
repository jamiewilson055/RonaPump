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

  let prompt = ''
  try {
    prompt = req.body?.prompt || ''
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a fitness workout creator for RonaPump. Generate a workout based on: "${prompt}"

Respond ONLY in valid JSON, no markdown, no backticks, no extra text:
{"name":"Workout Name","description":"Line 1\\n• Movement 1\\n• Movement 2","score_type":"Time","estimated_duration_mins":20,"equipment":["Bodyweight"],"workout_types":["AMRAP"],"movement_categories":["Push-Up","Squat"],"body_parts":["Full Body"],"categories":[]}

Valid equipment: Bodyweight, Dumbbell, Kettlebell, Barbell, Pull-Up Bar, Box, Bench, Rower, Bike (Assault/Echo), Ski Erg, Speed Rope, Medicine Ball, Sandbag, Sled, Weighted Vest
Valid workout_types: AMRAP, EMOM, For Calories, For Distance, For Time, Interval, Ladder, Rounds, Strength
Valid movement_categories: Bench Press, Burpee, DB Snatch, Deadlift, Farmers Carry, Jump, Lunge, Pull-Up, Push-Up, Run, Shoulder Press, Squat
Valid body_parts: Upper Body, Lower Body, Full Body

Make it creative and challenging.`
        }]
      })
    })

    const text = await response.text()

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error: ' + text.slice(0, 200) })
    }

    let data
    try { data = JSON.parse(text) } catch { return res.status(500).json({ error: 'Bad Anthropic response' }) }

    const content = (data.content || []).map(c => c.text || '').join('')
    const clean = content.replace(/```json|```/g, '').trim()

    let workout
    try { workout = JSON.parse(clean) } catch { return res.status(500).json({ error: 'Could not parse workout JSON', raw: clean.slice(0, 300) }) }

    return res.status(200).json(workout)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
