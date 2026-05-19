import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useTradeStore } from '../store/tradeStore'
import {
  filterByPeriod, computeMetrics, computeEquityCurve,
  computeMonthly, computeDow, computeHourly, computeDist, computeBySession,
  fmtPnL, pnlColor, formatDuration,
} from '../engine/metrics'
import { KpiCard } from '../components/ui/KpiCard'
import { ChartCard } from '../components/ui/ChartCard'

const TT = {
  contentStyle: { background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 },
  cursor: { stroke: '#30363d' },
}
const AX = { stroke: '#6e7681', fontSize: 11 }

export function Dashboard() {
  const { trades, periodFilter, dailyLossLimit, setDailyLossLimit } = useTradeStore()
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput]     = useState('')
  const filtered = useMemo(() => filterByPeriod(trades, periodFilter), [trades, periodFilter])

  const todayPnL = useMemo(() => {
    const today = new Date().toLocaleDateString()
    return trades
      .filter(t => t.entryTime && new Date(t.entryTime).toLocaleDateString() === today)
      .reduce((s, t) => s + t.profit, 0)
  }, [trades])
  const m  = useMemo(() => computeMetrics(filtered),    [filtered])
  const eq = useMemo(() => computeEquityCurve(filtered),[filtered])
  const mo = useMemo(() => computeMonthly(filtered),    [filtered])
  const dw = useMemo(() => computeDow(filtered),        [filtered])
  const hr = useMemo(() => computeHourly(filtered),     [filtered])
  const ds  = useMemo(() => computeDist(filtered),       [filtered])
  const ses = useMemo(() => computeBySession(filtered),  [filtered])

  if (!m) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-80 text-center">
        <div className="text-5xl mb-4">📊</div>
        <div className="text-lg font-semibold text-slate-300 mb-2">No trades yet</div>
        <div className="text-sm text-muted">Import your NT8 CSV export to get started</div>
      </div>
    )
  }

  const kpis = [
    { label: 'Net P&L',       value: fmtPnL(m.netPnL),                           sub: `${m.total} trades`,        valueClass: pnlColor(m.netPnL) },
    { label: 'Win Rate',      value: (m.winRate * 100).toFixed(1) + '%',          sub: `${m.wins}W / ${m.losses}L`, valueClass: m.winRate >= 0.5 ? 'text-profit' : 'text-loss' },
    { label: 'Profit Factor', value: m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2), sub: 'Gross P / Gross L', valueClass: m.profitFactor >= 1 ? 'text-profit' : 'text-loss' },
    { label: 'Expectancy',    value: fmtPnL(m.expectancy),                        sub: 'Avg per trade',            valueClass: pnlColor(m.expectancy) },
    { label: 'Avg Winner',    value: fmtPnL(m.avgWin),                            sub: `${m.wins} winning trades`, valueClass: 'text-profit' },
    { label: 'Avg Loser',     value: '-$' + m.avgLoss.toFixed(2),                 sub: `${m.losses} losing trades`, valueClass: 'text-loss' },
    { label: 'Max Drawdown',  value: '-$' + m.maxDD.toFixed(2),                   sub: 'Peak to trough',           valueClass: 'text-loss' },
    { label: 'Commissions',   value: '-$' + m.totalComm.toFixed(2),               sub: 'Total fees paid',          valueClass: 'text-warn' },
    { label: 'Best Streak',   value: m.maxW + ' wins',                            sub: `${m.maxL} max losses`,     valueClass: 'text-profit' },
    { label: 'Avg Duration',  value: formatDuration(m.avgDuration),               sub: 'Per trade',                valueClass: '' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Daily loss limit tracker */}
      {(() => {
        const loss = Math.abs(Math.min(0, todayPnL))
        const pct  = dailyLossLimit ? Math.min(loss / dailyLossLimit, 1) : 0
        const over = dailyLossLimit && loss > dailyLossLimit
        const warn = dailyLossLimit && pct >= 0.7 && !over

        function saveLimit() {
          const v = parseFloat(limitInput)
          if (v > 0) setDailyLossLimit(v)
          setEditingLimit(false)
        }

        if (!dailyLossLimit) return (
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
            <span className="text-sm text-muted">No daily loss limit set</span>
            {editingLimit ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">$</span>
                <input
                  autoFocus
                  type="number"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
                  placeholder="e.g. 500"
                  className="w-28 bg-bg border border-border rounded-md px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-accent"
                />
                <button onClick={saveLimit} className="px-3 py-1 bg-accent text-white text-xs rounded-md">Set</button>
                <button onClick={() => setEditingLimit(false)} className="text-muted text-xs hover:text-slate-300">Cancel</button>
              </div>
            ) : (
              <button onClick={() => { setEditingLimit(true); setLimitInput('') }} className="text-xs text-accent hover:text-blue-400 transition-colors">
                + Set daily loss limit
              </button>
            )}
          </div>
        )

        const barColor = over ? 'bg-loss' : warn ? 'bg-warn' : 'bg-profit'
        const borderColor = over ? 'border-loss/40' : warn ? 'border-warn/40' : 'border-border'

        return (
          <div className={`bg-card border rounded-xl px-5 py-4 ${borderColor}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {over && <span className="text-loss text-sm">⚠</span>}
                <span className="text-xs text-muted uppercase tracking-wider">Daily Loss Limit</span>
              </div>
              <div className="flex items-center gap-3">
                {editingLimit ? (
                  <>
                    <span className="text-sm text-muted">$</span>
                    <input
                      autoFocus
                      type="number"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
                      className="w-24 bg-bg border border-border rounded-md px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-accent"
                    />
                    <button onClick={saveLimit} className="px-3 py-1 bg-accent text-white text-xs rounded-md">Save</button>
                    <button onClick={() => { setDailyLossLimit(null); setEditingLimit(false) }} className="text-xs text-loss hover:text-red-400">Remove</button>
                    <button onClick={() => setEditingLimit(false)} className="text-xs text-muted hover:text-slate-300">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingLimit(true); setLimitInput(String(dailyLossLimit)) }} className="text-xs text-subtle hover:text-muted transition-colors">
                    Edit limit
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted mb-1.5">
                  <span>Today: <span className={loss > 0 ? 'text-loss font-medium' : 'text-profit font-medium'}>{todayPnL >= 0 ? fmtPnL(todayPnL) : '-$' + loss.toFixed(2)}</span></span>
                  <span>Limit: <span className="text-slate-300">${dailyLossLimit.toFixed(0)}</span></span>
                </div>
                <div className="h-2 rounded-full bg-bg overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: (pct * 100) + '%' }} />
                </div>
                <div className={`text-xs mt-1.5 ${over ? 'text-loss' : warn ? 'text-warn' : 'text-subtle'}`}>
                  {over
                    ? `Limit exceeded — $${(loss - dailyLossLimit).toFixed(2)} over`
                    : loss > 0
                    ? `${(pct * 100).toFixed(0)}% used — $${(dailyLossLimit - loss).toFixed(2)} remaining`
                    : todayPnL > 0 ? `Up ${fmtPnL(todayPnL)} today — no losses yet` : 'No trades today'}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Equity curve */}
      <ChartCard title="Equity Curve">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={eq}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#388bfd" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="i" tick={AX} />
            <YAxis tick={AX} tickFormatter={v => '$' + v} />
            <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Equity']} labelFormatter={l => `Trade #${l}`} />
            <Area type="monotone" dataKey="value" stroke="#388bfd" fill="url(#eq)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly + Win/Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Monthly P&L" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={mo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={v => [fmtPnL(v), 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {mo.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Win / Loss Summary">
          <div className="space-y-4 mt-1">
            <div>
              <div className="flex justify-between text-xs text-muted mb-1.5">
                <span>Win Rate</span><span className="text-profit font-medium">{(m.winRate * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-bg overflow-hidden">
                <div className="h-full bg-profit rounded-full transition-all" style={{ width: (m.winRate * 100) + '%' }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ['Gross Profit', '$' + m.grossProfit.toFixed(2), 'text-profit'],
                ['Gross Loss',   '-$' + m.grossLoss.toFixed(2), 'text-loss'],
                ['Current Streak', m.curW > 0 ? `${m.curW}W` : `${m.curL}L`, m.curW > 0 ? 'text-profit' : 'text-loss'],
                ['Avg R:R', m.avgLoss > 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '—', ''],
              ].map(([l, v, c]) => (
                <div key={l} className="bg-bg rounded-lg p-3">
                  <div className="text-xs text-muted mb-1">{l}</div>
                  <div className={`font-bold text-sm ${c}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Sessions */}
      {ses.length > 0 && (
        <ChartCard title="Performance by Session">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ses} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.total}t, ${(p.payload.winRate * 100).toFixed(0)}% WR)`, 'Net P&L']} />
              <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                {ses.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* DoW, Hour, Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Avg P&L by Day of Week">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dw}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" tick={AX} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.count}t)`, 'Avg P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dw.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg P&L by Hour">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hr}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={1} />
              <YAxis tick={AX} tickFormatter={v => '$' + v} />
              <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.count})`, 'Avg P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {hr.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="P&L Distribution">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ds}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={3} />
              <YAxis tick={AX} allowDecimals={false} />
              <Tooltip {...TT} formatter={(v, n, p) => [v + ' trades', p.payload.label]} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {ds.map((e, i) => <Cell key={i} fill={e.isWin ? '#3fb950' : '#f85149'} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
