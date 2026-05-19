import { useState, useEffect } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { computeMetrics, fmtPnL, pnlColor, formatDuration } from '../engine/metrics'

const MOODS = ['calm', 'focused', 'tired', 'stressed', 'fomo', 'revenge']
const MOOD_EMOJI = { calm: '😌', focused: '🎯', tired: '😴', stressed: '😰', fomo: '😤', revenge: '😡' }
const ENERGY = ['good', 'tired', 'low', 'overloaded']
const ENERGY_COLOR = { good: 'text-profit', tired: 'text-warn', low: 'text-loss', overloaded: 'text-loss' }

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function Journal() {
  const { journalEntries, saveJournalEntry, deleteJournalEntry, trades } = useTradeStore()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [note, setNote]     = useState('')
  const [mood, setMood]     = useState('')
  const [energy, setEnergy] = useState('')
  const [saved, setSaved]   = useState(false)

  const entry = journalEntries.find(e => e.date === selectedDate) ?? null

  useEffect(() => {
    setNote(entry?.note ?? '')
    setMood(entry?.mood ?? '')
    setEnergy(entry?.energy ?? '')
    setSaved(false)
  }, [selectedDate, entry?.note, entry?.mood, entry?.energy])

  function handleSave() {
    if (!note.trim() && !mood && !energy) return
    saveJournalEntry(selectedDate, { note: note.trim(), mood, energy })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleDelete() {
    if (!entry) return
    if (!window.confirm('Delete this journal entry?')) return
    deleteJournalEntry(selectedDate)
    setNote(''); setMood(''); setEnergy('')
  }

  const dayTrades = trades
    .filter(t => t.entryTime && t.entryTime.startsWith(selectedDate))
    .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  const dayMetrics = dayTrades.length ? computeMetrics(dayTrades) : null
  const isDirty = note !== (entry?.note ?? '') || mood !== (entry?.mood ?? '') || energy !== (entry?.energy ?? '')

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar: entry list ── */}
      <div className="w-56 flex-shrink-0 border-r border-border overflow-y-auto bg-surface">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-300">Journal</div>
          <div className="text-xs text-muted">{journalEntries.length}</div>
        </div>

        <button
          onClick={() => setSelectedDate(todayStr())}
          className={`w-full flex items-center gap-2 px-4 py-3 text-sm border-b border-border transition-colors border-l-2 ${
            selectedDate === todayStr()
              ? 'bg-accent/10 text-accent border-l-accent'
              : 'text-muted hover:text-slate-300 hover:bg-white/[0.03] border-l-transparent'
          }`}
        >
          <span>✏️</span>
          <span>Today</span>
          {!journalEntries.find(e => e.date === todayStr()) && (
            <span className="ml-auto text-xs text-subtle">empty</span>
          )}
        </button>

        {journalEntries.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-subtle">Your entries will appear here.</div>
        )}

        {journalEntries.map(e => (
          <button
            key={e.date}
            onClick={() => setSelectedDate(e.date)}
            className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors border-l-2 ${
              selectedDate === e.date ? 'bg-accent/10 border-l-accent' : 'border-l-transparent hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs font-semibold text-slate-300">
                {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex gap-1 text-xs">
                {e.mood && <span title={e.mood}>{MOOD_EMOJI[e.mood] ?? ''}</span>}
                {e.energy && <span className={`${ENERGY_COLOR[e.energy]} font-medium`}>{e.energy[0]}</span>}
              </div>
            </div>
            {e.note && <div className="text-xs text-subtle truncate">{e.note}</div>}
          </button>
        ))}
      </div>

      {/* ── Middle: journal form ── */}
      <div className="w-[480px] flex-shrink-0 border-r border-border overflow-y-auto p-5 space-y-4">

        {/* Date header */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
          />
          <div className="text-slate-300 font-semibold text-sm">{fmtDate(selectedDate)}</div>
        </div>

        {/* Mood + Energy */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Mood</div>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? '' : m)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all capitalize ${
                    mood === m
                      ? 'bg-accent/20 border border-accent text-accent'
                      : 'bg-bg border border-border text-muted hover:text-slate-300'
                  }`}
                >
                  {MOOD_EMOJI[m]} {m}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Energy</div>
            <div className="flex flex-wrap gap-1.5">
              {ENERGY.map(e => (
                <button
                  key={e}
                  onClick={() => setEnergy(energy === e ? '' : e)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all capitalize ${
                    energy === e
                      ? 'bg-accent/20 border border-accent text-accent'
                      : 'bg-bg border border-border text-muted hover:text-slate-300'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Notes & Reflection</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What happened today? What went well? What would you do differently? Any market observations..."
            rows={12}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-subtle">{note.length} chars</div>
            <div className="flex gap-2">
              {entry && (
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs text-loss border border-loss/30 rounded-lg hover:bg-loss/10 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!isDirty && !note.trim() && !mood && !energy}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  saved
                    ? 'bg-profit/20 border border-profit/40 text-profit'
                    : isDirty || (!entry && (note.trim() || mood || energy))
                    ? 'bg-accent hover:bg-blue-500 text-white'
                    : 'bg-card border border-border text-muted cursor-not-allowed'
                }`}
              >
                {saved ? '✓ Saved' : entry ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Prompts (only when note is empty) */}
        {!note && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Reflection prompts</div>
            <div className="space-y-1.5 text-sm text-subtle">
              {[
                'Did I follow my trading plan today?',
                'What emotion drove my best/worst trade?',
                'Was my sizing consistent with my risk rules?',
                'What would I tell myself before the open tomorrow?',
                'Any market conditions I want to remember?',
              ].map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 cursor-pointer hover:text-muted transition-colors"
                  onClick={() => setNote(n => n ? n + '\n\n' + q + '\n' : q + '\n')}
                >
                  <span className="text-subtle mt-0.5">→</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: trades of the day ── */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="text-xs text-muted uppercase tracking-wider mb-3">
          Trades — {fmtDate(selectedDate)}
        </div>

        {dayTrades.length === 0 ? (
          <div className="text-center py-16 text-subtle text-sm">No trades found for this date.</div>
        ) : (
          <div className="space-y-3">
            {/* Day summary bar */}
            {dayMetrics && (
              <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-5 gap-3 text-center mb-4">
                {[
                  ['Net P&L',   fmtPnL(dayMetrics.netPnL),                          pnlColor(dayMetrics.netPnL)],
                  ['Trades',    dayMetrics.total,                                    ''],
                  ['Win Rate',  (dayMetrics.winRate * 100).toFixed(0) + '%',        dayMetrics.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
                  ['Avg Win',   fmtPnL(dayMetrics.avgWin),                          'text-profit'],
                  ['Avg Loss',  '-$' + dayMetrics.avgLoss.toFixed(2),               'text-loss'],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="text-xs text-subtle mb-0.5">{l}</div>
                    <div className={`font-bold text-sm ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Individual trades */}
            {dayTrades.map(t => (
              <div
                key={t.id}
                className={`rounded-xl border p-3.5 ${t.profit >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-slate-200">{t.instrument}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {t.side?.toUpperCase() ?? '—'} · {t.qty} contracts
                      {t.entryTime && ` · ${new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      {t.duration ? ` · ${formatDuration(t.duration)}` : ''}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${pnlColor(t.profit)}`}>{fmtPnL(t.profit)}</div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs text-muted">
                  <div><span className="text-subtle">Entry</span><div className="font-medium text-slate-300">{t.entryPrice || '—'}</div></div>
                  <div><span className="text-subtle">Exit</span><div className="font-medium text-slate-300">{t.exitPrice || '—'}</div></div>
                  <div><span className="text-subtle">MAE</span><div className="font-medium">{t.mae ? '$' + t.mae.toFixed(0) : '—'}</div></div>
                  <div><span className="text-subtle">MFE</span><div className="font-medium">{t.mfe ? '$' + t.mfe.toFixed(0) : '—'}</div></div>
                </div>

                {(t.note || t.tags?.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
                    {t.tags?.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">{tag}</span>
                    ))}
                    {t.note && <span className="text-xs text-subtle italic truncate">{t.note}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
