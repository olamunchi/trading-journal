import { useState, useEffect, useRef } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { computeMetrics, fmtPnL, pnlColor, formatDuration } from '../engine/metrics'

const MOODS   = ['calm', 'focused', 'tired', 'stressed', 'fomo', 'revenge']
const MOOD_EMOJI = { calm: '😌', focused: '🎯', tired: '😴', stressed: '😰', fomo: '😤', revenge: '😡' }
const ENERGY  = ['good', 'tired', 'low', 'overloaded']
const ENERGY_COLOR = { good: 'text-profit', tired: 'text-warn', low: 'text-loss', overloaded: 'text-loss' }
const BIAS    = ['bullish', 'neutral', 'bearish']
const BIAS_STYLE = {
  bullish: { active: 'bg-profit/20 border-profit text-profit', icon: '📈' },
  neutral: { active: 'bg-accent/20 border-accent text-accent', icon: '↔' },
  bearish: { active: 'bg-loss/20 border-loss text-loss',       icon: '📉' },
}

function todayStr() { return new Date().toISOString().split('T')[0] }

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
      <div className="flex-1 border-t border-border/50 ml-1" />
    </div>
  )
}

export function Journal() {
  const {
    journalEntries, saveJournalEntry, deleteJournalEntry,
    tradingRules, addTradingRule, deleteTradingRule, seedDefaultRules,
    trades,
  } = useTradeStore()

  const [selectedDate, setSelectedDate] = useState(todayStr())

  // form state
  const [bias, setBias]               = useState('')
  const [keyLevels, setKeyLevels]     = useState('')
  const [plan, setPlan]               = useState('')
  const [mood, setMood]               = useState('')
  const [energy, setEnergy]           = useState('')
  const [rulesChecked, setRulesChecked] = useState({})
  const [note, setNote]               = useState('')
  const [saved, setSaved]             = useState(false)

  // new rule input
  const [newRule, setNewRule]         = useState('')
  const [editingRules, setEditingRules] = useState(false)
  const ruleInputRef = useRef(null)

  const entry = journalEntries.find(e => e.date === selectedDate) ?? null

  useEffect(() => {
    setBias(entry?.bias ?? '')
    setKeyLevels(entry?.keyLevels ?? '')
    setPlan(entry?.plan ?? '')
    setMood(entry?.mood ?? '')
    setEnergy(entry?.energy ?? '')
    setRulesChecked(entry?.rulesChecked ?? {})
    setNote(entry?.note ?? '')
    setSaved(false)
  }, [selectedDate])

  function handleSave() {
    saveJournalEntry(selectedDate, { bias, keyLevels, plan, mood, energy, rulesChecked, note: note.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleDelete() {
    if (!entry) return
    if (!window.confirm('Delete this journal entry?')) return
    deleteJournalEntry(selectedDate)
    setBias(''); setKeyLevels(''); setPlan(''); setMood(''); setEnergy('')
    setRulesChecked({}); setNote('')
  }

  function toggleRule(id) {
    setRulesChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleAddRule(e) {
    e.preventDefault()
    if (!newRule.trim()) return
    addTradingRule(newRule)
    setNewRule('')
    ruleInputRef.current?.focus()
  }

  const rulesFollowed = tradingRules.filter(r => rulesChecked[r.id]).length

  const hasContent = bias || keyLevels.trim() || plan.trim() || mood || energy ||
    note.trim() || tradingRules.some(r => rulesChecked[r.id] !== undefined)

  const isDirty = (
    bias       !== (entry?.bias ?? '') ||
    keyLevels  !== (entry?.keyLevels ?? '') ||
    plan       !== (entry?.plan ?? '') ||
    mood       !== (entry?.mood ?? '') ||
    energy     !== (entry?.energy ?? '') ||
    note       !== (entry?.note ?? '') ||
    JSON.stringify(rulesChecked) !== JSON.stringify(entry?.rulesChecked ?? {})
  )

  // trades for selected date
  const dayTrades = trades
    .filter(t => t.entryTime && t.entryTime.startsWith(selectedDate))
    .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  const dayMetrics = dayTrades.length ? computeMetrics(dayTrades) : null

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

        {journalEntries.map(e => {
          const rulesTotal  = tradingRules.length
          const rulesOk     = tradingRules.filter(r => e.rulesChecked?.[r.id]).length
          return (
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
                <div className="flex gap-1 items-center text-xs">
                  {e.bias === 'bullish' && <span className="text-profit">📈</span>}
                  {e.bias === 'bearish' && <span className="text-loss">📉</span>}
                  {e.mood && <span>{MOOD_EMOJI[e.mood] ?? ''}</span>}
                  {rulesTotal > 0 && (
                    <span className={rulesOk === rulesTotal ? 'text-profit' : rulesOk > 0 ? 'text-warn' : 'text-subtle'}>
                      {rulesOk}/{rulesTotal}
                    </span>
                  )}
                </div>
              </div>
              {e.note && <div className="text-xs text-subtle truncate">{e.note}</div>}
            </button>
          )
        })}
      </div>

      {/* ── Middle: journal form ── */}
      <div className="w-[500px] flex-shrink-0 border-r border-border overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-card border border-border rounded-lg px-2.5 py-1 text-sm text-slate-300 focus:outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">{fmtDate(selectedDate)}</span>
          </div>
          <div className="flex gap-2">
            {entry && (
              <button onClick={handleDelete}
                className="px-3 py-1.5 text-xs text-loss border border-loss/30 rounded-lg hover:bg-loss/10 transition-colors">
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                saved
                  ? 'bg-profit/20 border border-profit/40 text-profit'
                  : isDirty || (!entry && hasContent)
                  ? 'bg-accent hover:bg-blue-500 text-white'
                  : 'bg-card border border-border text-subtle cursor-not-allowed'
              }`}
            >
              {saved ? '✓ Saved' : entry ? 'Update' : 'Save'}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">

          {/* ── Section 1: Pre-Market Prep ── */}
          <div>
            <SectionHeader icon="📋" title="Pre-Market Prep" />

            {/* Bias */}
            <div className="mb-3">
              <div className="text-xs text-subtle mb-2">Market bias</div>
              <div className="flex gap-2">
                {BIAS.map(b => {
                  const s = BIAS_STYLE[b]
                  return (
                    <button
                      key={b}
                      onClick={() => setBias(bias === b ? '' : b)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                        bias === b ? s.active : 'bg-bg border-border text-muted hover:text-slate-300 hover:border-border/80'
                      }`}
                    >
                      {s.icon} {b}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Key levels */}
            <div className="mb-3">
              <div className="text-xs text-subtle mb-2">Key levels / news / catalysts</div>
              <textarea
                value={keyLevels}
                onChange={e => setKeyLevels(e.target.value)}
                rows={2}
                placeholder="Support/resistance, economic releases, earnings, key prices to watch..."
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
              />
            </div>

            {/* Plan */}
            <div>
              <div className="text-xs text-subtle mb-2">Today's plan</div>
              <textarea
                value={plan}
                onChange={e => setPlan(e.target.value)}
                rows={3}
                placeholder="What setups are you looking for? What will you avoid? Max trades, max loss..."
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
              />
            </div>
          </div>

          {/* ── Section 2: Session State ── */}
          <div>
            <SectionHeader icon="🧠" title="Session State" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-subtle mb-2">Mood going in</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map(m => (
                    <button key={m} onClick={() => setMood(mood === m ? '' : m)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all capitalize ${
                        mood === m
                          ? 'bg-accent/20 border border-accent text-accent'
                          : 'bg-bg border border-border text-muted hover:text-slate-300'
                      }`}>
                      {MOOD_EMOJI[m]} {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-subtle mb-2">Energy level</div>
                <div className="flex flex-wrap gap-1.5">
                  {ENERGY.map(e => (
                    <button key={e} onClick={() => setEnergy(energy === e ? '' : e)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all capitalize ${
                        energy === e
                          ? 'bg-accent/20 border border-accent text-accent'
                          : 'bg-bg border border-border text-muted hover:text-slate-300'
                      }`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Rules Checklist ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base leading-none">✅</span>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Rules Checklist</span>
              <div className="flex-1 border-t border-border/50 ml-1" />
              {tradingRules.length > 0 && (
                <span className={`text-xs font-semibold ${
                  rulesFollowed === tradingRules.length ? 'text-profit' :
                  rulesFollowed > 0 ? 'text-warn' : 'text-subtle'
                }`}>
                  {rulesFollowed}/{tradingRules.length} followed
                </span>
              )}
              <button
                onClick={() => { setEditingRules(v => !v) }}
                className="text-xs text-muted hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-border"
              >
                {editingRules ? 'done' : 'edit'}
              </button>
            </div>

            {tradingRules.length === 0 && !editingRules && (
              <div className="space-y-2">
                <button
                  onClick={seedDefaultRules}
                  className="w-full py-3 border border-accent/40 bg-accent/10 hover:bg-accent/15 rounded-xl text-sm text-accent transition-colors text-center"
                >
                  ↻ Load default mistake checklist (10 items, with Notion links)
                </button>
                <button
                  onClick={() => { setEditingRules(true); setTimeout(() => ruleInputRef.current?.focus(), 50) }}
                  className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-subtle hover:text-muted hover:border-accent/40 transition-colors text-center"
                >
                  + Add your own trading rules
                </button>
              </div>
            )}

            {tradingRules.length > 0 && (
              <div className="space-y-2">
                {tradingRules.map(r => (
                  <div key={r.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    rulesChecked[r.id] ? 'bg-profit/5 border border-profit/20' : 'bg-bg border border-border/60'
                  }`}>
                    <button
                      onClick={() => toggleRule(r.id)}
                      className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                        rulesChecked[r.id]
                          ? 'bg-profit border-profit text-white'
                          : 'border-border hover:border-profit/50'
                      }`}
                    >
                      {rulesChecked[r.id] && <span className="text-xs leading-none">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 ${rulesChecked[r.id] ? 'text-muted line-through' : 'text-slate-300'}`}>
                      {r.text}
                    </span>
                    {r.link && (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Notion reference"
                        onClick={e => e.stopPropagation()}
                        className="text-subtle hover:text-accent transition-colors text-xs flex-shrink-0"
                      >
                        ↗
                      </a>
                    )}
                    {editingRules && (
                      <button
                        onClick={() => deleteTradingRule(r.id)}
                        className="text-subtle hover:text-loss transition-colors text-xs flex-shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editingRules && (
              <form onSubmit={handleAddRule} className="flex gap-2 mt-2">
                <input
                  ref={ruleInputRef}
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  placeholder="New rule — e.g. No trading after 2 losses in a row"
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle focus:outline-none focus:border-accent"
                />
                <button type="submit"
                  className="px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
                  Add
                </button>
              </form>
            )}
          </div>

          {/* ── Section 4: Post-Session Notes ── */}
          <div>
            <SectionHeader icon="📝" title="Post-Session Reflection" />

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={8}
              placeholder="What happened today? What went well? What would you do differently? Any market observations..."
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
            />

            {!note && (
              <div className="mt-2 space-y-1">
                {[
                  'Did I follow my trading plan today?',
                  'What emotion drove my best/worst trade?',
                  'Was my sizing consistent with my risk rules?',
                  'What would I tell myself before the open tomorrow?',
                ].map((q, i) => (
                  <div key={i}
                    className="flex items-start gap-2 text-xs text-subtle cursor-pointer hover:text-muted transition-colors"
                    onClick={() => setNote(n => n ? n + '\n\n' + q + '\n' : q + '\n')}>
                    <span className="mt-0.5 flex-shrink-0">→</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
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
            {dayMetrics && (
              <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-5 gap-3 text-center mb-4">
                {[
                  ['Net P&L',  fmtPnL(dayMetrics.netPnL),                     pnlColor(dayMetrics.netPnL)],
                  ['Trades',   dayMetrics.total,                               ''],
                  ['Win Rate', (dayMetrics.winRate * 100).toFixed(0) + '%',   dayMetrics.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
                  ['Avg Win',  fmtPnL(dayMetrics.avgWin),                     'text-profit'],
                  ['Avg Loss', '-$' + dayMetrics.avgLoss.toFixed(2),          'text-loss'],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="text-xs text-subtle mb-0.5">{l}</div>
                    <div className={`font-bold text-sm ${c}`}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {dayTrades.map(t => (
              <div key={t.id}
                className={`rounded-xl border p-3.5 ${t.profit >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-slate-200">{t.instrument}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {t.side?.toUpperCase() ?? '—'} · {t.qty} contracts
                      {t.entryTime && ` · ${new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`}
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
