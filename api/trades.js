import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Only ever runs server-side on Vercel.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const REQUIRED = ['instrument', 'side', 'entryPrice', 'exitPrice', 'entryTime', 'exitTime', 'profit']

// Receives a completed trade from NinjaTrader 8 (MADSnowball OnPositionUpdate)
// and writes it to the Supabase `trades` table. Auth is a shared secret in the
// X-NT8-Secret header — enough for a personal, unadvertised endpoint.
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
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Empty body' })
  }

  const missing = REQUIRED.filter(k => body[k] === undefined || body[k] === null || body[k] === '')
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` })
  }

  const side = String(body.side).toLowerCase()
  if (side !== 'long' && side !== 'short') {
    return res.status(400).json({ error: `Invalid side: ${body.side}` })
  }

  const entryMs = new Date(body.entryTime).getTime()
  const exitMs = new Date(body.exitTime).getTime()
  if (Number.isNaN(entryMs) || Number.isNaN(exitMs)) {
    return res.status(400).json({ error: 'entryTime/exitTime not parseable as dates' })
  }

  // Deterministic id: a retry or duplicate POST of the same fill can't create
  // a second row (upsert with ignoreDuplicates below).
  const id = `nt8-${entryMs}-${exitMs}`

  const row = {
    id,
    instrument: body.instrument,
    side,
    qty: body.qty ?? null,
    entry_price: body.entryPrice,
    exit_price: body.exitPrice,
    entry_time: new Date(entryMs).toISOString(),
    exit_time: new Date(exitMs).toISOString(),
    profit: body.profit,
    commission: body.commission ?? 0,
    mae: body.mae ?? null,
    mfe: body.mfe ?? null,
    stop_price: body.stopPrice ?? null,
    strategy_name: body.strategyName ?? null,
    account: body.account ?? null,
  }

  const { error } = await supabase
    .from('trades')
    .upsert(row, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ id })
}
