import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zspyhtcyapkwyphhfdwy.supabase.co',
  'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'
)

export default async function handler(req, res) {
  const email = req.query.email

  if (!email) {
    return res.status(400).send(page('Missing email', 'Something went wrong. Please contact us on Instagram @ronapump.'))
  }

  try {
    const { error } = await supabase
      .from('email_subscribers')
      .update({ subscribed: false })
      .eq('email', email)

    if (error) {
      return res.status(500).send(page('Error', 'Something went wrong. Please try again or contact us on Instagram @ronapump.'))
    }

    return res.status(200).send(page('Unsubscribed', `<b>${email}</b> has been unsubscribed from the Daily WOD email. You can re-subscribe anytime from your profile at <a href="https://www.ronapump.com" style="color:#e01e1e;">ronapump.com</a>.`))
  } catch (err) {
    return res.status(500).send(page('Error', 'Something went wrong. Please try again.'))
  }
}

function page(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — RonaPump</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #07070a; color: #ededf0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
  .card { background: #101015; border: 1px solid #1e1e28; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { font-size: 14px; color: #8e8e9a; line-height: 1.6; margin: 0; }
  a { color: #e01e1e; }
</style>
</head><body>
<div class="card">
  <div style="font-size:40px;margin-bottom:16px;">🦍</div>
  <h1>${title}</h1>
  <p>${body}</p>
</div>
</body></html>`
}
