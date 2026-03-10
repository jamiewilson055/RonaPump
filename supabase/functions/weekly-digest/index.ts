import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = 're_ZntdoNeS_5GVKPNyrJKTA6GXJuqy5udyC'
const FROM_EMAIL = 'digest@ronapump.com'
const FROM_NAME = 'RonaPump 🦍'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  try {
    // Get all digest recipients
    const { data: recipients, error: recError } = await supabase.rpc('get_digest_recipients')
    if (recError) throw recError
    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const sent = []
    const errors = []

    for (const recipient of recipients) {
      try {
        // Get digest data
        const { data: digest, error: digError } = await supabase.rpc('get_weekly_digest', {
          p_user_id: recipient.user_id
        })
        if (digError) { errors.push(`${recipient.email}: ${digError.message}`); continue }

        // Build email
        const html = buildDigestEmail(digest)
        const subject = digest.workouts_this_week > 0
          ? `You crushed ${digest.workouts_this_week} workout${digest.workouts_this_week !== 1 ? 's' : ''} this week 🦍`
          : `Time to get after it 🦍 — Your weekly RonaPump digest`

        // Send via Resend
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [recipient.email],
            subject: subject,
            html: html,
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          errors.push(`${recipient.email}: Resend error: ${err}`)
          continue
        }

        // Log the send
        await supabase.from('digest_log').insert({
          user_id: recipient.user_id,
          workouts_count: digest.workouts_this_week,
          prs_count: 0
        })

        sent.push(recipient.email)

        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 600))
      } catch (e) {
        errors.push(`${recipient.email}: ${e.message}`)
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sent.length} digests`, sent, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

function buildDigestEmail(digest: any): string {
  const workouts = digest.recent_workouts || []
  const workoutRows = workouts.map((w: any) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1f;font-family:monospace;font-size:14px;color:#fff;">${w.name || 'Unnamed'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1f;font-size:13px;color:#888;">${w.completed_at || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1a1f;font-size:13px;color:#ff2d2d;">${w.score || '—'}</td>
    </tr>`
  ).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#07070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    
    <div style="text-align:center;padding:24px 0;">
      <h1 style="margin:0;font-family:monospace;font-size:28px;">
        <span style="color:#ff2d2d;">RONA</span><span style="color:#fff;">PUMP</span>
      </h1>
      <p style="color:#888;font-size:13px;margin:6px 0 0;">Weekly Digest 🦍</p>
    </div>

    <div style="background:#0f0f14;border:1px solid #1a1a1f;border-radius:10px;padding:20px;margin-bottom:16px;">
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Hey ${digest.user_name}!</h2>
      <p style="color:#888;font-size:14px;margin:0;line-height:1.5;">
        ${digest.workouts_this_week > 0
          ? `Great work this week! You crushed ${digest.workouts_this_week} workout${digest.workouts_this_week !== 1 ? 's' : ''}.`
          : `No workouts logged this week — time to get after it! 💪`
        }
      </p>
    </div>

    <!--[if mso]>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td width="33%"><![endif]-->
    <div style="display:inline-block;width:32%;vertical-align:top;">
      <div style="background:#0f0f14;border:1px solid #1a1a1f;border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-family:monospace;font-size:32px;color:#ff2d2d;font-weight:700;">${digest.workouts_this_week}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">This Week</div>
      </div>
    </div>
    <!--[if mso]></td><td width="33%"><![endif]-->
    <div style="display:inline-block;width:32%;vertical-align:top;">
      <div style="background:#0f0f14;border:1px solid #1a1a1f;border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-family:monospace;font-size:32px;color:#fff;font-weight:700;">${digest.total_all_time}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">All Time</div>
      </div>
    </div>
    <!--[if mso]></td><td width="33%"><![endif]-->
    <div style="display:inline-block;width:32%;vertical-align:top;">
      <div style="background:#0f0f14;border:1px solid #1a1a1f;border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-family:monospace;font-size:32px;color:#22c55e;font-weight:700;">${digest.current_streak}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Day Streak</div>
      </div>
    </div>
    <!--[if mso]></td></tr></table><![endif]-->

    ${workouts.length > 0 ? `
    <div style="background:#0f0f14;border:1px solid #1a1a1f;border-radius:10px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#fff;font-size:14px;margin:0 0 12px;font-family:monospace;">Recent Workouts</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Workout</th>
            <th style="padding:6px 12px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Date</th>
            <th style="padding:6px 12px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Score</th>
          </tr>
        </thead>
        <tbody>${workoutRows}</tbody>
      </table>
    </div>
    ` : ''}

    <div style="text-align:center;padding:20px 0;">
      <a href="https://www.ronapump.com" style="display:inline-block;background:#ff2d2d;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Open RonaPump</a>
    </div>

    <div style="text-align:center;padding:16px 0;border-top:1px solid #1a1a1f;">
      <p style="color:#555;font-size:11px;margin:0;">
        <a href="https://www.instagram.com/ronapump/" style="color:#888;text-decoration:none;">📸 @ronapump</a>
        &nbsp;•&nbsp;
        <a href="https://www.ronapump.com" style="color:#888;text-decoration:none;">www.ronapump.com</a>
      </p>
      <p style="color:#444;font-size:10px;margin:6px 0 0;">
        You're receiving this because you signed up for RonaPump. 
        To unsubscribe, update your preferences in your profile settings.
      </p>
    </div>

  </div>
</body>
</html>`
}
