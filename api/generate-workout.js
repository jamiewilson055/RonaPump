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

  // --- Movement Swap Mode ---
  if (req.body?.mode === 'swap') {
    const { description, constraints, name, equipment } = req.body
    if (!description || !constraints?.length) {
      return res.status(400).json({ error: 'Missing description or constraints' })
    }

    const swapPrompt = `You are a CrossFit/functional fitness coach. A user wants to modify a workout by swapping movements based on equipment constraints.

WORKOUT NAME: ${name || 'Unnamed'}

ORIGINAL WORKOUT:
${description}

CURRENT EQUIPMENT TAGS: ${(equipment || []).join(', ')}

USER CONSTRAINTS (equipment/movements to remove):
${constraints.join(', ')}

INSTRUCTIONS:
1. Rewrite the workout description, replacing any movements that require the removed equipment with equivalent alternatives that maintain the same muscle groups, intensity, and rep scheme.
2. Keep the EXACT same formatting (bullets, sections, line breaks) as the original.
3. Keep all rep counts, round counts, time caps, and rest periods identical unless the swap fundamentally changes the movement (e.g., swapping a 400m run for row calories).
4. Use standard CrossFit movement names.
5. Do NOT add commentary, explanations, or notes about what was changed. Just output the rewritten workout description.
6. Also return an updated equipment list (JSON array of strings) reflecting what equipment the modified workout actually uses.

Common substitutions reference:
- Barbell Back Squat → Goblet Squat (DB/KB) or Air Squat (bodyweight)
- Barbell Clean → DB Clean or KB Clean
- Barbell Deadlift → DB Deadlift or KB Deadlift
- Barbell Overhead Press → DB Press or Pike Push-Up (bodyweight)
- Pull-Up → Ring Row, DB Row, or Inverted Row
- Box Jump → Broad Jump, Squat Jump, or Step-Up
- Toes-to-Bar → V-Up, Hanging Knee Raise, or Sit-Up
- Run 400m → Row 500m, Bike 1000m, or 50 Double-Unders
- Rope Climb → Towel Pull-Up or 5 Strict Pull-Ups
- Wall Ball → DB Thruster or Goblet Squat + Push Press
- Ski Erg → Burpees or Mountain Climbers
- Sled Push → Broad Jumps or Walking Lunges

Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{"description": "the rewritten workout text", "equipment": ["Bodyweight", "Dumbbell"]}`

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: swapPrompt }],
        }),
      })

      const aiText = await aiRes.text()
      if (!aiRes.ok) {
        return res.status(500).json({ error: 'AI request failed: ' + aiText.slice(0, 200) })
      }

      let aiData
      try { aiData = JSON.parse(aiText) } catch { return res.status(500).json({ error: 'Bad AI response' }) }

      const content = (aiData.content || []).map(c => c.text || '').join('')
      const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

      let parsed
      try { parsed = JSON.parse(clean) } catch {
        // If JSON parse fails, return raw text as description
        return res.status(200).json({ description: clean, equipment: equipment || [] })
      }

      return res.status(200).json({
        description: parsed.description || clean,
        equipment: parsed.equipment || equipment || [],
      })
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Swap failed' })
    }
  }

  // --- Original Workout Generation Mode ---
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
