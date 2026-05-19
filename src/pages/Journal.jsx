import { useState, useEffect } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { computeMetrics, fmtPnL, pnlColor } from '../engine/metrics'

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
  const [note, setNote]         = useState('')
  const [mood, setMood]         = useState('')
  const [energy, setEnergy]     = useState('')
  const [saved, setSaved]       = useState(false)

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

  // Trades for selected date
  const dayTrades = trades.filter(t => t.entryTime && t.entryTime.startsWith(selectedDate))
  const dayMetrics = dayTrades.length ? computeMetrics(dayTrades) : null

  const isDirty = note !== (entry?.note ?? '') || mood !== (entry?.mood ?? '') || energy !== (entry?.energy ?? '')

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar: entry list ── */}
      <div className="w-64 flex-shrink-0 border-r border-border overflow-y-auto bg-surface">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-300">Journal</div>
          <div className="text-xs text-muted">{journalEntries.length} entries</div>
        </div>

        {/* Today shortcut */}
        <button
          onClick={() => setSelectedDate(todayStr())}
          className={`w-full flex items-center gap-2 px-4 py-3 text-sm border-b border-border transition-colors ${
            selectedDate === todayStr()
              ? 'bg-accent/10 text-accent border-l-2 border-l-accent'
              : 'text-muted hover:text-slate-300 hover:bg-white/[0.03] border-l-2 border-l-transparent'
          }`}
        >
          <span>✏️</span>
          <span>Today</span>
          {!journalEntries.find(e => e.date === todayStr()) && (
            <span className="ml-auto text-xs text-subtle">empty</span>
          )}
        </button>

        {journalEntries.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-subtle">
            Your entries will appear here.
          </div>
        )}

        {journalEntries.map(e => (
          <button
            key={e.date}
            onClick={() => setSelectedDate(e.date)}
            className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors border-l-2 ${
              selectedDate === e.date
                ? 'bg-accent/10 border-l-accent'
                : 'border-l-transparent hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs font-semibold text-slate-300">
                {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex gap-1.5 text-xs">
                {e.mood && <span title={e.mood}>{MOOD_EMOJI[e.mood] ?? ''}</span>}
                {e.energy && <span className={`${ENERGY_COLOR[e.energy]} font-medium`}>{e.energy}</span>}
              </div>
            </div>
            {e.note && (
              <div className="text-xs text-subtle truncate">{e.note}</div>
            )}
          </button>
        ))}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-5">

          {/* Date header */}
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent"
            />
            <div className="text-slate-300 font-semibold">{fmtDate(selectedDate)}</div>
          </div>

          {/* Day P&L summary if trades exist */}
          {dayMetrics && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Trading Summary</div>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-subtle text-xs mb-0.5">Net P&L</div>
                  <div className={`font-bold text-lg ${pnlColor(dayMetrics.netPnL)}`}>{fmtPnL(dayMetrics.netPnL)}</div>
                </div>
                <div>
                  <div className="text-subtle text-xs mb-0.5">Trades</div>
                  <div className="font-semibold">{dayMetrics.total}</div>
                </div>
                <div>
                  <div className="text-subtle text-xs mb-0.5">Win Rate</div>
                  <div className={`font-semibold ${dayMetrics.winRate >= 0.5 ? 'text-profit' : 'text-loss'}`}>
                    {(dayMetrics.winRate * 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-subtle text-xs mb-0.5">Avg Win</div>
                  <div className="font-semibold text-profit">{fmtPnL(dayMetrics.avgWin)}</div>
                </div>
                <div>
                  <div className="text-subtle text-xs mb-0.5">Avg Loss</div>
                  <div className="font-semibold text-loss">-${dayMetrics.avgLoss.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Mood + Energy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Mood</div>
              <div className="flex flex-wrap gap-2">
                {MOODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setMood(mood === m ? '' : m)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
                      mood === m
                        ? 'bg-accent/20 border border-accent text-accent'
                        : 'bg-bg border border-border text-muted hover:text-slate-300 hover:border-border/80'
                    }`}
                  >
                    {MOOD_EMOJI[m]} {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Energy Level</div>
              <div className="flex flex-wrap gap-2">
                {ENERGY.map(e => (
                  <button
                    key={e}
                    onClick={() => setEnergy(energy === e ? '' : e)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
                      energy === e
                        ? 'bg-accent/20 border border-accent text-accent'
                        : 'bg-bg border border-border text-muted hover:text-slate-300 hover:border-border/80'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes textarea */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted uppercase tracking-wider mb-3">Notes & Reflection</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What happened today? What went well? What would you do differently? Any market observations..."
              rows={10}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-subtle">{note.length} characters</div>
              <div className="flex gap-2">
                {entry && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-xs text-loss border border-loss/30 rounded-lg hover:bg-loss/10 transition-colors"
                  >
                    Delete entry
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!isDirty && !note.trim() && !mood && !energy}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
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

          {/* Prompt suggestions */}
          {!note && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">Reflection prompts</div>
              <div className="space-y-2 text-sm text-subtle">
                {[
                  'Did I follow my trading plan today?',
                  'What emotion drove my best/worst trade?',
                  'Was my sizing consistent with my risk rules?',
                  'What would I tell myself before the open tomorrow?',
                  'Any market conditions I want to remember?',
                ].map((q, i) => (
                  <div key={i} className="flex items-start gap-2 cursor-pointer hover:text-muted transition-colors"
                    onClick={() => setNote(n => n ? n + '\n\n' + q + '\n' : q + '\n')}>
                    <span className="text-subtle mt-0.5">→</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
