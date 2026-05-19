import { useState } from 'react'
import { useTradeStore } from '../../store/tradeStore'
import { fmtPnL, formatDuration, computeTradeR } from '../../engine/metrics'

const PRESET_TAGS = [
  'A+ Setup', 'B Setup', 'C Setup',
  'Trend Follow', 'Reversal', 'Breakout', 'News Play', 'Mean Reversion',
  'FOMO', 'Revenge Trade', 'Late Entry', 'Overtraded', 'Cut Short',
  'Good Discipline', 'Hesitated',
]

const MOODS = [
  { id: 'calm',     label: '😌 Calm',     cls: 'border-profit/40 text-profit hover:bg-profit/10' },
  { id: 'focused',  label: '🎯 Focused',  cls: 'border-accent/40 text-accent hover:bg-accent/10' },
  { id: 'fomo',     label: '😤 FOMO',     cls: 'border-warn/40 text-warn hover:bg-warn/10' },
  { id: 'revenge',  label: '😠 Revenge',  cls: 'border-loss/40 text-loss hover:bg-loss/10' },
  { id: 'tired',    label: '😴 Tired',    cls: 'border-subtle/40 text-muted hover:bg-white/5' },
  { id: 'stressed', label: '😰 Stressed', cls: 'border-loss/40 text-loss hover:bg-loss/10' },
]

const MISTAKES = ['FOMO Entry', 'Revenge Trade', 'Moved Stop', 'Cut Winner', 'Oversize', 'Chased Entry', 'Ignored Rules']

const EXEC_LABELS = { 1: 'Poor', 2: 'Below Avg', 3: 'Neutral', 4: 'Good', 5: 'Perfect' }

