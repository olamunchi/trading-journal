import { createClient } from '@supabase/supabase-js'
import { computeSummary } from './_propSummaryMath.js'

// Service-role client — bypasses RLS. Only ever runs server-side on Vercel.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

// Reconstructs PropTraderAccountTool's cumulative account state (cash value,
// today's PnL, best day, trading-days count, and the EOD trailing-drawdown
// floor) from the journal's trade history for one account, so the indicator
// no longer needs local .txt files that get wiped on an account reset.
//
// Trade replay is scoped to the account's CURRENT challenge attempt (see
// challenge_attempts / api/challenge-attempt-close.js) — a prop account gets
// re-attempted on the same NT8 account name after every pass/fail, so "all
// trades ever" would blend multiple attempts together.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const account = req.query.account
  const accountStartValue = Number(req.query.accountStartValue)
  const propDD = Number(req.query.propDD)
  if (!account || !Number.isFinite(accountStartValue) || !Number.isFinite(propDD)) {
    return res.status(400).json({ error: 'Required: account, accountStartValue, propDD' })
  }
  const initialThreshold = Number.isFinite(Number(req.query.initialThreshold))
    ? Number(req.query.initialThreshold)
    : accountStartValue - propDD

  let { data: openAttempt, error: attemptErr } = await supabase
    .from('challenge_attempts')
    .select('id, started_at')
    .eq('account', account)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (attemptErr) {
    return res.status(500).json({ error: attemptErr.message })
  }

  if (!openAttempt) {
    // First-ever attempt for this account — start from account inception (epoch), not
    // "now", so pre-existing trade history is included rather than silently dropped.
    const { data: created, error: createErr } = await supabase
      .from('challenge_attempts')
      .insert({ account, started_at: '1970-01-01T00:00:00Z' })
      .select('id, started_at')
      .single()
    if (createErr) {
      return res.status(500).json({ error: createErr.message })
    }
    openAttempt = created
  }

  const { data: rows, error } = await supabase
    .from('trades')
    .select('profit, commission, exit_time')
    .eq('account', account)
    .gte('exit_time', openAttempt.started_at)
    .order('exit_time', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const { count: attemptsPassed, error: passedErr } = await supabase
    .from('challenge_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('account', account)
    .eq('outcome', 'passed')

  const { count: attemptsFailed, error: failedErr } = await supabase
    .from('challenge_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('account', account)
    .eq('outcome', 'failed')

  if (passedErr || failedErr) {
    return res.status(500).json({ error: (passedErr || failedErr).message })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
  const summary = computeSummary({ rows, accountStartValue, propDD, initialThreshold, today })

  return res.status(200).json({
    account,
    ...summary,
    attemptsPassed: attemptsPassed || 0,
    attemptsFailed: attemptsFailed || 0,
    attemptStartedAt: openAttempt.started_at,
  })
}
