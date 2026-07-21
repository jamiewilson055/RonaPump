export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET = health check
  if (req.method === 'GET') {
    const hasKey = !!(process.env.ANTHROPIC_API_KEY || '').trim()
    return res.status(200).json({ status: 'ok', route: 'coach', hasKey, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6' })
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
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const text = await response.text()

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error: ' + text.slice(0, 200) })
    }

    let data
    try { data = JSON.parse(text) } catch { return res.status(500).json({ error: 'Bad Anthropic response' }) }

    const content = (data.content || []).map(c => c.text || '').join('')
    const clean = content.replace(/```json|```/g, '').trim()

    let rec
    try { rec = JSON.parse(clean) } catch { return res.status(500).json({ error: 'Could not parse coach JSON', raw: clean.slice(0, 300) }) }

    return res.status(200).json(rec)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
