// Pure aggregation/ratchet logic for prop-summary.js, split out so it can be
// unit-tested without a live Supabase connection.
//
// Day bucketing uses the raw stored date digits, no timezone conversion.
// NT8 posts trade times as naive Lisbon wall-clock strings (no offset).
// api/trades.js's `new Date(body.entryTime)` parses that as if it were UTC
// (Vercel's Node runtime is UTC) and stores it back with a trailing "Z" — so
// the stored digits are numerically identical to the original Lisbon
// wall-clock digits, just mislabeled as UTC. Since the trading day rolls
// over at Lisbon local midnight, `exit_time.slice(0, 10)` already gives the
// correct Lisbon calendar date. Do NOT "fix" this with a timezone
// conversion — that would double-shift it and break the bucketing.
export function computeSummary({ rows, accountStartValue, propDD, initialThreshold, today }) {
  let cashRunning = accountStartValue
  let thresholdRunning = initialThreshold
  let currentDay = null
  const dailyNetPnL = {}
  let lastTradeTime = null

  for (const row of rows) {
    const day = row.exit_time.slice(0, 10)
    if (day !== currentDay) {
      if (currentDay !== null) {
        const candidate = cashRunning - propDD
        if (candidate > thresholdRunning) thresholdRunning = candidate
      }
      currentDay = day
      dailyNetPnL[day] = 0
    }
    const net = Number(row.profit) - Number(row.commission || 0)
    cashRunning += net
    dailyNetPnL[day] += net
    lastTradeTime = row.exit_time
  }

  // Final ratchet for "today" even if today has zero trades yet — this
  // morning's session rollover already happened. Safe to re-run against an
  // unchanged cashRunning: that never lowers the threshold, only a no-op.
  if (today !== currentDay) {
    const candidate = cashRunning - propDD
    if (candidate > thresholdRunning) thresholdRunning = candidate
  }

  const bestDayPnL = Object.values(dailyNetPnL).reduce((m, v) => Math.max(m, v), 0)
  const todayPnL = dailyNetPnL[today] || 0
  const tradingDaysCount = Object.keys(dailyNetPnL).length

  return {
    tradeCount: rows.length,
    cashValue: cashRunning,
    todayPnL,
    bestDayPnL,
    tradingDaysCount,
    autoLiquidationValue: thresholdRunning,
    lastTradeTime,
  }
}
