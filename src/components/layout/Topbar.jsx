import { useState, useRef, useEffect } from 'react'
import { Download, Upload, CalendarRange, X } from 'lucide-react'
import { useTradeStore } from '../../store/tradeStore'

function exportCSV(trades) {
  const headers = [
    'instrument','side','qty','entryTime','exitTime',
    'entryPrice','exitPrice','profit','commission','mae','mfe',
    'duration','riskAmount','executionScore','mood','confidence',
    'followedPlan','mistakeType','tags','note',
  ]
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = trades.map(t =>
    headers.map(h => {
      if (h === 'tags') return escape((t.tags || []).join('; '))
      if (h === 'followedPlan') return escape(t.followedPlan === true ? 'Yes' : t.followedPlan === false ? 'No' : '')
      return escape(t[h] ?? '')
    }).join(',')
  )
  const csv  = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `tradelog-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  trades:    'Trade Log',
  calendar:  'Calendar',
  analytics: 'Analytics',
  journal:   'Journal',
  report:    'AI Report',
  import:    'Import CSV',
}

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: '3m',    label: '3M' },
  { id: 'ytd',   label: 'YTD' },
  { id: 'all',   label: 'All' },
]

function fmtShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function Topbar({ page, onNavigate }) {
  const { periodFilter, setPeriodFilter, customRange, setCustomRange, trades } = useTradeStore()
  const [rangeOpen, setRangeOpen] = useState(false)
  const [from, setFrom] = useState(customRange?.from ?? '')
  const [to, setTo]     = useState(customRange?.to ?? '')
  const popRef = useRef(null)

  useEffect(() => {
    if (!rangeOpen) return
    function onDown(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setRangeOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [rangeOpen])

  function applyRange() {
    if (!from || !to) return
    setCustomRange(from <= to ? { from, to } : { from: to, to: from })
    setRangeOpen(false)
  }

  const customActive = periodFilter === 'custom' && customRange

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-5 gap-3 flex-shrink-0">
      <h1 className="text-sm font-semibold text-slate-200 flex-1 truncate">{PAGE_TITLES[page]}</h1>

      {page !== 'import' && (
        <div className="flex items-center gap-2">
          {/* Segmented period control */}
          <div className="flex bg-bg border border-border rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  periodFilter === p.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                customActive
                  ? 'bg-accent/15 border-accent/50 text-slate-200'
                  : 'bg-bg border-border text-muted hover:text-slate-300 hover:border-subtle'
              }`}
            >
              <CalendarRange size={13} />
              {customActive ? `${fmtShort(customRange.from)} – ${fmtShort(customRange.to)}` : 'Custom'}
              {customActive && (
                <X
                  size={12}
                  className="hover:text-loss"
                  onClick={e => { e.stopPropagation(); setCustomRange(null); setPeriodFilter('all'); setRangeOpen(false) }}
                />
              )}
            </button>

            {rangeOpen && (
              <div ref={popRef} className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-xl p-4 shadow-card w-64 space-y-3">
                <div className="text-xs font-semibold text-slate-200">Custom date range</div>
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs text-muted">From</span>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                      className="mt-1 w-full bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">To</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                      className="mt-1 w-full bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent" />
                  </label>
                </div>
                <button
                  onClick={applyRange}
                  disabled={!from || !to}
                  className="w-full py-1.5 bg-accent hover:bg-accentHover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <button
          onClick={() => exportCSV(trades)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:border-subtle text-muted hover:text-slate-300 text-sm font-medium rounded-lg transition-colors"
        >
          <Download size={14} /> Export
        </button>
      )}
      <button
        onClick={() => onNavigate('import')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accentHover text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Upload size={14} /> Import
      </button>
    </header>
  )
}
