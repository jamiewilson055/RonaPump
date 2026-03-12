export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured. Add ANTHROPIC_API_KEY to Vercel environment variables.' })
  }

  const { prompt } = req.body || {}
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
          content: `You are a fitness workout creator for RonaPump, a functional fitness app. Generate a workout based on this request: "${prompt}"

Respond ONLY in valid JSON format, no other text, no markdown:
{
  "name": "Creative Workout Name",
  "description": "Full workout description.\\nUse newlines for formatting.\\n• 10 Push-Ups\\n• 15 Air Squats\\n• 20 Sit-Ups",
  "score_type": "Time",
  "estimated_duration_mins": 20,
  "equipment": ["Bodyweight"],
  "workout_types": ["AMRAP"],
  "movement_categories": ["Push-Up", "Squat"],
  "body_parts": ["Full Body"],
  "categories": []
}

Valid equipment: Bodyweight, Dumbbell, Kettlebell, Barbell, Pull-Up Bar, Box, Bench, Rower, Bike (Assault/Echo), Ski Erg, Speed Rope, Medicine Ball, Sandbag, Sled, Weighted Vest
Valid workout_types: AMRAP, EMOM, For Calories, For Distance, For Time, Interval, Ladder, Rounds, Strength
Valid movement_categories: Bench Press, Burpee, DB Snatch, Deadlift, Farmers Carry, Jump, Lunge, Pull-Up, Push-Up, Run, Shoulder Press, Squat
Valid body_parts: Upper Body, Lower Body, Full Body

Make the workout creative, challenging, and well-structured.`
        }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: 'Anthropic API error: ' + errText })
    }

    const data = await response.json()
    const text = data.content?.map(c => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const workout = JSON.parse(clean)
      return res.status(200).json(workout)
    } catch {
      return res.status(500).json({ error: 'Failed to parse response', raw: clean.slice(0, 200) })
    }
  } catch (err) {
    return res.status(500).json({ error: 'Request failed: ' + err.message })
  }
}
