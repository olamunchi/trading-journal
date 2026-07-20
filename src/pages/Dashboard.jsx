import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { BarChart3, Flame } from 'lucide-react'
import { useTradeStore } from '../store/tradeStore'
import {
  filterByPeriod, computeMetrics, computeDailyEquity,
  computeMonthly, computeDow, computeHourly, computeDist, computeBySession,
  computeDayStreak, computeRuleAdherence,
  fmtPnL, pnlColor, formatDuration, toDateStr,
} from '../engine/metrics'
import { KpiCard } from '../components/ui/KpiCard'
import { ChartCard } from '../components/ui/ChartCard'
import { C, TT, AX, pnlFill } from '../lib/chartTheme'

// Three-tier hierarchy (Outcome → Pattern → Process), based on how
// TradeZella structures its own dashboard: headline numbers answer "is
// trading working right now," pattern detection answers "what's driving
// that," and process metrics are the leading indicators — they predict
// future results better than outcome metrics do, which is why they anchor
// the bottom instead of the top even though they matter just as much.
function TierLabel({ eyebrow, title }) {
  return (
    <div className="flex items-baseline gap-2 pt-1">
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{eyebrow}</span>
      <span className="text-xs text-subtle">— {title}</span>
      <div className="flex-1 border-t border-border/50 ml-1" />
    </div>
  )
}

