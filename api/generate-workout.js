export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a fitness workout creator for RonaPump, a functional fitness app. Generate a workout based on this request: "${prompt}"

Respond ONLY in this exact JSON format, no other text, no markdown backticks:
{
  "name": "Creative Workout Name",
  "description": "Full workout description.\\nUse \\n for line breaks.\\nUse • for bullet points like:\\n• 10 Push-Ups\\n• 15 Air Squats\\n• 20 Sit-Ups\\nInclude warm-up suggestions and scaling options.",
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
Valid categories: Cardio Only, DB Only, RonaAbs, Home Gym, Hotel Workouts, HYROX, Outdoor, Track Workouts

Make the workout creative, challenging, and well-structured. Give it an interesting name. Format the description clearly with bullet points for movements.`
        }]
      })
    })

    const data = await response.json()

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'API error' })
    }

    const text = data.content?.map(c => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const workout = JSON.parse(clean)
      return res.status(200).json(workout)
    } catch {
      return res.status(500).json({ error: 'Failed to parse workout', raw: clean })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
