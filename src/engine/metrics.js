export function filterByPeriod(trades, period) {
  const now = new Date()
  return trades.filter(t => {
    if (!t.entryTime || period === 'all') return true
    const d = new Date(t.entryTime)
    if (period === 'today') return toDateStr(d) === toDateStr(now)
    if (period === 'week') {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0)
      return d >= s
    }
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === '3m') { const c = new Date(now); c.setMonth(now.getMonth() - 3); return d >= c }
    if (period === 'ytd') return d.getFullYear() === now.getFullYear()
    return true
  })
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeMetrics(trades) {
  if (!trades.length) return null
  const wins = trades.filter(t => t.profit > 0)
  const losses = trades.filter(t => t.profit < 0)
  const grossProfit = wins.reduce((s, t) => s + t.profit, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0))
  const netPnL = trades.reduce((s, t) => s + t.profit, 0)
  const winRate = trades.length ? wins.length / trades.length : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const expectancy = trades.length ? netPnL / trades.length : 0
  const totalComm = trades.reduce((s, t) => s + (t.commission || 0), 0)

  const sorted = [...trades].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  let peak = 0, maxDD = 0, cum = 0
  for (const t of sorted) {
    cum += t.profit
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > maxDD) maxDD = dd
  }

  let maxW = 0, maxL = 0, cW = 0, cL = 0
  for (const t of sorted) {
    if (t.profit > 0) { cW++; cL = 0; if (cW > maxW) maxW = cW }
    else { cL++; cW = 0; if (cL > maxL) maxL = cL }
  }

  let curW = 0, curL = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].profit > 0 && curL === 0) curW++
    else if (sorted[i].profit <= 0 && curW === 0) curL++
    else break
  }

  const durTrades = trades.filter(t => t.duration > 0)
  const avgDuration = durTrades.length ? durTrades.reduce((s, t) => s + t.duration, 0) / durTrades.length : 0

  return {
    total: trades.length, wins: wins.length, losses: losses.length,
    netPnL, grossProfit, grossLoss, winRate, profitFactor,
    avgWin, avgLoss, expectancy, totalComm, maxDD,
    maxW, maxL, curW, curL, avgDuration,
  }
}

export function computeEquityCurve(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  let cum = 0
  return sorted.map((t, i) => ({
    i: i + 1,
    date: t.entryTime ? new Date(t.entryTime).toLocaleDateString() : '',
    value: +(cum += t.profit).toFixed(2),
    profit: +t.profit.toFixed(2),
  }))
}

export function computeMonthly(trades) {
  const m = {}
  trades.forEach(t => {
    if (!t.entryTime) return
    const d = new Date(t.entryTime)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    m[k] = (m[k] || 0) + t.profit
  })
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([k, pnl]) => {
    const [y, mo] = k.split('-')
    return { label: new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' }), pnl: +pnl.toFixed(2) }
  })
}

export function computeDow(trades) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const acc = Array(7).fill(null).map(() => [])
  trades.forEach(t => {
    if (!t.entryTime) return
    acc[new Date(t.entryTime).getDay()].push(t)
  })
  return days.map((label, i) => {
    const m = acc[i].length ? computeMetrics(acc[i]) : null
    return {
      label,
      ...(m || {}),
      count: m?.total || 0,
      pnl: m && m.total > 0 ? +(m.netPnL / m.total).toFixed(2) : 0,
    }
  })
}

export function computeHourly(trades) {
  const acc = Array(24).fill(null).map(() => ({ pnl: 0, count: 0 }))
  trades.forEach(t => {
    if (!t.entryTime) return
    const h = new Date(t.entryTime).getHours()
    acc[h].pnl += t.profit; acc[h].count++
  })
  return Array.from({ length: 15 }, (_, i) => i + 6).map(h => ({
    label: `${String(h).padStart(2, '0')}:00`, count: acc[h].count,
    pnl: acc[h].count ? +(acc[h].pnl / acc[h].count).toFixed(2) : 0,
  }))
}

