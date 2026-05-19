import {
  filterByPeriod, computeMetrics, computeBySession, computeBySymbol,
  computeByTag, computeByMood, computeByExecScore, computeMAEMFE,
  computeRMultiples, computeDow, computeHourly, fmtPnL, formatDuration, toDateStr,
} from './metrics'

function pct(v) { return (v * 100).toFixed(1) + '%' }
function dollar(v) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2) }
function pf(v) { return v === Infinity ? '∞' : v.toFixed(2) }

function tableRow(cells, widths) {
  return '| ' + cells.map((c, i) => String(c ?? '—').padEnd(widths[i])).join(' | ') + ' |'
}
function tableSep(widths) {
  return '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|'
}
function table(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '—').length)))
  return [
    tableRow(headers, widths),
    tableSep(widths),
    ...rows.map(r => tableRow(r, widths)),
  ].join('\n')
}

export function generateReport(trades, periodFilter) {
  const filtered = filterByPeriod(trades, periodFilter)
  const m = computeMetrics(filtered)
  if (!m) return '# No trades to report for the selected period.'

  const sorted = [...filtered].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  const dateFrom = sorted[0]?.entryTime ? new Date(sorted[0].entryTime).toLocaleDateString() : '—'
  const dateTo   = sorted[sorted.length - 1]?.entryTime ? new Date(sorted[sorted.length - 1].entryTime).toLocaleDateString() : '—'

  const periodLabel = {
    all: 'All Time', today: 'Today', week: 'This Week',
    month: 'This Month', '3m': 'Last 3 Months', ytd: 'This Year',
  }[periodFilter] || 'All Time'

  const lines = []

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`# Trading Performance Report`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push(`Period: ${periodLabel} (${dateFrom} – ${dateTo})`)
  lines.push('')

  // ── Core Metrics ──────────────────────────────────────────────────────────
  lines.push(`## Core Metrics`)
  lines.push(`- Total Trades: ${m.total} (${m.wins} wins / ${m.losses} losses)`)
  lines.push(`- Net P&L: ${dollar(m.netPnL)}`)
  lines.push(`- Win Rate: ${pct(m.winRate)}`)
  lines.push(`- Profit Factor: ${pf(m.profitFactor)}`)
  lines.push(`- Expectancy: ${dollar(m.expectancy)} per trade`)
  lines.push(`- Max Drawdown: $${m.maxDD.toFixed(2)}`)
  lines.push(`- Gross Profit: $${m.grossProfit.toFixed(2)} | Gross Loss: $${m.grossLoss.toFixed(2)}`)
  lines.push(`- Avg Winner: $${m.avgWin.toFixed(2)} | Avg Loser: $${m.avgLoss.toFixed(2)}`)
  lines.push(`- Win/Loss Ratio (avg): ${m.avgLoss > 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '—'}`)
  lines.push(`- Avg Trade Duration: ${formatDuration(m.avgDuration)}`)
  lines.push(`- Total Commissions: $${m.totalComm.toFixed(2)}`)
  lines.push(`- Max Consecutive Wins: ${m.maxW} | Max Consecutive Losses: ${m.maxL}`)
  lines.push(`- Current Streak: ${m.curW > 0 ? m.curW + ' wins' : m.curL + ' losses'}`)
  lines.push('')

  // ── By Session ────────────────────────────────────────────────────────────
  const sessions = computeBySession(filtered)
  if (sessions.length) {
    lines.push(`## Performance by Trading Session`)
    lines.push(table(
      ['Session', 'Trades', 'Win Rate', 'Net P&L', 'Profit Factor', 'Avg P&L'],
      sessions.map(s => [s.label, s.total, pct(s.winRate), dollar(s.netPnL), pf(s.profitFactor), dollar(s.expectancy)])
    ))
    lines.push('')
  }

  // ── By Day of Week ────────────────────────────────────────────────────────
  const dow = computeDow(filtered).filter(d => d.count > 0)
  if (dow.length) {
    lines.push(`## Performance by Day of Week`)
    lines.push(table(
      ['Day', 'Trades', 'Avg P&L'],
      dow.map(d => [d.label, d.count, dollar(d.pnl)])
    ))
    lines.push('')
  }

  // ── By Hour ───────────────────────────────────────────────────────────────
  const hourly = computeHourly(filtered).filter(h => h.count > 0)
  if (hourly.length) {
    lines.push(`## Performance by Hour of Day`)
    lines.push(table(
      ['Hour', 'Trades', 'Avg P&L'],
      hourly.map(h => [h.label, h.count, dollar(h.pnl)])
    ))
    lines.push('')
  }

  // ── By Instrument ─────────────────────────────────────────────────────────
  const bySymbol = computeBySymbol(filtered)
  if (bySymbol.length) {
    lines.push(`## Performance by Instrument`)
    lines.push(table(
      ['Symbol', 'Trades', 'Win Rate', 'Net P&L', 'Profit Factor', 'Avg Win', 'Avg Loss'],
      bySymbol.map(s => [s.sym, s.total, pct(s.winRate), dollar(s.netPnL), pf(s.profitFactor), '$' + s.avgWin.toFixed(2), '$' + s.avgLoss.toFixed(2)])
    ))
    lines.push('')
  }

  // ── Long vs Short ─────────────────────────────────────────────────────────
  const longs  = filtered.filter(t => t.side === 'long')
  const shorts = filtered.filter(t => t.side === 'short')
  const ml = computeMetrics(longs)
  const ms = computeMetrics(shorts)
  lines.push(`## Long vs Short`)
  if (ml) lines.push(`- Long  (${longs.length} trades): Net ${dollar(ml.netPnL)} | WR ${pct(ml.winRate)} | PF ${pf(ml.profitFactor)} | Expectancy ${dollar(ml.expectancy)}`)
  else    lines.push(`- Long: no data`)
  if (ms) lines.push(`- Short (${shorts.length} trades): Net ${dollar(ms.netPnL)} | WR ${pct(ms.winRate)} | PF ${pf(ms.profitFactor)} | Expectancy ${dollar(ms.expectancy)}`)
  else    lines.push(`- Short: no data`)
  lines.push('')

  // ── By Setup/Tag ──────────────────────────────────────────────────────────
  const byTag = computeByTag(filtered).filter(t => t.tag !== 'Untagged')
  if (byTag.length) {
    lines.push(`## Performance by Setup / Tag`)
    lines.push(table(
      ['Tag', 'Trades', 'Win Rate', 'Net P&L', 'Profit Factor'],
      byTag.map(t => [t.tag, t.total, pct(t.winRate), dollar(t.netPnL), pf(t.profitFactor)])
    ))
    lines.push('')
  }

  // ── Psychology ────────────────────────────────────────────────────────────
  const byMood = computeByMood(filtered).filter(m => m.mood !== 'Not logged')
  if (byMood.length) {
    lines.push(`## Psychology — Performance by Mood`)
    lines.push(table(
      ['Mood', 'Trades', 'Win Rate', 'Net P&L', 'Profit Factor'],
      byMood.map(m => [m.mood, m.total, pct(m.winRate), dollar(m.netPnL), pf(m.profitFactor)])
    ))
    lines.push('')
  }

  const followedYes = filtered.filter(t => t.followedPlan === true)
  const followedNo  = filtered.filter(t => t.followedPlan === false)
  if (followedYes.length || followedNo.length) {
    lines.push(`## Discipline — Followed Plan vs Broke Rules`)
    const my = computeMetrics(followedYes)
    const mn = computeMetrics(followedNo)
    if (my) lines.push(`- Followed plan (${followedYes.length} trades): Net ${dollar(my.netPnL)} | WR ${pct(my.winRate)} | PF ${pf(my.profitFactor)}`)
    if (mn) lines.push(`- Broke rules  (${followedNo.length} trades): Net ${dollar(mn.netPnL)} | WR ${pct(mn.winRate)} | PF ${pf(mn.profitFactor)}`)
    lines.push('')

    // Mistake breakdown
    const mistakes = {}
    followedNo.forEach(t => { if (t.mistakeType) { mistakes[t.mistakeType] = (mistakes[t.mistakeType] || 0) + 1 } })
    if (Object.keys(mistakes).length) {
      lines.push(`## Most Common Mistakes`)
      Object.entries(mistakes).sort((a,b) => b[1]-a[1]).forEach(([m, count]) => {
        lines.push(`- ${m}: ${count} times`)
      })
      lines.push('')
    }
  }

  const byExec = computeByExecScore(filtered)
  if (byExec.length) {
    lines.push(`## Execution Score Analysis`)
    lines.push(table(
      ['Score', 'Trades', 'Win Rate', 'Net P&L'],
      byExec.map(e => [e.label, e.total, pct(e.winRate), dollar(e.netPnL)])
    ))
    lines.push('')
  }

  // ── MAE / MFE ─────────────────────────────────────────────────────────────
  const mf = computeMAEMFE(filtered)
  if (mf.winnerCount > 0 || mf.loserCount > 0) {
    lines.push(`## MAE / MFE Analysis`)
    if (mf.avgCapture !== null) {
      lines.push(`- Avg Capture Rate: ${pct(mf.avgCapture)} (how much of the max move you captured on winners)`)
      lines.push(`  Distribution: 0-20%: ${mf.captureBuckets[0].count}t | 20-40%: ${mf.captureBuckets[1].count}t | 40-60%: ${mf.captureBuckets[2].count}t | 60-80%: ${mf.captureBuckets[3].count}t | 80-100%: ${mf.captureBuckets[4].count}t`)
    }
    if (mf.avgMaeRatio !== null) lines.push(`- Entry Cleanliness (winners): ${pct(mf.avgMaeRatio)} MAE/MFE ratio (lower = cleaner entries)`)
    if (mf.avgLoserRatio !== null) lines.push(`- Losers "Almost Worked" ratio: ${pct(mf.avgLoserRatio)} MFE/MAE on losing trades`)
    lines.push('')
  }

  // ── R-Multiples ───────────────────────────────────────────────────────────
  const rData = computeRMultiples(filtered)
  if (rData) {
    lines.push(`## R-Multiple Analysis (${rData.count} trades with risk amount set)`)
    lines.push(`- Avg R per trade: ${rData.avgR > 0 ? '+' : ''}${rData.avgR}R`)
    lines.push(`- Avg Win: +${rData.avgWinR}R | Avg Loss: ${rData.avgLossR}R`)
    lines.push('')
  }

  // ── Best & Worst Trades ───────────────────────────────────────────────────
  const byProfit = [...filtered].sort((a, b) => b.profit - a.profit)
  const best5  = byProfit.slice(0, 5)
  const worst5 = byProfit.slice(-5).reverse()

  lines.push(`## Top 5 Best Trades`)
  lines.push(table(
    ['Date', 'Symbol', 'Side', 'P&L', 'Tags', 'Note'],
    best5.map(t => [
      t.entryTime ? new Date(t.entryTime).toLocaleDateString() : '—',
      t.instrument, (t.side || '').toUpperCase(),
      dollar(t.profit),
      (t.tags || []).join(', ') || '—',
      (t.note || '').slice(0, 40) || '—',
    ])
  ))
  lines.push('')

  lines.push(`## Top 5 Worst Trades`)
  lines.push(table(
    ['Date', 'Symbol', 'Side', 'P&L', 'Mood', 'Followed Plan', 'Mistake'],
    worst5.map(t => [
      t.entryTime ? new Date(t.entryTime).toLocaleDateString() : '—',
      t.instrument, (t.side || '').toUpperCase(),
      dollar(t.profit),
      t.mood || '—',
      t.followedPlan === true ? 'Yes' : t.followedPlan === false ? 'No' : '—',
      t.mistakeType || '—',
    ])
  ))
  lines.push('')

  // ── Last 20 Trades ────────────────────────────────────────────────────────
  const last20 = sorted.slice(-20).reverse()
  lines.push(`## Last 20 Trades (most recent first)`)
  lines.push(table(
    ['Date', 'Time', 'Symbol', 'Side', 'P&L', 'Mood', 'Tags'],
    last20.map(t => {
      const dt = t.entryTime ? new Date(t.entryTime) : null
      return [
        dt ? dt.toLocaleDateString() : '—',
        dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        t.instrument,
        (t.side || '').toUpperCase(),
        dollar(t.profit),
        t.mood || '—',
        (t.tags || []).join(', ') || '—',
      ]
    })
  ))
  lines.push('')

  // ── Suggested Prompt ──────────────────────────────────────────────────────
  lines.push(`---`)
  lines.push(`## Suggested Prompt for Claude`)
  lines.push(``)
  lines.push(`Paste everything above this line into Claude and use this prompt:`)
  lines.push(``)
  lines.push(`"Analyze my trading performance report above. I want you to:`)
  lines.push(`1. Identify my 3 biggest weaknesses with specific data from the report`)
  lines.push(`2. Find patterns in when I lose money (time, session, mood, mistakes)`)
  lines.push(`3. Identify where my actual edge is strongest`)
  lines.push(`4. Give me 3-5 concrete, actionable improvements I can implement immediately`)
  lines.push(`5. Flag any red flags or self-destructive patterns you see`)
  lines.push(`Be direct and specific — use the actual numbers from the report."`)

  return lines.join('\n')
}
