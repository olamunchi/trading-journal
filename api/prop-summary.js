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

  const { data: rows, error } = await supabase
    .from('trades')
    .select('profit, commission, exit_time')
    .eq('account', account)
    .order('exit_time', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
  const summary = computeSummary({ rows, accountStartValue, propDD, initialThreshold, today })

  return res.status(200).json({ account, ...summary })
}