export function computeDist(trades) {
  if (!trades.length) return []
  const profits = trades.map(t => t.profit)
  const min = Math.min(...profits), max = Math.max(...profits)
  const buckets = 20, step = (max - min) / buckets || 1
  const counts = Array(buckets).fill(0)
  profits.forEach(p => { const idx = Math.min(Math.floor((p - min) / step), buckets - 1); counts[idx]++ })
  return Array.from({ length: buckets }, (_, i) => {
    const lower = min + i * step
    return { label: '$' + lower.toFixed(0), count: counts[i], isWin: lower >= 0 }
  })
}

export function computeBySymbol(trades) {
  const byS = {}
  trades.forEach(t => { if (!byS[t.instrument]) byS[t.instrument] = []; byS[t.instrument].push(t) })
  return Object.entries(byS).map(([sym, ts]) => ({ sym, ...computeMetrics(ts) })).sort((a, b) => b.netPnL - a.netPnL)
}

export function computeByTag(trades) {
  const byT = {}
  trades.forEach(t => {
    const tags = t.tags?.length ? t.tags : ['Untagged']
    tags.forEach(tag => { if (!byT[tag]) byT[tag] = []; byT[tag].push(t) })
  })
  return Object.entries(byT).map(([tag, ts]) => ({ tag, ...computeMetrics(ts) })).sort((a, b) => b.netPnL - a.netPnL)
}

// ── NEW: Sessions ─────────────────────────────────────────────────────────────
const SESSIONS = [
  { label: 'Pre-Market',  test: h => h < 9.5 },
  { label: '9:30–10:30',  test: h => h >= 9.5  && h < 10.5 },
  { label: '10:30–11:30', test: h => h >= 10.5 && h < 11.5 },
  { label: '11:30–12:30', test: h => h >= 11.5 && h < 12.5 },
  { label: '12:30–1:30',  test: h => h >= 12.5 && h < 13.5 },
  { label: '1:30–2:30',   test: h => h >= 13.5 && h < 14.5 },
  { label: '2:30–4:00',   test: h => h >= 14.5 && h < 16 },
  { label: 'After Hours', test: h => h >= 16 },
]

export function computeBySession(trades) {
  const buckets = SESSIONS.map(s => ({ label: s.label, test: s.test, trades: [] }))
  trades.forEach(t => {
    if (!t.entryTime) return
    const d = new Date(t.entryTime)
    const h = d.getHours() + d.getMinutes() / 60
    const b = buckets.find(s => s.test(h))
    if (b) b.trades.push(t)
  })
  return buckets
    .filter(b => b.trades.length > 0)
    .map(b => {
      const m = computeMetrics(b.trades)
      return { label: b.label, ...m }
    })
}

// ── NEW: Psychology ───────────────────────────────────────────────────────────
export function computeByMood(trades) {
  const byM = {}
  trades.forEach(t => {
    const key = t.mood || 'Not logged'
    if (!byM[key]) byM[key] = []
    byM[key].push(t)
  })
  return Object.entries(byM)
    .map(([mood, ts]) => ({ mood: mood.charAt(0).toUpperCase() + mood.slice(1), ...computeMetrics(ts) }))
    .sort((a, b) => b.netPnL - a.netPnL)
}

export function computeByExecScore(trades) {
  const LABELS = { 1: 'Poor', 2: 'Below Avg', 3: 'Neutral', 4: 'Good', 5: 'Perfect' }
  const byS = {}
  trades.filter(t => t.executionScore).forEach(t => {
    const s = t.executionScore
    if (!byS[s]) byS[s] = []
    byS[s].push(t)
  })
  return [1, 2, 3, 4, 5].filter(s => byS[s]).map(s => ({
    score: s,
    label: `${s} — ${LABELS[s]}`,
    ...computeMetrics(byS[s]),
  }))
}

