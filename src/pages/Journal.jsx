import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ClipboardList, Brain, CheckSquare, PenLine,
  TrendingUp, TrendingDown, MoveHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, BarChart3,
} from 'lucide-react'
import { useTradeStore } from '../store/tradeStore'
import {
  computeMetrics, fmtPnL, pnlColor, formatDuration, toDateStr,
  getWeekStart, getWeekEnd, shiftWeek, tradesInWeek, computeRuleAdherence,
} from '../engine/metrics'

const MOODS   = ['calm', 'focused', 'tired', 'stressed', 'fomo', 'revenge']
const MOOD_EMOJI = { calm: '😌', focused: '🎯', tired: '😴', stressed: '😰', fomo: '😤', revenge: '😡' }
const ENERGY  = ['good', 'tired', 'low', 'overloaded']
const ENERGY_COLOR = { good: 'text-profit', tired: 'text-warn', low: 'text-loss', overloaded: 'text-loss' }
const BIAS    = ['bullish', 'neutral', 'bearish']
const BIAS_STYLE = {
  bullish: { active: 'bg-profit/20 border-profit text-profit', Icon: TrendingUp },
  neutral: { active: 'bg-accent/20 border-accent text-accent', Icon: MoveHorizontal },
  bearish: { active: 'bg-loss/20 border-loss text-loss',       Icon: TrendingDown },
}
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function todayStr() { return new Date().toISOString().split('T')[0] }

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtWeekLabel(weekStart) {
  const end = getWeekEnd(weekStart)
  const s = new Date(weekStart + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const startLabel = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = s.getMonth() === e.getMonth()
    ? e.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
    : e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function SectionHeader({ Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className="text-accent" />
      <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
      <div className="flex-1 border-t border-border/50 ml-1" />
    </div>
  )
}

function StatTile({ label, value, sub, valueClass = '' }) {
  return (
    <div className="bg-bg rounded-lg p-2.5">
      <div className="text-[10px] text-muted mb-1">{label}</div>
      <div className={`font-bold text-sm ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-subtle mt-0.5">{sub}</div>}
    </div>
  )
}

export function Journal() {
  const {
    journalEntries, saveJournalEntry, deleteJournalEntry,
    weeklyEntries, saveWeeklyEntry, deleteWeeklyEntry,
    tradingRules, addTradingRule, deleteTradingRule, seedDefaultRules,
    trades,
  } = useTradeStore()

  const [mode, setMode] = useState('daily') // 'daily' | 'weekly'
  const currentWeekStart = getWeekStart(new Date())

  // ── Daily form state ──
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [bias, setBias]               = useState('')
  const [keyLevels, setKeyLevels]     = useState('')
  const [plan, setPlan]               = useState('')
  const [mood, setMood]               = useState('')
  const [energy, setEnergy]           = useState('')
  const [rulesChecked, setRulesChecked] = useState({})
  const [note, setNote]               = useState('')
  const [saved, setSaved]             = useState(false)

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

  const dayTrades = trades
    .filter(t => t.entryTime && t.entryTime.startsWith(selectedDate))
    .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
  const dayMetrics = dayTrades.length ? computeMetrics(dayTrades) : null

  // ── Weekly recap state ──
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart)
  const [wentWell, setWentWell]   = useState('')
  const [toImprove, setToImprove] = useState('')
  const [focusNext, setFocusNext] = useState('')
  const [weekSaved, setWeekSaved] = useState(false)

  const weekEntry = weeklyEntries.find(e => e.weekStart === selectedWeek) ?? null

  useEffect(() => {
    setWentWell(weekEntry?.wentWell ?? '')
    setToImprove(weekEntry?.toImprove ?? '')
    setFocusNext(weekEntry?.focusNext ?? '')
    setWeekSaved(false)
  }, [selectedWeek])

  function handleSaveWeek() {
    saveWeeklyEntry(selectedWeek, { wentWell: wentWell.trim(), toImprove: toImprove.trim(), focusNext: focusNext.trim() })
    setWeekSaved(true)
    setTimeout(() => setWeekSaved(false), 2000)
  }

  function handleDeleteWeek() {
    if (!weekEntry) return
    if (!window.confirm('Delete this weekly recap?')) return
    deleteWeeklyEntry(selectedWeek)
    setWentWell(''); setToImprove(''); setFocusNext('')
  }

  const weekHasContent = wentWell.trim() || toImprove.trim() || focusNext.trim()
  const weekIsDirty = (
    wentWell  !== (weekEntry?.wentWell ?? '') ||
    toImprove !== (weekEntry?.toImprove ?? '') ||
    focusNext !== (weekEntry?.focusNext ?? '')
  )

  const weekTrades = useMemo(
    () => tradesInWeek(trades, selectedWeek).sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime)),
    [trades, selectedWeek]
  )
  const weekMetrics    = useMemo(() => computeMetrics(weekTrades), [weekTrades])
  const weekAdherence  = useMemo(() => computeRuleAdherence(weekTrades), [weekTrades])
  const weekAdherenceColor = !weekAdherence ? 'text-muted'
    : weekAdherence.rate >= 0.7 ? 'text-profit' : weekAdherence.rate >= 0.4 ? 'text-warn' : 'text-loss'

  const weekDays = useMemo(() => WEEKDAY_LABELS.map((label, i) => {
    const d = new Date(selectedWeek + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const ds = toDateStr(d)
    const dTrades = weekTrades.filter(t => toDateStr(new Date(t.entryTime)) === ds)
    const pnl = dTrades.reduce((s, t) => s + t.profit, 0)
    const hasJournal = journalEntries.some(e => e.date === ds && (e.note?.trim() || e.plan?.trim() || e.bias))
    return { label, date: ds, pnl, count: dTrades.length, hasJournal, isFuture: ds > todayStr() }
  }), [selectedWeek, weekTrades, journalEntries])

  const daysJournaled = weekDays.filter(d => d.hasJournal).length
  const activeDays = weekDays.filter(d => d.count > 0)
  const bestDay  = activeDays.length ? activeDays.reduce((b, d) => d.pnl > b.pnl ? d : b) : null
  const worstDay = activeDays.length ? activeDays.reduce((b, d) => d.pnl < b.pnl ? d : b) : null

  function jumpToDay(date) {
    setSelectedDate(date)
    setMode('daily')
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar: mode toggle + entry list ── */}
      <div className="w-56 flex-shrink-0 border-r border-border overflow-y-auto bg-surface">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-300">Journal</div>
            <div className="text-xs text-muted">{mode === 'daily' ? journalEntries.length : weeklyEntries.length}</div>
          </div>
          <div className="flex bg-bg border border-border rounded-lg p-0.5">
            {['daily', 'weekly'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 px-2 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                  mode === m ? 'bg-accent text-white' : 'text-muted hover:text-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {mode === 'daily' ? (
          <>
            <button
              onClick={() => setSelectedDate(todayStr())}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm border-b border-border transition-colors border-l-2 ${
                selectedDate === todayStr()
                  ? 'bg-accent/10 text-accent border-l-accent'
                  : 'text-muted hover:text-slate-300 hover:bg-white/[0.03] border-l-transparent'
              }`}
            >
              <PenLine size={14} />
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
                      {e.bias === 'bullish' && <TrendingUp size={13} className="text-profit" />}
                      {e.bias === 'bearish' && <TrendingDown size={13} className="text-loss" />}
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
          </>
        ) : (
          <>
            <button
              onClick={() => setSelectedWeek(currentWeekStart)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm border-b border-border transition-colors border-l-2 ${
                selectedWeek === currentWeekStart
                  ? 'bg-accent/10 text-accent border-l-accent'
                  : 'text-muted hover:text-slate-300 hover:bg-white/[0.03] border-l-transparent'
              }`}
            >
              <CalendarDays size={14} />
              <span>This Week</span>
              {!weeklyEntries.find(e => e.weekStart === currentWeekStart) && (
                <span className="ml-auto text-xs text-subtle">empty</span>
              )}
            </button>

            {weeklyEntries.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-subtle">Your weekly recaps will appear here.</div>
            )}

            {weeklyEntries.map(e => {
              const wTrades = tradesInWeek(trades, e.weekStart)
              const wPnl = wTrades.reduce((s, t) => s + t.profit, 0)
              return (
                <button
                  key={e.weekStart}
                  onClick={() => setSelectedWeek(e.weekStart)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors border-l-2 ${
                    selectedWeek === e.weekStart ? 'bg-accent/10 border-l-accent' : 'border-l-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-xs font-semibold text-slate-300">{fmtWeekLabel(e.weekStart)}</div>
                    {wTrades.length > 0 && <div className={`text-xs font-bold ${pnlColor(wPnl)}`}>{fmtPnL(wPnl)}</div>}
                  </div>
                  {e.focusNext && <div className="text-xs text-subtle truncate">→ {e.focusNext}</div>}
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* ── Middle: form ── */}
      <div className="w-[440px] xl:w-[520px] flex-shrink-0 border-r border-border overflow-y-auto">
        {mode === 'daily' ? (
          <>
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
                      ? 'bg-accent hover:bg-accentHover text-white'
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
                <SectionHeader Icon={ClipboardList} title="Pre-Market Prep" />

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
                          <s.Icon size={15} /> {b}
                        </button>
                      )
                    })}
                  </div>
                </div>

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
                <SectionHeader Icon={Brain} title="Session State" />

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
                  <CheckSquare size={14} className="text-accent" />
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
                <SectionHeader Icon={PenLine} title="Post-Session Reflection" />

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
          </>
        ) : (
          <>
            {/* Sticky header — week nav */}
            <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedWeek(w => shiftWeek(w, -1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-slate-300 hover:border-subtle transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm text-slate-300 font-medium w-40 text-center">{fmtWeekLabel(selectedWeek)}</span>
                <button
                  onClick={() => setSelectedWeek(w => shiftWeek(w, 1))}
                  disabled={shiftWeek(selectedWeek, 1) > currentWeekStart}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-slate-300 hover:border-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                {weekEntry && (
                  <button onClick={handleDeleteWeek}
                    className="px-3 py-1.5 text-xs text-loss border border-loss/30 rounded-lg hover:bg-loss/10 transition-colors">
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSaveWeek}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    weekSaved
                      ? 'bg-profit/20 border border-profit/40 text-profit'
                      : weekIsDirty || (!weekEntry && weekHasContent)
                      ? 'bg-accent hover:bg-accentHover text-white'
                      : 'bg-card border border-border text-subtle cursor-not-allowed'
                  }`}
                >
                  {weekSaved ? '✓ Saved' : weekEntry ? 'Update' : 'Save'}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">

              {/* ── Auto-computed stats ── */}
              <div>
                <SectionHeader Icon={BarChart3} title="This Week, Automatically" />
                {!weekMetrics ? (
                  <div className="text-sm text-subtle bg-bg border border-border/60 rounded-lg px-3 py-4 text-center mb-3">
                    No trades this week yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <StatTile label="Net P&L" value={fmtPnL(weekMetrics.netPnL)} valueClass={pnlColor(weekMetrics.netPnL)} />
                    <StatTile label="Trades" value={weekMetrics.total} />
                    <StatTile label="Win Rate" value={(weekMetrics.winRate * 100).toFixed(0) + '%'} valueClass={weekMetrics.winRate >= 0.5 ? 'text-profit' : 'text-loss'} />
                    <StatTile
                      label="Rule Adherence"
                      value={weekAdherence ? (weekAdherence.rate * 100).toFixed(0) + '%' : '—'}
                      valueClass={weekAdherenceColor}
                    />
                    <StatTile label="Best Day" value={bestDay ? fmtPnL(bestDay.pnl) : '—'} sub={bestDay?.label} valueClass="text-profit" />
                    <StatTile label="Worst Day" value={worstDay ? fmtPnL(worstDay.pnl) : '—'} sub={worstDay?.label} valueClass="text-loss" />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs bg-bg border border-border/60 rounded-lg px-3 py-2">
                  <span className="text-subtle">Days journaled</span>
                  <span className={daysJournaled === 7 ? 'text-profit font-semibold' : 'text-muted'}>{daysJournaled}/7</span>
                </div>
              </div>

              {/* ── Day by day ── */}
              <div>
                <SectionHeader Icon={CalendarDays} title="Day by Day" />
                <div className="space-y-1">
                  {weekDays.map(d => (
                    <button
                      key={d.date}
                      onClick={() => !d.isFuture && jumpToDay(d.date)}
                      disabled={d.isFuture}
                      title={d.isFuture ? undefined : 'Open this day in the daily journal'}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        d.isFuture ? 'opacity-40 cursor-default' : 'hover:bg-white/[0.03] cursor-pointer'
                      } ${d.date === todayStr() ? 'ring-1 ring-accent/40' : ''}`}
                    >
                      <span className="flex items-center gap-2 text-muted">
                        <span className="w-8 text-left">{d.label}</span>
                        <span className="text-subtle">{fmtShort(d.date)}</span>
                        {d.hasJournal && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="Journaled" />}
                      </span>
                      <span className={`font-medium ${d.count ? pnlColor(d.pnl) : 'text-subtle'}`}>
                        {d.count ? fmtPnL(d.pnl) : d.isFuture ? '' : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Reflection ── */}
              <div>
                <SectionHeader Icon={PenLine} title="What Went Well" />
                <textarea
                  value={wentWell}
                  onChange={e => setWentWell(e.target.value)}
                  rows={3}
                  placeholder="Setups that worked, good discipline moments, trades you're proud of..."
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

              <div>
                <SectionHeader Icon={PenLine} title="What To Improve" />
                <textarea
                  value={toImprove}
                  onChange={e => setToImprove(e.target.value)}
                  rows={3}
                  placeholder="Recurring mistakes, rules broken, patterns to fix..."
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

              <div>
                <SectionHeader Icon={PenLine} title="Focus For Next Week" />
                <textarea
                  value={focusNext}
                  onChange={e => setFocusNext(e.target.value)}
                  rows={2}
                  placeholder="One or two concrete things to focus on..."
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

            </div>
          </>
        )}
      </div>

      {/* ── Right: trades ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {mode === 'daily' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="text-xs text-muted uppercase tracking-wider mb-3">
              Trades — {fmtWeekLabel(selectedWeek)}
            </div>

            {weekTrades.length === 0 ? (
              <div className="text-center py-16 text-subtle text-sm">No trades found for this week.</div>
            ) : (
              <div className="space-y-3">
                {weekMetrics && (
                  <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-5 gap-3 text-center mb-4">
                    {[
                      ['Net P&L',  fmtPnL(weekMetrics.netPnL),                     pnlColor(weekMetrics.netPnL)],
                      ['Trades',   weekMetrics.total,                               ''],
                      ['Win Rate', (weekMetrics.winRate * 100).toFixed(0) + '%',   weekMetrics.winRate >= 0.5 ? 'text-profit' : 'text-loss'],
                      ['Avg Win',  fmtPnL(weekMetrics.avgWin),                     'text-profit'],
                      ['Avg Loss', '-$' + weekMetrics.avgLoss.toFixed(2),          'text-loss'],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <div className="text-xs text-subtle mb-0.5">{l}</div>
                        <div className={`font-bold text-sm ${c}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {weekTrades.map(t => (
                  <div key={t.id}
                    className={`rounded-xl border p-3.5 ${t.profit >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-200">{t.instrument}</div>
                        <div className="text-xs text-muted mt-0.5">
                          {t.side?.toUpperCase() ?? '—'} · {t.qty} contracts
                          {t.entryTime && ` · ${new Date(t.entryTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`}
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
          </>
        )}
      </div>
    </div>
  )
}
