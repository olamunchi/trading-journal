import { useMemo, useState } from 'react'
import { BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTradeStore } from '../store/tradeStore'
import {
  filterByPeriod, computeMetrics, computeBySymbol, computeByTag,
  computeBySession, computeByMood, computeByExecScore, computeByConfidence, computeDisciplineScore, computeDow,
  computeMAEMFE, computeRMultiples, computeTradeR,
  fmtPnL, pnlColor,
} from '../engine/metrics'
import { ChartCard } from '../components/ui/ChartCard'

const TT = {
  contentStyle: { background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 },
}
const AX = { stroke: '#6e7681', fontSize: 11 }

const TABS = [
  { id: 'symbol',   label: 'By Symbol' },
  { id: 'tag',      label: 'By Setup/Tag' },
  { id: 'session',  label: 'Time Analysis' },
  { id: 'side',     label: 'Long vs Short' },
  { id: 'psych',    label: 'Psychology' },
  { id: 'emotions', label: 'Emotions' },
  { id: 'maemfe',   label: 'MAE/MFE' },
  { id: 'rmultiple',label: 'R-Multiple' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'best',     label: 'Best & Worst' },
]

export function Analytics() {
  const { trades, periodFilter, sessionOffset, setSessionOffset } = useTradeStore()
  const [tab, setTab] = useState('symbol')

  const filtered  = useMemo(() => filterByPeriod(trades, periodFilter), [trades, periodFilter])
  const bySymbol  = useMemo(() => computeBySymbol(filtered),    [filtered])
  const byTag     = useMemo(() => computeByTag(filtered),       [filtered])
  const bySession = useMemo(() => computeBySession(filtered, sessionOffset), [filtered, sessionOffset])
  const byMood    = useMemo(() => computeByMood(filtered),        [filtered])
  const byConf    = useMemo(() => computeByConfidence(filtered), [filtered])
  const byExec    = useMemo(() => computeByExecScore(filtered),  [filtered])
  const maemfe    = useMemo(() => computeMAEMFE(filtered),      [filtered])
  const scatterData = useMemo(() => ({
    wins:   filtered.filter(t => t.profit > 0  && t.mae != null && t.mfe != null).map(t => ({ mae: t.mae, mfe: t.mfe, instrument: t.instrument, profit: t.profit })),
    losses: filtered.filter(t => t.profit <= 0 && t.mae != null && t.mfe != null).map(t => ({ mae: t.mae, mfe: t.mfe, instrument: t.instrument, profit: t.profit })),
  }), [filtered])
  const rData     = useMemo(() => computeRMultiples(filtered),  [filtered])
  const longs     = useMemo(() => filtered.filter(t => t.side === 'long'),  [filtered])
  const shorts    = useMemo(() => filtered.filter(t => t.side === 'short'), [filtered])
  const ml        = useMemo(() => computeMetrics(longs),  [longs])
  const ms        = useMemo(() => computeMetrics(shorts), [shorts])
  const sortedAll = useMemo(() => [...filtered].sort((a, b) => b.profit - a.profit), [filtered])
  const byDow     = useMemo(() => computeDow(filtered).filter(d => d.count > 0), [filtered])

  if (!filtered.length) {
    return (
      <div className="p-6 flex items-center justify-center h-80">
        <div className="text-center"><div className="text-5xl mb-4">🔬</div><div className="text-muted">No trades to analyze.</div></div>
      </div>
    )
  }

  // ── Shared sub-components ─────────────────────────────────────────────────

  function StatsTable({ data, nameKey = 'sym' }) {
    return (
      <>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey={nameKey} tick={AX} />
            <YAxis tick={AX} tickFormatter={v => '$' + v} />
            <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
            <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
              {data.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>{['Name', 'Trades', 'Win Rate', 'Avg Win', 'Avg Loss', 'PF', 'Net P&L'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs text-muted uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-semibold">{r[nameKey]}</td>
                  <td className="px-3 py-2.5">{r.total}</td>
                  <td className={`px-3 py-2.5 ${r.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>{(r.winRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-profit">{fmtPnL(r.avgWin)}</td>
                  <td className="px-3 py-2.5 text-loss">-${r.avgLoss.toFixed(2)}</td>
                  <td className={`px-3 py-2.5 ${r.profitFactor >= 1 ? 'text-profit' : 'text-loss'}`}>{r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}</td>
                  <td className={`px-3 py-2.5 font-bold ${pnlColor(r.netPnL)}`}>{fmtPnL(r.netPnL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function SideStats({ m, label, count, color }) {
    const textColor = color === 'profit' ? 'text-profit' : 'text-loss'
    return (
      <div className={`border-l-2 pl-4 ${color === 'profit' ? 'border-profit' : 'border-loss'}`}>
        <div className={`font-bold text-base mb-3 ${textColor}`}>{label} ({count})</div>
        {m ? (
          <div className="space-y-2 text-sm">
            {[
              ['Net P&L', fmtPnL(m.netPnL), pnlColor(m.netPnL)],
              ['Win Rate', (m.winRate * 100).toFixed(1) + '%', m.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
              ['Profit Factor', m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2), m.profitFactor >= 1 ? 'text-profit' : 'text-loss'],
              ['Avg Winner', fmtPnL(m.avgWin), 'text-profit'],
              ['Avg Loser', '-$' + m.avgLoss.toFixed(2), 'text-loss'],
              ['Expectancy', fmtPnL(m.expectancy), pnlColor(m.expectancy)],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between">
                <span className="text-muted">{l}</span><span className={`font-medium ${c}`}>{v}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-muted text-sm">No {label.toLowerCase()} trades</div>}
      </div>
    )
  }

  function TradeCard({ t }) {
    const r = computeTradeR(t)
    return (
      <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${t.profit >= 0 ? 'bg-profit/5 border border-profit/20' : 'bg-loss/5 border border-loss/20'}`}>
        <div>
          <div className="font-semibold text-sm">{t.instrument}</div>
          <div className="text-xs text-muted mt-0.5">{t.entryTime ? new Date(t.entryTime).toLocaleDateString() : '—'} · {(t.side || '').toUpperCase()}</div>
        </div>
        <div className="text-right">
          <div className={`font-bold ${pnlColor(t.profit)}`}>{fmtPnL(t.profit)}</div>
          {r !== null && <div className={`text-xs font-medium ${r >= 0 ? 'text-profit' : 'text-loss'}`}>{r > 0 ? '+' : ''}{r.toFixed(2)}R</div>}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === id ? 'bg-accent text-white' : 'text-muted hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── By Symbol ── */}
      {tab === 'symbol' && (
        <ChartCard title="Performance by Symbol">
          <StatsTable data={bySymbol} nameKey="sym" />
        </ChartCard>
      )}

      {/* ── By Tag ── */}
      {tab === 'tag' && (
        <ChartCard title="Performance by Setup / Tag">
          {byTag.every(r => r.tag === 'Untagged')
            ? <div className="text-muted text-sm py-10 text-center">No tags yet. Click any trade in Trade Log to add setup tags.</div>
            : <StatsTable data={byTag.map(r => ({ ...r, sym: r.tag }))} nameKey="sym" />}
        </ChartCard>
      )}

      {/* ── Time Analysis ── */}
      {tab === 'session' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">Data timezone:</span>
            <select
              value={sessionOffset}
              onChange={e => setSessionOffset(Number(e.target.value))}
              className="bg-card border border-border rounded-md px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-accent"
            >
              <option value={0}>ET (Eastern Time) — default</option>
              <option value={1}>CT (Central Time, UTC-6/-5)</option>
              <option value={2}>MT (Mountain Time, UTC-7/-6)</option>
              <option value={3}>PT (Pacific Time, UTC-8/-7)</option>
              <option value={5}>GMT / WET (Portugal Winter, UK Winter)</option>
              <option value={6}>CET (Portugal Summer / Central Europe Winter)</option>
              <option value={7}>CEST (Central Europe Summer)</option>
            </select>
            <span className="text-subtle text-xs">Adjusts session hour classification to match your broker's time</span>
          </div>
          <ChartCard title="Performance by Time of Day">
            {bySession.length === 0
              ? <div className="text-muted text-sm py-10 text-center">No session data available.</div>
              : <StatsTable data={bySession.map(r => ({ ...r, sym: r.label }))} nameKey="sym" />}
          </ChartCard>
          <ChartCard title="Performance by Day of Week">
            {byDow.length === 0
              ? <div className="text-muted text-sm py-10 text-center">No data available.</div>
              : <StatsTable data={byDow.map(r => ({ ...r, sym: r.label }))} nameKey="sym" />}
          </ChartCard>
        </div>
      )}

      {/* ── Long vs Short ── */}
      {tab === 'side' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Long vs Short Breakdown">
            <div className="grid grid-cols-2 gap-8 mt-2">
              <SideStats m={ml} label="Long"  count={longs.length}  color="profit" />
              <SideStats m={ms} label="Short" count={shorts.length} color="loss"   />
            </div>
          </ChartCard>
          <ChartCard title="Net P&L Comparison">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[{ label: 'Long', pnl: ml?.netPnL || 0 }, { label: 'Short', pnl: ms?.netPnL || 0 }]} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="label" tick={AX} />
                <YAxis tick={AX} tickFormatter={v => '$' + v} />
                <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  <Cell fill={(ml?.netPnL || 0) >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />
                  <Cell fill={(ms?.netPnL || 0) >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── Psychology ── */}
      {tab === 'psych' && (
        <div className="space-y-4">

          {/* Discipline Score */}
          {(() => {
            const ds = computeDisciplineScore(filtered)
            if (!ds) return (
              <div className="bg-card border border-border rounded-xl p-5 text-center text-sm text-muted">
                Rate at least 3 trades using <strong>Followed Plan?</strong> in the Trade Drawer to generate your Discipline Score.
              </div>
            )
            const { score, components, ratedCount, totalTrades } = ds
            const scoreColor  = score >= 75 ? 'text-profit' : score >= 55 ? 'text-accent' : score >= 40 ? 'text-warn' : 'text-loss'
            const scoreLabel  = score >= 90 ? 'Elite Discipline' : score >= 75 ? 'Strong Discipline' : score >= 55 ? 'Solid Discipline' : score >= 40 ? 'Needs Work' : 'High Tilt Risk'
            const barColor = pct => pct >= 0.75 ? 'bg-profit' : pct >= 0.5 ? 'bg-accent' : pct >= 0.3 ? 'bg-warn' : 'bg-loss'
            return (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="text-xs text-muted uppercase tracking-wider mb-4">Discipline Score</div>
                <div className="flex items-center gap-8">
                  <div className="text-center flex-shrink-0 w-28">
                    <div className={`text-6xl font-bold leading-none ${scoreColor}`}>{score}</div>
                    <div className="text-xs text-subtle mt-1">/ 100</div>
                    <div className={`text-xs font-semibold mt-2 ${scoreColor}`}>{scoreLabel}</div>
                  </div>
                  <div className="flex-1 space-y-3">
                    {components.map(c => (
                      <div key={c.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">{c.label}</span>
                          <span className="text-subtle">{c.score} / {c.max} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor(c.pct)}`} style={{ width: (c.pct * 100) + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border text-xs text-subtle">
                  Based on {ratedCount} rated trades out of {totalTrades} total
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Performance by Mood">
              {byMood.length === 0 || byMood.every(r => r.mood === 'Not logged')
                ? <div className="text-muted text-sm py-8 text-center">No mood data yet. Log your mood in the Trade Drawer.</div>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={byMood}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="mood" tick={AX} />
                        <YAxis tick={AX} tickFormatter={v => '$' + v} />
                        <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
                        <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                          {byMood.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border">
                          <tr>{['Mood', 'Trades', 'Win %', 'PF', 'Net P&L'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-muted uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {byMood.map((r, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="px-3 py-2.5 font-semibold">{r.mood}</td>
                              <td className="px-3 py-2.5">{r.total}</td>
                              <td className={`px-3 py-2.5 ${r.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>{(r.winRate * 100).toFixed(1)}%</td>
                              <td className={`px-3 py-2.5 ${r.profitFactor >= 1 ? 'text-profit' : 'text-loss'}`}>{r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}</td>
                              <td className={`px-3 py-2.5 font-bold ${pnlColor(r.netPnL)}`}>{fmtPnL(r.netPnL)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </ChartCard>

            <ChartCard title="Performance by Execution Score">
              {byExec.length === 0
                ? <div className="text-muted text-sm py-8 text-center">No execution scores yet. Rate your trades 1–5 in the Trade Drawer.</div>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={byExec}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="score" tick={AX} />
                        <YAxis tick={AX} tickFormatter={v => '$' + v} />
                        <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.total}t)`, p.payload.label]} />
                        <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                          {byExec.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border">
                          <tr>{['Score', 'Trades', 'Win %', 'Net P&L'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-muted uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {byExec.map((r, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="px-3 py-2.5 font-semibold">{r.label}</td>
                              <td className="px-3 py-2.5">{r.total}</td>
                              <td className={`px-3 py-2.5 ${r.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>{(r.winRate * 100).toFixed(1)}%</td>
                              <td className={`px-3 py-2.5 font-bold ${pnlColor(r.netPnL)}`}>{fmtPnL(r.netPnL)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </ChartCard>
          </div>

          {/* Followed plan stats */}
          {(() => {
            const yes = filtered.filter(t => t.followedPlan === true)
            const no  = filtered.filter(t => t.followedPlan === false)
            if (!yes.length && !no.length) return null
            const my = computeMetrics(yes), mn = computeMetrics(no)
            return (
              <ChartCard title="Followed Plan vs Broke Rules">
                <div className="grid grid-cols-2 gap-8 mt-2">
                  <SideStats m={my} label="✓ Followed Plan" count={yes.length} color="profit" />
                  <SideStats m={mn} label="✗ Broke Rules"  count={no.length}  color="loss"   />
                </div>
              </ChartCard>
            )
          })()}
        </div>
      )}

      {/* ── Emotions ── */}
      {tab === 'emotions' && (() => {
        const noMoodData = byMood.length === 0 || byMood.every(r => r.mood === 'Not logged')
        const noConfData = byConf.length === 0

        // mood × confidence combo detector (min 2 trades)
        const combos = {}
        filtered.forEach(t => {
          if (!t.mood || !t.confidence) return
          const key = `${t.mood.charAt(0).toUpperCase() + t.mood.slice(1)} + ${t.confidence} confidence`
          if (!combos[key]) combos[key] = []
          combos[key].push(t)
        })
        const comboList = Object.entries(combos)
          .filter(([, v]) => v.length >= 2)
          .map(([name, ts]) => ({ name, count: ts.length, ...computeMetrics(ts) }))
          .sort((a, b) => b.expectancy - a.expectancy)
        const bestState  = comboList[0] ?? null
        const worstState = comboList[comboList.length - 1] ?? null

        function EmotionTable({ data, nameKey, nameLabel }) {
          return (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>{[nameLabel, 'Trades', 'Win %', 'PF', 'Expectancy', 'Net P&L'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs text-muted uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-semibold">{r[nameKey]}</td>
                      <td className="px-3 py-2.5 text-muted">{r.total}</td>
                      <td className={`px-3 py-2.5 ${r.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>{(r.winRate * 100).toFixed(1)}%</td>
                      <td className={`px-3 py-2.5 ${r.profitFactor >= 1 ? 'text-profit' : 'text-loss'}`}>{r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}</td>
                      <td className={`px-3 py-2.5 font-medium ${pnlColor(r.expectancy)}`}>{fmtPnL(r.expectancy)}</td>
                      <td className={`px-3 py-2.5 font-bold ${pnlColor(r.netPnL)}`}>{fmtPnL(r.netPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <div className="space-y-4">

            {/* Mood + Confidence charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              <ChartCard title="Performance by Mood">
                {noMoodData
                  ? <div className="text-muted text-sm py-8 text-center">No mood data yet. Log your mood in the Trade Drawer.</div>
                  : <>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={byMood}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="mood" tick={AX} />
                          <YAxis tick={AX} tickFormatter={v => '$' + v} />
                          <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
                          <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                            {byMood.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <EmotionTable data={byMood} nameKey="mood" nameLabel="Mood" />
                    </>
                }
              </ChartCard>

              <ChartCard title="Performance by Confidence">
                {noConfData
                  ? <div className="text-muted text-sm py-8 text-center">No confidence data yet. Rate your confidence in the Trade Drawer.</div>
                  : <>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={byConf}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="confidence" tick={AX} />
                          <YAxis tick={AX} tickFormatter={v => '$' + v} />
                          <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
                          <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                            {byConf.map((e, i) => <Cell key={i} fill={e.netPnL >= 0 ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <EmotionTable data={byConf} nameKey="confidence" nameLabel="Confidence" />
                    </>
                }
              </ChartCard>
            </div>

            {/* Best / worst trading state */}
            {comboList.length >= 2 && (
              <ChartCard title="Best & Worst Trading State">
                <div className="text-xs text-muted mb-4">Mood + confidence combos with at least 2 trades — ranked by expectancy</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    { state: bestState,  label: '✓ Best State',  border: 'border-profit/30', tag: 'text-profit' },
                    { state: worstState, label: '✗ Worst State', border: 'border-loss/30',   tag: 'text-loss'   },
                  ].map(({ state, label, border, tag }) => state && (
                    <div key={label} className={`bg-bg border rounded-xl p-4 ${border}`}>
                      <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${tag}`}>{label}</div>
                      <div className="font-bold text-slate-200 text-base mb-3">{state.name}</div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        {[
                          ['Trades',      state.count,                                        ''],
                          ['Win Rate',    (state.winRate * 100).toFixed(0) + '%',             state.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
                          ['Expectancy',  fmtPnL(state.expectancy),                           pnlColor(state.expectancy)],
                          ['Profit Factor', state.profitFactor === Infinity ? '∞' : state.profitFactor.toFixed(2), state.profitFactor >= 1 ? 'text-profit' : 'text-loss'],
                          ['Avg Win',     fmtPnL(state.avgWin),                               'text-profit'],
                          ['Avg Loss',    '-$' + state.avgLoss.toFixed(2),                    'text-loss'],
                        ].map(([l, v, c]) => (
                          <div key={l}>
                            <div className="text-subtle mb-0.5">{l}</div>
                            <div className={`font-semibold ${c}`}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {comboList.length > 2 && (
                  <div className="mt-4 space-y-1.5">
                    {comboList.slice(1, -1).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-bg hover:bg-white/[0.03]">
                        <span className="text-muted">{s.name} <span className="text-subtle">({s.count}t)</span></span>
                        <div className="flex gap-4">
                          <span className={pnlColor(s.expectancy)}>{fmtPnL(s.expectancy)} exp</span>
                          <span className={s.winRate >= 0.5 ? 'text-profit' : 'text-loss'}>{(s.winRate * 100).toFixed(0)}% WR</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            )}

            {(noMoodData && noConfData) && (
              <div className="text-center py-16 text-muted">
                Start logging mood and confidence in the Trade Drawer to see emotional state correlations.
              </div>
            )}
          </div>
        )
      })()}

      {/* ── MAE / MFE ── */}
      {tab === 'maemfe' && (
        <div className="space-y-4">
          {maemfe.winnerCount === 0 && maemfe.loserCount === 0 ? (
            <div className="text-muted text-sm py-10 text-center">No MAE/MFE data. Make sure those columns are mapped at import.</div>
          ) : (
            <>
              {/* MAE vs MFE Scatter */}
              {(scatterData.wins.length > 0 || scatterData.losses.length > 0) && (
                <ChartCard title="MAE vs MFE Scatter — All Trades">
                  <div className="text-xs text-muted mb-3">
                    Each dot is one trade. X = max adverse excursion (heat taken), Y = max favorable excursion (max move in your direction).
                    Winners cluster top-left (big move, low heat). Losers cluster bottom-right (lots of heat, little move).
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="mae" type="number" tick={AX} name="MAE"
                        label={{ value: 'MAE ($)', position: 'insideBottom', offset: -15, fill: '#6e7681', fontSize: 11 }}
                        tickFormatter={v => '$' + v} />
                      <YAxis dataKey="mfe" type="number" tick={AX} name="MFE"
                        label={{ value: 'MFE ($)', angle: -90, position: 'insideLeft', fill: '#6e7681', fontSize: 11 }}
                        tickFormatter={v => '$' + v} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          return (
                            <div style={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}>
                              <div className="font-semibold text-slate-200 mb-1">{d.instrument}</div>
                              <div className={d.profit >= 0 ? 'text-profit' : 'text-loss'}>{fmtPnL(d.profit)}</div>
                              <div className="text-muted mt-1.5">MAE: ${d.mae.toFixed(2)}</div>
                              <div className="text-muted">MFE: ${d.mfe.toFixed(2)}</div>
                            </div>
                          )
                        }}
                      />
                      <Scatter name="Winners" data={scatterData.wins}   fill="#3fb950" fillOpacity={0.65} />
                      <Scatter name="Losers"  data={scatterData.losses} fill="#f85149" fillOpacity={0.65} />
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 justify-center mt-1 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#3fb950' }} />
                      Winners ({scatterData.wins.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#f85149' }} />
                      Losers ({scatterData.losses.length})
                    </span>
                  </div>
                </ChartCard>
              )}

              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Avg Capture Rate</div>
                  <div className={`text-2xl font-bold ${maemfe.avgCapture >= 0.5 ? 'text-profit' : 'text-warn'}`}>
                    {maemfe.avgCapture !== null ? (maemfe.avgCapture * 100).toFixed(1) + '%' : '—'}
                  </div>
                  <div className="text-xs text-subtle mt-1">Exit ÷ MFE on winners</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Entry Cleanliness</div>
                  <div className={`text-2xl font-bold ${maemfe.avgMaeRatio !== null && maemfe.avgMaeRatio < 0.3 ? 'text-profit' : 'text-warn'}`}>
                    {maemfe.avgMaeRatio !== null ? (maemfe.avgMaeRatio * 100).toFixed(1) + '%' : '—'}
                  </div>
                  <div className="text-xs text-subtle mt-1">MAE ÷ MFE on winners — lower = cleaner</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Losers Almost Worked</div>
                  <div className={`text-2xl font-bold ${maemfe.avgLoserRatio !== null && maemfe.avgLoserRatio > 0.5 ? 'text-warn' : 'text-muted'}`}>
                    {maemfe.avgLoserRatio !== null ? (maemfe.avgLoserRatio * 100).toFixed(1) + '%' : '—'}
                  </div>
                  <div className="text-xs text-subtle mt-1">MFE ÷ MAE on losers — higher = near target</div>
                </div>
              </div>

              {/* Capture rate distribution */}
              {maemfe.winnerCount > 0 && (
                <ChartCard title={`Exit Quality — Capture Rate Distribution (${maemfe.winnerCount} winning trades)`}>
                  <div className="mb-3 text-sm text-muted">
                    How much of the max move (MFE) did you actually capture on winning trades?
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={maemfe.captureBuckets} barSize={48}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                      <XAxis dataKey="label" tick={AX} />
                      <YAxis tick={AX} allowDecimals={false} />
                      <Tooltip {...TT} formatter={v => [v + ' trades', 'Count']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#388bfd" fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 p-3 bg-bg rounded-lg text-xs text-muted">
                    {maemfe.avgCapture !== null && maemfe.avgCapture < 0.4
                      ? '⚠ You capture less than 40% of your winning moves on average — consider holding winners longer or using a trailing stop.'
                      : maemfe.avgCapture !== null && maemfe.avgCapture > 0.7
                      ? '✓ Strong exit discipline — capturing over 70% of your winning moves.'
                      : '→ Moderate capture rate. Review the 0–40% bucket — those are trades where you left significant gains on the table.'}
                  </div>
                </ChartCard>
              )}

              {/* Entry cleanliness explanation */}
              <ChartCard title="Entry Quality & Stop Placement">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm font-semibold mb-2">Entry Cleanliness (winners only)</div>
                    <div className="text-xs text-muted mb-3">
                      MAE ÷ MFE ratio — how far against you did the trade go before hitting target?
                      A ratio below 20% means clean entries. Above 50% means the trade was very messy.
                    </div>
                    {maemfe.avgMaeRatio !== null ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Average ratio</span>
                          <span className={`font-bold ${maemfe.avgMaeRatio < 0.3 ? 'text-profit' : maemfe.avgMaeRatio < 0.5 ? 'text-warn' : 'text-loss'}`}>
                            {(maemfe.avgMaeRatio * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-bg overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${maemfe.avgMaeRatio < 0.3 ? 'bg-profit' : maemfe.avgMaeRatio < 0.5 ? 'bg-warn' : 'bg-loss'}`}
                            style={{ width: (maemfe.avgMaeRatio * 100) + '%' }} />
                        </div>
                        <div className="text-xs text-subtle">
                          {maemfe.avgMaeRatio < 0.25
                            ? 'Excellent — clean entries with minimal heat before the move.'
                            : maemfe.avgMaeRatio < 0.5
                            ? 'Average — some entries are messy. Review your entry triggers.'
                            : 'High heat on winners — entries may be early or stops are too tight.'}
                        </div>
                      </div>
                    ) : <div className="text-muted text-sm">No data available</div>}
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-2">Stop Placement (losers analysis)</div>
                    <div className="text-xs text-muted mb-3">
                      MFE ÷ MAE ratio on losing trades — how close did the price come to your target before stopping you out?
                      High = trades "almost worked". Low = trades moved straight against you.
                    </div>
                    {maemfe.avgLoserRatio !== null ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Average ratio</span>
                          <span className={`font-bold ${maemfe.avgLoserRatio > 0.5 ? 'text-warn' : 'text-muted'}`}>
                            {(maemfe.avgLoserRatio * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-bg overflow-hidden">
                          <div className="h-full bg-warn rounded-full transition-all"
                            style={{ width: Math.min(maemfe.avgLoserRatio * 100, 100) + '%' }} />
                        </div>
                        <div className="text-xs text-subtle">
                          {maemfe.avgLoserRatio > 0.6
                            ? 'Losers frequently came close to target — consider giving more room or reviewing exit timing.'
                            : 'Losers moved decisively against you — stops may be well-placed.'}
                        </div>
                      </div>
                    ) : <div className="text-muted text-sm">No data available</div>}
                  </div>
                </div>
              </ChartCard>
            </>
          )}
        </div>
      )}

      {/* ── R-Multiple ── */}
      {tab === 'rmultiple' && (
        <div className="space-y-4">
          {!rData ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <div className="text-3xl mb-3">📐</div>
              <div className="text-slate-300 font-semibold mb-2">No R-multiple data yet</div>
              <div className="text-sm text-muted max-w-md mx-auto">
                Open any trade in the Trade Log, enter your <strong>Stop Price</strong> in the drawer, and save.
                R-multiple is calculated automatically from your entry and stop distance.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Avg R', (rData.avgR > 0 ? '+' : '') + rData.avgR + 'R', rData.avgR >= 0 ? 'text-profit' : 'text-loss', 'Expectancy in R'],
                  ['Avg Win R', '+' + rData.avgWinR + 'R', 'text-profit', 'Per winning trade'],
                  ['Avg Loss R', rData.avgLossR + 'R', 'text-loss', 'Per losing trade'],
                  ['Trades w/ R', rData.count, '', 'Have stop price set'],
                ].map(([l, v, c, sub]) => (
                  <div key={l} className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted uppercase tracking-wider mb-1.5">{l}</div>
                    <div className={`text-2xl font-bold ${c}`}>{v}</div>
                    <div className="text-xs text-subtle mt-1">{sub}</div>
                  </div>
                ))}
              </div>

              <ChartCard title="R-Multiple Distribution">
                <div className="text-xs text-muted mb-3">How many trades landed at each R-multiple level</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={rData.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={1} />
                    <YAxis tick={AX} allowDecimals={false} />
                    <Tooltip {...TT} formatter={v => [v + ' trades', 'Count']} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {rData.distribution.map((e, i) => <Cell key={i} fill={e.isWin ? '#3fb950' : '#f85149'} fillOpacity={0.8} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </div>
      )}

      {/* ── Patterns ── */}
      {tab === 'patterns' && (() => {
        const MIN = 3
        const withMin = arr => arr.filter(r => r.count >= MIN)
        const sessions = withMin(bySession)
        const days     = withMin(byDow)
        const setups   = withMin(byTag.filter(r => r.tag !== 'Untagged'))

        const best = arr => arr.length ? arr.reduce((b, r) => r.expectancy > b.expectancy ? r : b) : null
        const worst = arr => arr.length ? arr.reduce((b, r) => r.expectancy < b.expectancy ? r : b) : null

        const redFlags = [
          ...sessions.filter(r => r.winRate < 0.4 && r.netPnL < 0).map(r => `${r.label} time block — ${(r.winRate*100).toFixed(0)}% win rate, ${fmtPnL(r.netPnL)} net`),
          ...days.filter(r => r.winRate < 0.4 && r.netPnL < 0).map(r => `${r.label} — ${(r.winRate*100).toFixed(0)}% win rate, ${fmtPnL(r.netPnL)} net`),
          ...setups.filter(r => r.winRate < 0.35 && r.netPnL < 0).map(r => `${r.tag} setup — ${(r.winRate*100).toFixed(0)}% win rate`),
        ]

        function InsightCard({ label, name, color, stats }) {
          if (!name) return null
          return (
            <div className={`bg-card border rounded-xl p-4 ${color === 'profit' ? 'border-profit/30' : 'border-loss/30'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${color === 'profit' ? 'text-profit' : 'text-loss'}`}>{label}</div>
              <div className="font-bold text-slate-200 text-base mb-2">{name}</div>
              {stats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {stats.map(([l, v, c]) => (
                    <div key={l}>
                      <div className="text-subtle">{l}</div>
                      <div className={`font-semibold mt-0.5 ${c}`}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        function insightStats(r) {
          return [
            ['Trades', r.count || r.total, ''],
            ['Win Rate', (r.winRate*100).toFixed(0)+'%', r.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
            ['Expectancy', fmtPnL(r.expectancy), pnlColor(r.expectancy)],
          ]
        }

        const bs = best(sessions), ws = worst(sessions)
        const bd = best(days),     wd = worst(days)
        const bt = best(setups),   wt = worst(setups)

        return (
          <div className="space-y-5">
            {sessions.length > 0 && (
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Best & Worst Time of Day</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <InsightCard label="✓ Best Time Block" name={bs?.label} color="profit" stats={bs ? insightStats(bs) : null} />
                  <InsightCard label="✗ Worst Time Block" name={ws?.label} color="loss"   stats={ws ? insightStats(ws) : null} />
                </div>
              </div>
            )}

            {days.length > 0 && (
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Best & Worst Day of Week</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <InsightCard label="✓ Best Day" name={bd?.label} color="profit" stats={bd ? insightStats(bd) : null} />
                  <InsightCard label="✗ Worst Day" name={wd?.label} color="loss"  stats={wd ? insightStats(wd) : null} />
                </div>
              </div>
            )}

            {setups.length > 0 && (
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Best & Worst Setup</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <InsightCard label="✓ Best Setup" name={bt?.tag} color="profit" stats={bt ? insightStats(bt) : null} />
                  <InsightCard label="✗ Worst Setup" name={wt?.tag} color="loss"  stats={wt ? insightStats(wt) : null} />
                </div>
              </div>
            )}

            {redFlags.length > 0 && (
              <div className="bg-card border border-loss/30 rounded-xl p-4">
                <div className="text-sm font-semibold text-loss mb-3">⚠ Consistently Losing — Stop Trading These</div>
                <div className="space-y-2">
                  {redFlags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted">
                      <span className="text-loss mt-0.5">•</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && days.length === 0 && setups.length === 0 && (
              <div className="text-center py-16 text-muted">Need at least {MIN} trades per group for pattern detection.</div>
            )}
          </div>
        )
      })()}

      {/* ── Best & Worst ── */}
      {tab === 'best' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Top 5 Best Trades">
            <div className="space-y-2">
              {sortedAll.slice(0, 5).map(t => <TradeCard key={t.id} t={t} />)}
            </div>
          </ChartCard>
          <ChartCard title="Top 5 Worst Trades">
            <div className="space-y-2">
              {sortedAll.slice(-5).reverse().map(t => <TradeCard key={t.id} t={t} />)}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  )
}