// ── NEW: MAE / MFE analysis ───────────────────────────────────────────────────
export function computeMAEMFE(trades) {
  // --- Capture Rate: for winners, how much of the MFE did we capture?
  const winners = trades.filter(t => t.profit > 0 && t.mfe > 0)
  const captureRates = winners.map(t => Math.min(t.profit / t.mfe, 1))
  const avgCapture = captureRates.length
    ? captureRates.reduce((s, r) => s + r, 0) / captureRates.length
    : null

  const captureBuckets = [
    { label: '0–20%', count: 0, pct: 0 },
    { label: '20–40%', count: 0, pct: 20 },
    { label: '40–60%', count: 0, pct: 40 },
    { label: '60–80%', count: 0, pct: 60 },
    { label: '80–100%', count: 0, pct: 80 },
  ]
  captureRates.forEach(r => { captureBuckets[Math.min(Math.floor(r * 5), 4)].count++ })

  // --- Entry Cleanliness: for winners, MAE/MFE ratio (low = clean, high = messy)
  const cleanTrades = winners.filter(t => t.mae >= 0 && t.mfe > 0)
  const maeRatios = cleanTrades.map(t => t.mae / t.mfe)
  const avgMaeRatio = maeRatios.length
    ? maeRatios.reduce((s, r) => s + r, 0) / maeRatios.length
    : null

  // --- Loser "Almost Worked": for losers, MFE/MAE ratio (high = trade went close to target)
  const losers = trades.filter(t => t.profit < 0 && t.mae > 0)
  const loserRatios = losers.filter(t => t.mfe > 0).map(t => t.mfe / t.mae)
  const avgLoserRatio = loserRatios.length
    ? loserRatios.reduce((s, r) => s + r, 0) / loserRatios.length
    : null

  return {
    winnerCount: winners.length,
    loserCount: losers.length,
    avgCapture,       // 0–1
    captureBuckets,
    avgMaeRatio,      // 0–1, lower = cleaner entries
    avgLoserRatio,    // 0–1+, higher = losers almost worked
  }
}

// ── NEW: R-Multiples ──────────────────────────────────────────────────────────
export function computeTradeR(trade) {
  if (!trade.stopPrice || !trade.entryPrice || !trade.exitPrice) return null
  const stopDist = trade.entryPrice - trade.stopPrice
  if (stopDist === 0) return null
  return (trade.exitPrice - trade.entryPrice) / stopDist
}

export function computeRMultiples(trades) {
  const rTrades = trades.filter(t => computeTradeR(t) !== null)
  if (!rTrades.length) return null

  const rValues = rTrades.map(t => +computeTradeR(t).toFixed(2))
  const avgR = rValues.reduce((s, r) => s + r, 0) / rValues.length
  const winR  = rValues.filter(r => r > 0)
  const lossR = rValues.filter(r => r < 0)

  const min = Math.min(...rValues), max = Math.max(...rValues)
  const step = (max - min) / 15 || 1
  const counts = Array(15).fill(0)
  rValues.forEach(r => { counts[Math.min(Math.floor((r - min) / step), 14)]++ })

  return {
    count: rTrades.length,
    avgR: +avgR.toFixed(2),
    avgWinR:  winR.length  ? +(winR.reduce((s, r) => s + r, 0)  / winR.length).toFixed(2)  : 0,
    avgLossR: lossR.length ? +(lossR.reduce((s, r) => s + r, 0) / lossR.length).toFixed(2) : 0,
    distribution: Array.from({ length: 15 }, (_, i) => {
      const lower = min + i * step
      return { label: lower.toFixed(1) + 'R', count: counts[i], isWin: lower >= 0 }
    }),
    rValues,
  }
}


// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatDuration(sec) {
  if (!sec || sec <= 0) return '—'
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export function fmtPnL(v) {
  if (v === undefined || v === null) return '—'
  const prefix = v > 0 ? '+' : v < 0 ? '-' : ''
  return prefix + '$' + Math.abs(v).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pnlColor(v) {
  if (v > 0) return 'text-profit'
  if (v < 0) return 'text-loss'
  return 'text-muted'
}
