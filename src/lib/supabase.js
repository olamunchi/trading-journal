import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when env vars aren't set (e.g. local dev with no .env.local). Callers
// treat a null client as "no backend" and fall back to localStorage only —
// the app stays fully usable offline / before Supabase is wired up.
export const supabase = url && anonKey ? createClient(url, anonKey) : null

// Maps a Supabase `trades` row to the in-app Trade object shape (tradeStore.js).
export function rowToTrade(r) {
  const entryTime = r.entry_time
  const exitTime = r.exit_time
  const duration = entryTime && exitTime
    ? Math.round((new Date(exitTime) - new Date(entryTime)) / 1000)
    : null
  return {
    id: r.id,
    instrument: r.instrument,
    side: r.side,
    qty: r.qty,
    entryTime,
    exitTime,
    entryPrice: Number(r.entry_price),
    exitPrice: Number(r.exit_price),
    profit: Number(r.profit),
    commission: Number(r.commission ?? 0),
    mae: r.mae != null ? Number(r.mae) : 0,
    mfe: r.mfe != null ? Number(r.mfe) : 0,
    duration,
    note: r.note ?? '',
    tags: r.tags ?? [],
    stopPrice: r.stop_price != null ? Number(r.stop_price) : null,
    executionScore: r.execution_score ?? null,
    mood: r.mood ?? '',
    confidence: r.confidence ?? '',
    followedPlan: r.followed_plan ?? null,
    mistakeType: r.mistake_type ?? '',
    source: 'nt8',
  }
}

// Fetches all trades from Supabase, oldest first. Returns [] if no backend
// is configured or the request fails — never throws into the UI.
export async function fetchTrades() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('entry_time', { ascending: true })
  if (error) {
    console.error('[supabase] fetchTrades failed:', error.message)
    return []
  }
  return data.map(rowToTrade)
}