export function TradeDrawer({ trade, onClose }) {
  const { updateTrade, deleteTrade } = useTradeStore()
  const [note, setNote]               = useState(trade.note || '')
  const [tags, setTags]               = useState(trade.tags || [])
  const [customTag, setCustomTag]     = useState('')
  const [mood, setMood]               = useState(trade.mood || '')
  const [confidence, setConfidence]   = useState(trade.confidence || '')
  const [followedPlan, setFollowedPlan] = useState(trade.followedPlan ?? null)
  const [mistakeType, setMistakeType] = useState(trade.mistakeType || '')
  const [execScore, setExecScore]     = useState(trade.executionScore || null)
  const [stopPrice, setStopPrice]     = useState(trade.stopPrice || '')

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function addCustomTag() {
    const t = customTag.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setCustomTag('')
  }

  function save() {
    updateTrade(trade.id, {
      note, tags, mood, confidence, followedPlan,
      mistakeType, executionScore: execScore,
      stopPrice: stopPrice !== '' ? +stopPrice : null,
    })
    onClose()
  }

  function handleDelete() {
    if (window.confirm('Delete this trade?')) { deleteTrade(trade.id); onClose() }
  }

  const isWin = trade.profit > 0
  const rMultiple = computeTradeR({ ...trade, stopPrice: stopPrice !== '' ? +stopPrice : trade.stopPrice })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-surface border-l border-border z-50 flex flex-col overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <div className="font-bold text-lg">{trade.instrument}</div>
            <div className="text-xs text-muted mt-0.5">
              {trade.entryTime ? new Date(trade.entryTime).toLocaleString() : '—'}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-slate-300 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="p-5 space-y-6 flex-1">

          {/* P&L Banner */}
          <div className={`rounded-xl p-4 text-center ${isWin ? 'bg-profit/10 border border-profit/30' : 'bg-loss/10 border border-loss/30'}`}>
            <div className={`text-3xl font-bold ${isWin ? 'text-profit' : 'text-loss'}`}>{fmtPnL(trade.profit)}</div>
            {rMultiple !== null && (
              <div className={`text-base font-semibold mt-1 ${rMultiple >= 0 ? 'text-profit' : 'text-loss'}`}>
                {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(2)}R
              </div>
            )}
            <div className="text-xs text-muted mt-1">{isWin ? '✓ Win' : '✗ Loss'}</div>
          </div>

          {/* Trade details grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ['Side', <span className={`font-semibold ${trade.side === 'long' ? 'text-profit' : 'text-loss'}`}>{(trade.side || '').toUpperCase()}</span>],
              ['Qty', trade.qty || '—'],
              ['Entry', trade.entryPrice ? trade.entryPrice.toFixed(4) : '—'],
              ['Exit', trade.exitPrice ? trade.exitPrice.toFixed(4) : '—'],
              ['MAE', trade.mae ? <span className="text-loss">-${trade.mae.toFixed(2)}</span> : '—'],
              ['MFE', trade.mfe ? <span className="text-profit">+${trade.mfe.toFixed(2)}</span> : '—'],
              ['Duration', formatDuration(trade.duration)],
              ['Commission', trade.commission ? <span className="text-loss">-${trade.commission.toFixed(2)}</span> : '—'],
            ].map(([label, val]) => (
              <div key={label} className="bg-bg rounded-lg p-3">
                <div className="text-xs text-muted mb-1">{label}</div>
                <div className="text-sm font-medium">{val}</div>
              </div>
            ))}
          </div>

          {/* ── Execution ────────────────────────────────── */}
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-3">Execution</div>
            <div className="space-y-3">

              {/* Stop price → R */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-28 flex-shrink-0">Stop Price</label>
                <input
                  type="number"
                  value={stopPrice}
                  onChange={e => setStopPrice(e.target.value)}
                  placeholder="e.g. 21450"
                  className="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 placeholder-subtle focus:outline-none focus:border-accent"
                />
                {rMultiple !== null && (
                  <span className={`text-sm font-bold w-16 text-right ${rMultiple >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                  </span>
                )}
              </div>

              {/* Execution score */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-28 flex-shrink-0">Execution Score</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setExecScore(execScore === n ? null : n)}
                      title={EXEC_LABELS[n]}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                        execScore === n
                          ? 'bg-accent text-white'
                          : 'bg-bg border border-border text-muted hover:border-accent hover:text-accent'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  {execScore && (
                    <span className="text-xs text-muted self-center ml-1">{EXEC_LABELS[execScore]}</span>
                  )}
                </div>
              </div>

              {/* Followed plan */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-28 flex-shrink-0">Followed Plan?</label>
                <div className="flex gap-2">
                  {[{ v: true, label: '✓ Yes', cls: 'border-profit/40 text-profit hover:bg-profit/10' }, { v: false, label: '✗ No', cls: 'border-loss/40 text-loss hover:bg-loss/10' }].map(({ v, label, cls }) => (
                    <button
                      key={String(v)}
                      onClick={() => setFollowedPlan(followedPlan === v ? null : v)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                        followedPlan === v ? (v ? 'bg-profit/20 border-profit text-profit' : 'bg-loss/20 border-loss text-loss') : `bg-bg ${cls}`
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mistake type — only if !followedPlan */}
              {followedPlan === false && (
                <div className="flex items-start gap-3">
                  <label className="text-sm text-muted w-28 flex-shrink-0 mt-1">Mistake</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MISTAKES.map(m => (
                      <button
                        key={m}
                        onClick={() => setMistakeType(mistakeType === m ? '' : m)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          mistakeType === m
                            ? 'bg-loss/20 border-loss text-loss'
                            : 'bg-bg border-border text-muted hover:border-loss hover:text-loss'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Psychology ───────────────────────────────── */}
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-3">Psychology</div>
            <div className="space-y-3">

              {/* Mood */}
              <div>
                <div className="text-xs text-subtle mb-2">Mood when you entered</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMood(mood === m.id ? '' : m.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        mood === m.id
                          ? 'bg-card border-slate-400 text-slate-200 ring-1 ring-slate-400'
                          : `bg-bg border ${m.cls}`
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-28 flex-shrink-0">Confidence</label>
                <div className="flex gap-2">
                  {[
                    { v: 'low',    label: 'Low',    cls: 'border-loss/40 text-loss' },
                    { v: 'medium', label: 'Medium', cls: 'border-warn/40 text-warn' },
                    { v: 'high',   label: 'High',   cls: 'border-profit/40 text-profit' },
                  ].map(({ v, label, cls }) => (
                    <button
                      key={v}
                      onClick={() => setConfidence(confidence === v ? '' : v)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                        confidence === v
                          ? 'bg-card border-slate-400 text-slate-200'
                          : `bg-bg ${cls} hover:bg-white/5`
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Setup Tags ───────────────────────────────── */}
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Setup Tags</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    tags.includes(tag)
                      ? 'bg-accent text-white'
                      : 'bg-bg border border-border text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                placeholder="Custom tag…"
                className="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-slate-300 placeholder-subtle focus:outline-none focus:border-accent"
              />
              <button onClick={addCustomTag} className="px-3 py-1.5 bg-card border border-border rounded-md text-sm text-muted hover:text-slate-300 transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* ── Notes ───────────────────────────────────── */}
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Notes</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Entry reason, what happened, lessons learned…"
              rows={4}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 placeholder-subtle resize-none focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex gap-2 flex-shrink-0">
          <button onClick={save} className="flex-1 py-2 bg-accent hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            Save
          </button>
          <button onClick={handleDelete} className="px-4 py-2 bg-loss/10 hover:bg-loss/20 text-loss text-sm font-medium rounded-lg border border-loss/30 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </>
  )
}
