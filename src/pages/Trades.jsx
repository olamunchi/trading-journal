import { useState, useMemo } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { filterByPeriod, fmtPnL, pnlColor, formatDuration, computeTradeR } from '../engine/metrics'
import { TradeDrawer } from '../components/trades/TradeDrawer'

const PAGE_SIZE = 50

export function Trades() {
  const { trades, periodFilter } = useTradeStore()
  const [search, setSearch]           = useState('')
  const [sideFilter, setSideFilter]   = useState('')
  const [resultFilter, setResult]     = useState('')
  const [tagFilter, setTagFilter]     = useState('')
  const [sortKey, setSortKey]         = useState('entryTime')
  const [sortDir, setSortDir]         = useState(-1)
  const [page, setPage]               = useState(0)
  const [selected, setSelected]       = useState(null)

  const allTags = useMemo(() => {
    const s = new Set()
    trades.forEach(t => t.tags?.forEach(tag => s.add(tag)))
    return [...s]
  }, [trades])

  const filtered = useMemo(() => {
    let rows = filterByPeriod(trades, periodFilter)
    if (search)       rows = rows.filter(t => t.instrument.toLowerCase().includes(search.toLowerCase()))
    if (sideFilter)   rows = rows.filter(t => t.side === sideFilter)
    if (resultFilter === 'win')  rows = rows.filter(t => t.profit > 0)
    if (resultFilter === 'loss') rows = rows.filter(t => t.profit < 0)
    if (tagFilter)    rows = rows.filter(t => t.tags?.includes(tagFilter))
    return rows.sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      return sortDir * (av < bv ? -1 : av > bv ? 1 : 0)
    })
  }, [trades, periodFilter, search, sideFilter, resultFilter, tagFilter, sortKey, sortDir])

  function sort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(-1) }
    setPage(0)
  }

  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const Th = ({ k, children }) => (
    <th
      onClick={() => sort(k)}
      className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wider cursor-pointer hover:text-slate-300 whitespace-nowrap select-none"
    >
      {children}{sortKey === k ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <div className="p-6">
      {selected && (
        <TradeDrawer
          trade={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search symbol…"
            className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 placeholder-subtle focus:outline-none focus:border-accent w-44"
          />
          <select value={sideFilter} onChange={e => { setSideFilter(e.target.value); setPage(0) }}
            className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent">
            <option value="">All Sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select value={resultFilter} onChange={e => { setResult(e.target.value); setPage(0) }}
            className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent">
            <option value="">Win & Loss</option>
            <option value="win">Wins only</option>
            <option value="loss">Losses only</option>
          </select>
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => { setTagFilter(e.target.value); setPage(0) }}
              className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent">
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <span className="ml-auto text-xs text-muted">{filtered.length} trades</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <Th k="entryTime">Date / Time</Th>
                <Th k="instrument">Symbol</Th>
                <Th k="side">Side</Th>
                <Th k="qty">Qty</Th>
                <Th k="entryPrice">Entry</Th>
                <Th k="exitPrice">Exit</Th>
                <Th k="duration">Duration</Th>
                <Th k="mae">MAE</Th>
                <Th k="mfe">MFE</Th>
                <Th k="commission">Comm.</Th>
                <Th k="profit">Net P&L</Th>
                <th className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wider">R</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wider">Score</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted uppercase tracking-wider">Tags</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-muted">
                    {trades.length === 0 ? 'No trades imported yet.' : 'No trades match your filters.'}
                  </td>
                </tr>
              ) : pageRows.map(t => {
                const dt = t.entryTime ? new Date(t.entryTime) : null
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">
                      {dt
                        ? <>{dt.toLocaleDateString()}<br /><span className="text-subtle">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{t.instrument}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.side === 'long' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>
                        {(t.side || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{t.qty || '—'}</td>
                    <td className="px-4 py-2.5">{t.entryPrice ? t.entryPrice.toFixed(2) : '—'}</td>
                    <td className="px-4 py-2.5">{t.exitPrice ? t.exitPrice.toFixed(2) : '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{formatDuration(t.duration)}</td>
                    <td className="px-4 py-2.5 text-loss text-xs">{t.mae ? '-$' + t.mae.toFixed(2) : '—'}</td>
                    <td className="px-4 py-2.5 text-profit text-xs">{t.mfe ? '+$' + t.mfe.toFixed(2) : '—'}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">{t.commission ? '-$' + t.commission.toFixed(2) : '—'}</td>
                    <td className={`px-4 py-2.5 font-bold ${pnlColor(t.profit)}`}>{fmtPnL(t.profit)}</td>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${computeTradeR(t) !== null ? pnlColor(t.profit) : 'text-subtle'}`}>
                      {(() => { const r = computeTradeR(t); return r !== null ? (r > 0 ? '+' : '') + r.toFixed(1) + 'R' : '—' })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.executionScore
                        ? <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-xs font-bold">{t.executionScore}</span>
                        : <span className="text-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {t.tags?.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-xs">{tag}</span>
                        ))}
                        {t.note && <span className="text-muted text-xs" title={t.note}>📝</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center gap-2">
            <span className="text-xs text-muted flex-1">Page {page + 1} of {totalPages}</span>
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm bg-bg border border-border rounded-md text-muted hover:text-slate-300">
                ← Prev
              </button>
            )}
            {page < totalPages - 1 && (
              <button onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm bg-bg border border-border rounded-md text-muted hover:text-slate-300">
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
