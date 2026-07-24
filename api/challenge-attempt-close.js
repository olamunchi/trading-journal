import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Only ever runs server-side on Vercel.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

// Called by PropTraderAccountTool.cs the moment it detects (from realized,
// journal-only data — never mid-trade) that the current challenge attempt
// passed or failed, OR when the user manually abandons an in-progress
// attempt (AbandonChallengeNow property) — e.g. restarting after a config
// change, not a real result. 'abandoned' deliberately doesn't count toward
// either the passed or failed tally in api/prop-summary.js. Closes the
// account's open attempt with that outcome and opens a fresh one starting
// now, so the next trade counts toward the new attempt. Auth mirrors
// api/trades.js (shared secret, personal endpoint).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.headers['x-nt8-secret'] !== process.env.NT8_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }
  const account = body && body.account
  const outcome = body && body.outcome
  if (!account || (outcome !== 'passed' && outcome !== 'failed' && outcome !== 'abandoned')) {
    return res.status(400).json({ error: "Required: account, outcome ('passed'|'failed'|'abandoned')" })
  }

  const now = new Date().toISOString()

  const { data: openAttempt, error: findErr } = await supabase
    .from('challenge_attempts')
    .select('id')
    .eq('account', account)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    return res.status(500).json({ error: findErr.message })
  }

  if (openAttempt) {
    const { error: closeErr } = await supabase
      .from('challenge_attempts')
      .update({ ended_at: now, outcome })
      .eq('id', openAttempt.id)
    if (closeErr) {
      return res.status(500).json({ error: closeErr.message })
    }
  }

  const { data: created, error: createErr } = await supabase
    .from('challenge_attempts')
    .insert({ account, started_at: now })
    .select('id, started_at')
    .single()

  if (createErr) {
    return res.status(500).json({ error: createErr.message })
  }

  return res.status(200).json({
    closedAttemptId: openAttempt ? openAttempt.id : null,
    newAttemptId: created.id,
    newAttemptStartedAt: created.started_at,
  })
}
