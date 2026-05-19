import { useMemo, useState } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { generateReport } from '../engine/reportGenerator'

export function Report() {
  const { trades, periodFilter } = useTradeStore()
  const [copied, setCopied] = useState(false)

  const report = useMemo(() => generateReport(trades, periodFilter), [trades, periodFilter])

  function copyToClipboard() {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (!trades.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-80 text-center">
        <div className="text-5xl mb-4">📄</div>
        <div className="text-lg font-semibold text-slate-300 mb-2">No trades to report</div>
        <div className="text-sm text-muted">Import your NT8 CSV export first</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">AI Coaching Report</h2>
          <p className="text-sm text-muted mt-0.5">
            Copy this report and paste it into{' '}
            <span className="text-accent font-medium">claude.ai</span>{' '}
            — use the suggested prompt at the bottom for a full analysis.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            copied
              ? 'bg-profit/20 text-profit border border-profit/40'
              : 'bg-accent hover:bg-blue-500 text-white'
          }`}
        >
          {copied ? '✓ Copied!' : '⎘ Copy Report'}
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
        <div className="text-accent text-lg leading-none mt-0.5">💡</div>
        <div className="space-y-1 text-sm text-muted">
          <div><span className="text-slate-300 font-medium">Step 1:</span> Click "Copy Report" above</div>
          <div><span className="text-slate-300 font-medium">Step 2:</span> Open <span className="text-accent">claude.ai</span> in a new tab</div>
          <div><span className="text-slate-300 font-medium">Step 3:</span> Paste the report — the suggested prompt is already included at the bottom</div>
        </div>
      </div>

      {/* Report preview */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs text-muted font-medium uppercase tracking-wider">Report Preview</span>
          <span className="text-xs text-subtle">{report.length.toLocaleString()} characters</span>
        </div>
        <textarea
          readOnly
          value={report}
          className="w-full h-[calc(100vh-22rem)] p-4 bg-bg text-xs text-slate-400 font-mono resize-none focus:outline-none leading-relaxed"
        />
      </div>
    </div>
  )
}
