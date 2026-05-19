import { useMemo, useState } from 'react'
import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTradeStore } from '../store/tradeStore'
import {
  filterByPeriod, computeMetrics, computeBySymbol, computeByTag,
  computeBySession, computeByMood, computeByExecScore, computeDow,
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
  { id: 'maemfe',   label: 'MAE/MFE' },
  { id: 'rmultiple',label: 'R-Multiple' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'best',     label: 'Best & Worst' },
]

export function Analytics() {
  const { trades, periodFilter } = useTradeStore()
  const [tab, setTab] = useState('symbol')

  const filtered  = useMemo(() => filterByPeriod(trades, periodFilter), [trades, periodFilter])
  const bySymbol  = useMemo(() => computeBySymbol(filtered),    [filtered])
  const byTag     = useMemo(() => computeByTag(filtered),       [filtered])
  const bySession = useMemo(() => computeBySession(filtered),   [filtered])
  const byMood    = useMemo(() => computeByMood(filtered),      [filtered])
  const byExec    = useMemo(() => computeByExecScore(filtered), [filtered])
  const maemfe    = useMemo(() => computeMAEMFE(filtered),      [filtered])
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

      {/* ── MAE / MFE ── */}
      {tab === 'maemfe' && (
        <div className="space-y-4">
          {maemfe.winnerCount === 0 && maemfe.loserCount === 0 ? (
            <div className="text-muted text-sm py-10 text-center">No MAE/MFE data. Make sure those columns are mapped at import.</div>
          ) : (
            <>
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
