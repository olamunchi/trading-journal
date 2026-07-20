import { useMemo, useState } from 'react'
import { BarChart, Bar, ScatterChart, Scatter, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, Ruler, RefreshCw } from 'lucide-react'
import { useTradeStore } from '../store/tradeStore'
import {
  filterByPeriod, computeMetrics, computeBySymbol, computeByTag,
  computeBySession, computeByMood, computeByExecScore, computeByConfidence, computeDisciplineScore, computeDow,
  computeMAEMFE, computeRMultiples, computeTradeR,
  fmtPnL, pnlColor, detectSessionOffset, detectTimezoneName,
} from '../engine/metrics'
import { ChartCard } from '../components/ui/ChartCard'
import { C, TT, AX, pnlFill } from '../lib/chartTheme'

// Conclusion first: Overview (auto-detected best/worst patterns, red flags)
// synthesizes everything else, so it leads — the way a report states its
// findings before its supporting data, not after.
const TABS = [
  { id: 'highlights', label: 'Overview' },
  { id: 'setups',     label: 'Setups' },
  { id: 'time',       label: 'Time' },
  { id: 'side',       label: 'Direction' },
  { id: 'psych',      label: 'Psychology' },
  { id: 'risk',       label: 'Risk' },
]

function SectionLabel({ children }) {
  return <div className="text-xs text-muted uppercase tracking-wider">{children}</div>
}

