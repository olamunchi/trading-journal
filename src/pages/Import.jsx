import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { useTradeStore } from '../store/tradeStore'
import { detectColumns, normalizeTrades, FIELD_LABELS } from '../engine/csvParser'

// A stable fingerprint for a CSV's columns — used to recall the user's
// last mapping for files with the same header signature.
function headerSignature(headers) {
  return headers.map(h => h.trim().toLowerCase()).sort().join('|')
}

export function Import({ onDone }) {
  const { addTrades, trades, clearAll, lastImportStats, csvMappings, saveCsvMapping } = useTradeStore()
  const [step, setStep]       = useState('drop') // drop | map | done
  const [rawRows, setRawRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [dragging, setDragging] = useState(false)
  const [recalled, setRecalled] = useState(false)

  function processFile(file) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete(results) {
        const hdrs = results.meta.fields || []
        setHeaders(hdrs)
        setRawRows(results.data)
        const sig   = headerSignature(hdrs)
        const saved = csvMappings?.[sig]
        // Only recall if every saved column still exists in the new file —
        // protects against partial renames.
        const valid = saved && Object.values(saved).every(v => !v || hdrs.includes(v))
        if (valid) {
          setMapping(saved)
          setRecalled(true)
        } else {
          setMapping(detectColumns(hdrs))
          setRecalled(false)
        }
        setStep('map')
      },
    })
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  function doImport() {
    const normalized = normalizeTrades(rawRows, mapping)
    addTrades(normalized)
    saveCsvMapping(headerSignature(headers), mapping)
    setStep('done')
  }

  function reset() {
    setStep('drop'); setRawRows([]); setHeaders([]); setMapping({}); setRecalled(false)
  }

  const preview = rawRows.slice(0, 3)

  return (
    <div className="p-6 max-w-3xl">
      {/* ── STEP 1: Drop zone ── */}
      {step === 'drop' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('csv-input').click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-white/[0.02]'
            }`}
          >
            <div className="text-5xl mb-4">📂</div>
            <div className="text-lg font-semibold text-slate-200 mb-2">Drop your NT8 CSV here</div>
            <div className="text-sm text-muted">or click to browse — .csv or .txt</div>
            <input
              id="csv-input" type="file" accept=".csv,.txt" className="hidden"
              onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]) }}
            />
          </div>

          <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted space-y-1.5">
            <div className="text-slate-200 font-semibold mb-2">How to export from NinjaTrader 8</div>
            <div>1. Open <span className="text-slate-300">Control Center → New → Trade Performance</span></div>
            <div>2. Let it load your account history</div>
            <div>3. Right-click anywhere on the grid → <span className="text-slate-300">Export → To Excel (CSV)</span></div>
            <div>4. Drop that file above — columns are auto-detected</div>
          </div>

          {trades.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm text-muted">{trades.length} trades currently in journal</div>
              <button
                onClick={() => { if (window.confirm('Clear ALL trade data? This cannot be undone.')) clearAll() }}
                className="text-xs text-loss hover:text-red-400 border border-loss/30 px-3 py-1.5 rounded-md transition-colors"
              >
                Clear All Data
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Column mapper ── */}
      {step === 'map' && (
        <div className="space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-200">Map Your Columns</h2>
              <p className="text-sm text-muted mt-1">
                {recalled
                  ? 'Recalled your saved mapping for this CSV format — review and import.'
                  : 'We auto-detected these mappings — adjust any that look wrong.'}
              </p>
            </div>
            <button onClick={reset} className="text-sm text-muted hover:text-slate-300 mt-1">✕ Cancel</button>
          </div>

          {recalled && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg px-4 py-2.5 text-xs text-accent flex items-center gap-2">
              <span>✓</span>
              <span>Mapping restored from a previous import with the same columns. Edit any field to override.</span>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-4">
                <div className="text-sm text-muted w-48 flex-shrink-0">{label}</div>
                <select
                  value={mapping[key] || ''}
                  onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                  className="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
                >
                  <option value="">— skip —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {mapping[key] && preview[0] && (
                  <div className="text-xs text-subtle w-32 truncate" title={String(preview[0][mapping[key]])}>
                    e.g. {String(preview[0][mapping[key]] ?? '')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-xs text-muted uppercase tracking-wider">
                CSV Preview — first {preview.length} rows
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-muted whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {headers.map(h => (
                          <td key={h} className="px-3 py-1.5 whitespace-nowrap text-slate-400">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={doImport}
              className="px-6 py-2.5 bg-accent hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Import {rawRows.length} Trades →
            </button>
            <button onClick={reset} className="px-6 py-2.5 bg-card border border-border text-muted hover:text-slate-300 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 'done' && lastImportStats && (
        <div className="space-y-5">
          <div className="bg-profit/10 border border-profit/30 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-xl font-bold text-profit mb-2">Import Complete</div>
            <div className="flex items-center justify-center gap-5 mt-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-profit">{lastImportStats.added}</div>
                <div className="text-xs text-muted mt-0.5">new trades added</div>
              </div>
              {lastImportStats.skipped > 0 && (
                <>
                  <div className="text-border text-xl">·</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted">{lastImportStats.skipped}</div>
                    <div className="text-xs text-muted mt-0.5">duplicates skipped</div>
                  </div>
                </>
              )}
              <div className="text-border text-xl">·</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-300">{trades.length}</div>
                <div className="text-xs text-muted mt-0.5">total in journal</div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onDone} className="px-6 py-2.5 bg-accent hover:bg-blue-500 text-white font-medium rounded-lg transition-colors">
              View Dashboard →
            </button>
            <button onClick={reset} className="px-6 py-2.5 bg-card border border-border text-muted hover:text-slate-300 rounded-lg transition-colors">
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