export function Dashboard() {
  const { trades, periodFilter, customRange, sessionOffset, dailyLossLimit, setDailyLossLimit } = useTradeStore()
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput]     = useState('')
  const filtered = useMemo(() => filterByPeriod(trades, periodFilter, customRange), [trades, periodFilter, customRange])

  const todayTrades = useMemo(() => {
    const today = toDateStr(new Date())
    return trades.filter(t => t.entryTime && toDateStr(new Date(t.entryTime)) === today)
  }, [trades])
  const todayPnL  = useMemo(() => todayTrades.reduce((s, t) => s + t.profit, 0), [todayTrades])
  const todayWins = useMemo(() => todayTrades.filter(t => t.profit > 0).length, [todayTrades])

  const m    = useMemo(() => computeMetrics(filtered),        [filtered])
  const eq   = useMemo(() => computeDailyEquity(filtered),    [filtered])
  const mo   = useMemo(() => computeMonthly(filtered),        [filtered])
  const dw   = useMemo(() => computeDow(filtered),            [filtered])
  const hr   = useMemo(() => computeHourly(filtered),         [filtered])
  const ds   = useMemo(() => computeDist(filtered),           [filtered])
  const ses  = useMemo(() => computeBySession(filtered, sessionOffset), [filtered, sessionOffset])
  const streak    = useMemo(() => computeDayStreak(trades),   [trades])
  const adherence = useMemo(() => computeRuleAdherence(filtered), [filtered])

  if (!m) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-80 text-center">
        <BarChart3 size={44} className="text-subtle mb-4" />
        <div className="text-lg font-semibold text-slate-300 mb-2">No trades yet</div>
        <div className="text-sm text-muted">Import your NT8 CSV export to get started</div>
      </div>
    )
  }

  // Current drawdown from equity peak (vs. m.maxDD, which is the worst
  // peak-to-trough over the whole filtered range) — TradeZella pairs these
  // two in its headline row so you can tell "worst ever" from "right now."
  const peakEquity    = eq.length ? Math.max(...eq.map(e => e.value)) : 0
  const currentEquity = eq.length ? eq[eq.length - 1].value : 0
  const currentDD     = Math.max(0, peakEquity - currentEquity)

  // ── Today panel state ──
  const loss = Math.abs(Math.min(0, todayPnL))
  const pct  = dailyLossLimit ? Math.min(loss / dailyLossLimit, 1) : 0
  const over = dailyLossLimit && loss > dailyLossLimit
  const warnState = dailyLossLimit && pct >= 0.7 && !over

  function saveLimit() {
    const v = parseFloat(limitInput)
    if (v > 0) setDailyLossLimit(v)
    setEditingLimit(false)
  }

  const donutData = [
    { name: 'Wins',   value: m.wins,   color: C.profit },
    { name: 'Losses', value: m.losses, color: C.loss },
  ].filter(d => d.value > 0)

  const adherenceColor = !adherence ? 'text-muted'
    : adherence.rate >= 0.7 ? 'text-profit' : adherence.rate >= 0.4 ? 'text-warn' : 'text-loss'

  return (
    <div className="p-6 space-y-5">

      {/* ── Right now ── */}
      <div className={`bg-card border rounded-xl px-5 py-4 shadow-card ${over ? 'border-loss/40' : warnState ? 'border-warn/40' : 'border-border'}`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Today</div>
            <div className={`text-2xl font-bold ${pnlColor(todayPnL)}`}>{todayTrades.length ? fmtPnL(todayPnL) : '—'}</div>
          </div>
          <div className="border-l border-border pl-6">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Trades</div>
            <div className="text-2xl font-bold text-slate-200">{todayTrades.length}</div>
          </div>
          {todayTrades.length > 0 && (
            <div className="border-l border-border pl-6">
              <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${todayWins / todayTrades.length >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                {((todayWins / todayTrades.length) * 100).toFixed(0)}%
              </div>
            </div>
          )}
          <div className="border-l border-border pl-6">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Day Streak</div>
            {streak.green > 0 ? (
              <div className="text-2xl font-bold text-profit flex items-center gap-1.5">
                <Flame size={20} className="text-warn" /> {streak.green}
              </div>
            ) : streak.red > 0 ? (
              <div className="text-2xl font-bold text-loss">{streak.red} red</div>
            ) : (
              <div className="text-2xl font-bold text-muted">—</div>
            )}
          </div>

          {/* Daily loss limit */}
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                {over && <span className="text-loss mr-1">⚠</span>}Daily Loss Limit
              </span>
              {editingLimit ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">$</span>
                  <input
                    autoFocus type="number" value={limitInput}
                    onChange={e => setLimitInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
                    placeholder="e.g. 500"
                    className="w-24 bg-bg border border-border rounded-md px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-accent"
                  />
                  <button onClick={saveLimit} className="px-2 py-0.5 bg-accent text-white text-xs rounded-md">Set</button>
                  {dailyLossLimit && (
                    <button onClick={() => { setDailyLossLimit(null); setEditingLimit(false) }} className="text-xs text-loss hover:text-red-400">Remove</button>
                  )}
                  <button onClick={() => setEditingLimit(false)} className="text-xs text-muted hover:text-slate-300">Cancel</button>
                </span>
              ) : (
                <button
                  onClick={() => { setEditingLimit(true); setLimitInput(dailyLossLimit ? String(dailyLossLimit) : '') }}
                  className="text-xs text-subtle hover:text-accent transition-colors"
                >
                  {dailyLossLimit ? `$${dailyLossLimit.toFixed(0)} · edit` : '+ Set limit'}
                </button>
              )}
            </div>
            {dailyLossLimit ? (
              <>
                <div className="h-2 rounded-full bg-bg overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${over ? 'bg-loss' : warnState ? 'bg-warn' : 'bg-profit'}`} style={{ width: (pct * 100) + '%' }} />
                </div>
                <div className={`text-xs mt-1 ${over ? 'text-loss' : warnState ? 'text-warn' : 'text-subtle'}`}>
                  {over
                    ? `Limit exceeded — $${(loss - dailyLossLimit).toFixed(2)} over`
                    : loss > 0
                    ? `${(pct * 100).toFixed(0)}% used — $${(dailyLossLimit - loss).toFixed(2)} remaining`
                    : todayPnL > 0 ? `Up ${fmtPnL(todayPnL)} today — no losses yet` : 'No losses today'}
                </div>
              </>
            ) : (
              <div className="text-xs text-subtle">No daily loss limit set</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TIER 1 — OUTCOME (headline numbers) ═══ */}
      <TierLabel eyebrow="Outcome" title="is trading working right now" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard size="lg" label="Net P&L" value={fmtPnL(m.netPnL)} sub={`${m.total} trades`} valueClass={pnlColor(m.netPnL)} />
        <KpiCard size="lg" label="Win Rate" value={(m.winRate * 100).toFixed(1) + '%'} sub={`${m.wins}W / ${m.losses}L`} valueClass={m.winRate >= 0.5 ? 'text-profit' : 'text-loss'} />
        <KpiCard size="lg" label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} sub="Gross P / Gross L" valueClass={m.profitFactor >= 1 ? 'text-profit' : 'text-loss'} />
        <KpiCard
          size="lg" label="Max Drawdown" value={'-$' + m.maxDD.toFixed(2)}
          sub={currentDD > 0 ? `-$${currentDD.toFixed(2)} below peak now` : 'At equity high'}
          valueClass="text-loss"
        />
      </div>

      {/* Equity curve — trend companion to the headline row */}
      <ChartCard title="Equity Curve">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={eq}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.accent} stopOpacity={0.35} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" tick={AX} minTickGap={28} />
            <YAxis tick={AX} tickFormatter={v => '$' + v} />
            <Tooltip
              {...TT}
              formatter={(v, name, p) => [fmtPnL(v) + `  (day: ${fmtPnL(p.payload.pnl)})`, 'Equity']}
              labelFormatter={(l, p) => p?.[0]?.payload?.full ?? l}
            />
            <Area type="monotone" dataKey="value" stroke={C.accent} fill="url(#eqGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ═══ TIER 2 — PATTERN DETECTION (what's driving it) ═══ */}
      <TierLabel eyebrow="Patterns" title="what's driving the outcome" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Monthly P&L" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mo}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={v => [fmtPnL(v), 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {mo.map((e, i) => <Cell key={i} fill={pnlFill(e.pnl)} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Win / Loss">
          <div className="relative">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={donutData.length > 1 ? 3 : 0}
                  startAngle={90}
                  endAngle={-270}
                  stroke={C.card}
                  strokeWidth={2}
                >
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip {...TT} formatter={(v, n) => [`${v} trades`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className={`text-xl font-bold ${m.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                {(m.winRate * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-subtle uppercase tracking-wider">Win rate</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 text-xs text-muted mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.profit }} /> {m.wins} wins
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.loss }} /> {m.losses} losses
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Avg Win', fmtPnL(m.avgWin), 'text-profit'],
              ['Avg Loss', '-$' + m.avgLoss.toFixed(2), 'text-loss'],
              ['Avg R:R', m.avgLoss > 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '—', ''],
              ['Gross Profit', '$' + m.grossProfit.toFixed(2), 'text-profit'],
              ['Gross Loss',   '-$' + m.grossLoss.toFixed(2), 'text-loss'],
              ['Current Streak', m.curW > 0 ? `${m.curW}W` : `${m.curL}L`, m.curW > 0 ? 'text-profit' : 'text-loss'],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-bg rounded-lg p-2.5">
                <div className="text-[10px] text-muted mb-1">{l}</div>
                <div className={`font-bold text-xs ${c}`}>{v}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {ses.length > 0 && (
        <ChartCard title="Performance by Session">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ses} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.total}t, ${(p.payload.winRate * 100).toFixed(0)}% WR)`, 'Net P&L']} />
              <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                {ses.map((e, i) => <Cell key={i} fill={pnlFill(e.netPnL)} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Avg P&L by Day of Week">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dw}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.count}t)`, 'Avg P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dw.map((e, i) => <Cell key={i} fill={pnlFill(e.pnl)} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg P&L by Hour">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hr}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={1} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.count})`, 'Avg P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {hr.map((e, i) => <Cell key={i} fill={pnlFill(e.pnl)} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="P&L Distribution">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ds}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={3} />
              <YAxis tick={AX} allowDecimals={false} />
              <Tooltip {...TT} formatter={(v, n, p) => [v + ' trades', p.payload.label]} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {ds.map((e, i) => <Cell key={i} fill={e.isWin ? C.profit : C.loss} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ═══ TIER 3 — PROCESS QUALITY (leading indicators) ═══ */}
      <TierLabel eyebrow="Process" title="predicts future results better than outcome does" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard size="sm" label="Trades" value={m.total} sub="This period" />
        <KpiCard
          size="sm" label="Rule Adherence"
          value={adherence ? (adherence.rate * 100).toFixed(0) + '%' : '—'}
          sub={adherence ? `${adherence.ratedCount} rated` : 'Rate trades in drawer'}
          valueClass={adherenceColor}
        />
        <KpiCard size="sm" label="Expectancy" value={fmtPnL(m.expectancy)} sub="Avg per trade" valueClass={pnlColor(m.expectancy)} />
        <KpiCard size="sm" label="Commissions" value={'-$' + m.totalComm.toFixed(2)} sub="Total fees" valueClass="text-warn" />
        <KpiCard size="sm" label="Avg Duration" value={formatDuration(m.avgDuration)} sub="Per trade" />
        <KpiCard size="sm" label="Best Streak" value={m.maxW + ' wins'} sub={`${m.maxL} max losses`} valueClass="text-profit" />
      </div>
    </div>
  )
}