export function Analytics() {
  const { trades, periodFilter, customRange, sessionOffset, sessionOffsetAuto, setSessionOffset, resetSessionOffsetAuto } = useTradeStore()
  const [tab, setTab] = useState('highlights')
  const detectedOffset = detectSessionOffset()
  const detectedTz     = detectTimezoneName()

  const filtered  = useMemo(() => filterByPeriod(trades, periodFilter, customRange), [trades, periodFilter, customRange])
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
        <div className="text-center text-muted">
          <BarChart3 size={40} className="mx-auto mb-4 text-subtle" />
          No trades to analyze.
        </div>
      </div>
    )
  }

  // ── Shared sub-components ─────────────────────────────────────────────────

  function StatsTable({ data, nameKey = 'sym' }) {
    return (
      <>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey={nameKey} tick={AX} />
            <YAxis tick={AX} tickFormatter={v => '$' + v} />
            <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
            <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
              {data.map((e, i) => <Cell key={i} fill={pnlFill(e.netPnL)} fillOpacity={0.85} />)}
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

  function EmotionChart({ data, nameKey }) {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis dataKey={nameKey} tick={AX} />
          <YAxis tick={AX} tickFormatter={v => '$' + v} />
          <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
          <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
            {data.map((e, i) => <Cell key={i} fill={pnlFill(e.netPnL)} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3.5 py-2.5 -mb-px text-sm font-medium border-b-2 transition-all ${
              tab === id
                ? 'border-accent text-slate-100'
                : 'border-transparent text-muted hover:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Setups ── */}
      {tab === 'setups' && (
        <div className="space-y-4">
          <ChartCard title="Performance by Setup / Tag">
            {byTag.every(r => r.tag === 'Untagged')
              ? <div className="text-muted text-sm py-10 text-center">No tags yet. Click any trade in Trade Log to add setup tags.</div>
              : <StatsTable data={byTag.map(r => ({ ...r, sym: r.tag }))} nameKey="sym" />}
          </ChartCard>
          <ChartCard title="Performance by Symbol">
            <StatsTable data={bySymbol} nameKey="sym" />
          </ChartCard>
        </div>
      )}

      {/* ── Time ── */}
      {tab === 'time' && (
        <div className="space-y-4">
          {/* Timezone selector */}
          {(() => {
            // sample: what local time does a 9:30 ET trade appear as?
            const sampleLocal = 9.5 + sessionOffset
            const sampleH = Math.floor(((sampleLocal % 24) + 24) % 24)
            const sampleM = sampleLocal % 1 === 0.5 ? '30' : '00'
            const sampleStr = `${String(sampleH).padStart(2, '0')}:${sampleM}`
            const overridden = !sessionOffsetAuto && sessionOffset !== detectedOffset
            return (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-card">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>Auto-detected from your PC:</span>
                  <span className="text-slate-300 font-medium">{detectedTz}</span>
                  <span className="text-subtle">·</span>
                  <span className="text-accent font-medium">ET offset {detectedOffset >= 0 ? '+' : ''}{detectedOffset}h</span>
                  {overridden && (
                    <button
                      onClick={resetSessionOffsetAuto}
                      className="ml-auto flex items-center gap-1 text-xs text-accent hover:text-accentHover transition-colors"
                    >
                      <RefreshCw size={11} /> Use auto-detected
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted flex-shrink-0">My NT8 timestamps are in:</span>
                  <select
                    value={sessionOffset}
                    onChange={e => setSessionOffset(Number(e.target.value))}
                    className="bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
                  >
                    <option value={0}>ET — Eastern Time (US brokers, no timezone in export)</option>
                    <option value={1}>CT — Central Time (1h behind ET)</option>
                    <option value={2}>MT — Mountain Time (2h behind ET)</option>
                    <option value={3}>PT — Pacific Time (3h behind ET)</option>
                    <option value={4}>UK / Portugal — winter (GMT, ET+5)</option>
                    <option value={5}>UK / Portugal — summer (BST/WEST, ET+5)</option>
                    <option value={6}>Central Europe — France, Germany, Spain (ET+6)</option>
                    <option value={7}>Eastern Europe — Greece, Romania (ET+7)</option>
                  </select>
                </div>
                <div className="text-xs text-subtle">
                  With this setting, a trade timestamped <span className="text-slate-400 font-medium">{sampleStr} in your data</span> will be classified as the <span className="text-accent font-medium">09:30–10:30 ET</span> session. All times below are in 24h ET.
                </div>
              </div>
            )
          })()}
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

      {/* ── Direction ── */}
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
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="label" tick={AX} />
                <YAxis tick={AX} tickFormatter={v => '$' + v} />
                <Tooltip {...TT} formatter={v => [fmtPnL(v), 'Net P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  <Cell fill={pnlFill(ml?.netPnL || 0)} fillOpacity={0.85} />
                  <Cell fill={pnlFill(ms?.netPnL || 0)} fillOpacity={0.85} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── Psychology (merged former Psychology + Emotions) ── */}
      {tab === 'psych' && (() => {
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

        return (
          <div className="space-y-4">

            {/* Discipline Score */}
            {(() => {
              const ds = computeDisciplineScore(filtered)
              if (!ds) return (
                <div className="bg-card border border-border rounded-xl p-5 text-center text-sm text-muted shadow-card">
                  Rate at least 3 trades using <strong>Followed Plan?</strong> in the Trade Drawer to generate your Discipline Score.
                </div>
              )
              const { score, components, ratedCount, totalTrades } = ds
              const scoreColor  = score >= 75 ? 'text-profit' : score >= 55 ? 'text-accent' : score >= 40 ? 'text-warn' : 'text-loss'
              const scoreLabel  = score >= 90 ? 'Elite Discipline' : score >= 75 ? 'Strong Discipline' : score >= 55 ? 'Solid Discipline' : score >= 40 ? 'Needs Work' : 'High Tilt Risk'
              const barColor = pct => pct >= 0.75 ? 'bg-profit' : pct >= 0.5 ? 'bg-accent' : pct >= 0.3 ? 'bg-warn' : 'bg-loss'
              return (
                <div className="bg-card border border-border rounded-xl p-5 shadow-card">
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

            {/* Mood + Confidence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Performance by Mood">
                {noMoodData
                  ? <div className="text-muted text-sm py-8 text-center">No mood data yet. Log your mood in the Trade Drawer.</div>
                  : <>
                      <EmotionChart data={byMood} nameKey="mood" />
                      <EmotionTable data={byMood} nameKey="mood" nameLabel="Mood" />
                    </>
                }
              </ChartCard>

              <ChartCard title="Performance by Confidence">
                {noConfData
                  ? <div className="text-muted text-sm py-8 text-center">No confidence data yet. Rate your confidence in the Trade Drawer.</div>
                  : <>
                      <EmotionChart data={byConf} nameKey="confidence" />
                      <EmotionTable data={byConf} nameKey="confidence" nameLabel="Confidence" />
                    </>
                }
              </ChartCard>
            </div>

            {/* Execution score */}
            <ChartCard title="Performance by Execution Score">
              {byExec.length === 0
                ? <div className="text-muted text-sm py-8 text-center">No execution scores yet. Rate your trades 1–5 in the Trade Drawer.</div>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={byExec}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                        <XAxis dataKey="score" tick={AX} />
                        <YAxis tick={AX} tickFormatter={v => '$' + v} />
                        <Tooltip {...TT} formatter={(v, n, p) => [fmtPnL(v) + ` (${p.payload.total}t)`, p.payload.label]} />
                        <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                          {byExec.map((e, i) => <Cell key={i} fill={pnlFill(e.netPnL)} fillOpacity={0.85} />)}
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
          </div>
        )
      })()}

      {/* ── Risk (MAE/MFE + R-Multiple) ── */}
      {tab === 'risk' && (
        <div className="space-y-5">
          <SectionLabel>MAE / MFE — Heat & Capture</SectionLabel>
          {maemfe.winnerCount === 0 && maemfe.loserCount === 0 ? (
            <div className="text-muted text-sm py-6 text-center bg-card border border-border rounded-xl shadow-card">
              No MAE/MFE data. Make sure those columns are mapped at import.
            </div>
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
                      <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                      <XAxis dataKey="mae" type="number" tick={AX} name="MAE"
                        label={{ value: 'MAE ($)', position: 'insideBottom', offset: -15, fill: C.axis, fontSize: 11 }}
                        tickFormatter={v => '$' + v} />
                      <YAxis dataKey="mfe" type="number" tick={AX} name="MFE"
                        label={{ value: 'MFE ($)', angle: -90, position: 'insideLeft', fill: C.axis, fontSize: 11 }}
                        tickFormatter={v => '$' + v} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          return (
                            <div style={{ ...TT.contentStyle, padding: '8px 12px' }}>
                              <div className="font-semibold text-slate-200 mb-1">{d.instrument}</div>
                              <div className={d.profit >= 0 ? 'text-profit' : 'text-loss'}>{fmtPnL(d.profit)}</div>
                              <div className="text-muted mt-1.5">MAE: ${d.mae.toFixed(2)}</div>
                              <div className="text-muted">MFE: ${d.mfe.toFixed(2)}</div>
                            </div>
                          )
                        }}
                      />
                      <Scatter name="Winners" data={scatterData.wins}   fill={C.profit} fillOpacity={0.65} />
                      <Scatter name="Losers"  data={scatterData.losses} fill={C.loss}   fillOpacity={0.65} />
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 justify-center mt-1 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: C.profit }} />
                      Winners ({scatterData.wins.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: C.loss }} />
                      Losers ({scatterData.losses.length})
                    </span>
                  </div>
                </ChartCard>
              )}

              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Avg Capture Rate</div>
                  <div className={`text-2xl font-bold ${maemfe.avgCapture >= 0.5 ? 'text-profit' : 'text-warn'}`}>
                    {maemfe.avgCapture !== null ? (maemfe.avgCapture * 100).toFixed(1) + '%' : '—'}
                  </div>
                  <div className="text-xs text-subtle mt-1">Exit ÷ MFE on winners</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Entry Cleanliness</div>
                  <div className={`text-2xl font-bold ${maemfe.avgMaeRatio !== null && maemfe.avgMaeRatio < 0.3 ? 'text-profit' : 'text-warn'}`}>
                    {maemfe.avgMaeRatio !== null ? (maemfe.avgMaeRatio * 100).toFixed(1) + '%' : '—'}
                  </div>
                  <div className="text-xs text-subtle mt-1">MAE ÷ MFE on winners — lower = cleaner</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 shadow-card">
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
                      <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                      <XAxis dataKey="label" tick={AX} />
                      <YAxis tick={AX} allowDecimals={false} />
                      <Tooltip {...TT} formatter={v => [v + ' trades', 'Count']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={C.accent} fillOpacity={0.85} />
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

          <SectionLabel>R-Multiples</SectionLabel>
          {!rData ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center shadow-card">
              <Ruler size={28} className="mx-auto mb-3 text-subtle" />
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
                  <div key={l} className="bg-card border border-border rounded-xl p-4 shadow-card">
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
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                    <XAxis dataKey="label" tick={{ ...AX, fontSize: 9 }} interval={1} />
                    <YAxis tick={AX} allowDecimals={false} />
                    <Tooltip {...TT} formatter={v => [v + ' trades', 'Count']} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {rData.distribution.map((e, i) => <Cell key={i} fill={e.isWin ? C.profit : C.loss} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </div>
      )}

      {/* ── Highlights (Patterns + Best & Worst) ── */}
      {tab === 'highlights' && (() => {
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
            <div className={`bg-card border rounded-xl p-4 shadow-card ${color === 'profit' ? 'border-profit/30' : 'border-loss/30'}`}>
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
              <div className="bg-card border border-loss/30 rounded-xl p-4 shadow-card">
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

            {sessions.length === 0 && days.length === 0 && setups.length === 0 && (
              <div className="text-center py-8 text-muted">Need at least {MIN} trades per group for time/day/setup pattern detection.</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
