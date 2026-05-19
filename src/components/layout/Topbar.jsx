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
  report:    'AI Report',
  import:    'Import CSV',
}

export function Topbar({ page, onNavigate }) {
  const { periodFilter, setPeriodFilter, trades } = useTradeStore()

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="text-sm font-semibold text-slate-200 flex-1">{PAGE_TITLES[page]}</h1>

      {page !== 'import' && (
        <select
          value={periodFilter}
          onChange={e => setPeriodFilter(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="3m">Last 3 Months</option>
          <option value="ytd">This Year</option>
        </select>
      )}

      {trades.length > 0 && (
        <button
          onClick={() => exportCSV(trades)}
          className="px-3 py-1.5 bg-card border border-border hover:border-accent text-muted hover:text-slate-300 text-sm font-medium rounded-md transition-colors"
        >
          ↓ Export
        </button>
      )}
      <button
        onClick={() => onNavigate('import')}
        className="px-3 py-1.5 bg-accent hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
      >
        + Import CSV
      </button>
    </header>
  )
}
