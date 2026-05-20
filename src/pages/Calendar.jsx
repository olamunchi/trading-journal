import { useState, useMemo } from 'react'
import { useTradeStore } from '../store/tradeStore'
import { toDateStr, fmtPnL, pnlColor } from '../engine/metrics'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Calendar() {
  const { trades } = useTradeStore()
  const today = new Date()
  const [year, setYear]           = useState(today.getFullYear())
  const [month, setMonth]         = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const byDay = useMemo(() => {
    const m = {}
    trades.forEach(t => {
      if (!t.entryTime) return
      const d = new Date(t.entryTime)
      if (d.getMonth() !== month || d.getFullYear() !== year) return
      const k = toDateStr(d)
      if (!m[k]) m[k] = { pnl: 0, count: 0, wins: 0, losses: 0, trades: [] }
      m[k].pnl += t.profit
      m[k].count++
      if (t.profit > 0) m[k].wins++
      else if (t.profit < 0) m[k].losses++
      m[k].trades.push(t)
    })
    return m
  }, [trades, year, month])

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel  = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
  const maxAbs      = Math.max(...Object.values(byDay).map(v => Math.abs(v.pnl)), 1)
  const todayStr    = toDateStr(today)
  const dayInfo     = selectedDay ? byDay[selectedDay] : null

  const summaryData = useMemo(() => {
    if (!Object.keys(byDay).length) return null
    const monthPnL    = Object.values(byDay).reduce((s, v) => s + v.pnl, 0)
    const monthTrades = Object.values(byDay).reduce((s, v) => s + v.count, 0)
    const tradingDays = Object.keys(byDay).length
    const greenDays   = Object.values(byDay).filter(v => v.pnl >= 0).length
    return { monthPnL, monthTrades, tradingDays, greenDays }
  }, [byDay])

  return (
    <div className="p-6 space-y-4">
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prev} className="px-3 py-1.5 bg-card border border-border rounded-md text-sm text-muted hover:text-slate-300 transition-colors">
          ← Prev
        </button>
        <h2 className="text-base font-semibold text-slate-200 flex-1 text-center">{monthLabel}</h2>
        <button onClick={next} className="px-3 py-1.5 bg-card border border-border rounded-md text-sm text-muted hover:text-slate-300 transition-colors">
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-muted py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const k   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const info = byDay[k]
            const isToday    = k === todayStr
            const isSelected = k === selectedDay
            const intensity  = info ? Math.min(Math.abs(info.pnl) / maxAbs, 1) : 0

            return (
              <div
                key={k}
                onClick={() => setSelectedDay(k === selectedDay ? null : k)}
                className={`rounded-lg p-1.5 text-center cursor-pointer transition-all select-none hover:brightness-125
                  ${isSelected ? 'ring-2 ring-accent' : ''}
                  ${isToday && !isSelected ? 'ring-1 ring-accent/50' : ''}`}
                style={{
                  background: info
                    ? info.pnl >= 0
                      ? `rgba(63,185,80,${0.1 + intensity * 0.4})`
                      : `rgba(248,81,73,${0.1 + intensity * 0.4})`
                    : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className={`text-xs font-medium ${isToday ? 'text-accent' : info ? 'text-slate-300' : 'text-subtle'}`}>
                  {day}
                </div>
                {info && (
                  <>
                    <div className={`text-[9px] font-semibold mt-0.5 ${info.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {info.pnl >= 0 ? '+' : ''}{info.pnl.toFixed(0)}
                    </div>
                    <div className="text-[8px] text-subtle leading-tight">
                      <span className="text-profit">{info.wins}W</span>
                      <span className="mx-0.5">·</span>
                      <span className="text-loss">{info.losses}L</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly summary */}
      {summaryData && (
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Month P&L',     fmtPnL(summaryData.monthPnL),  pnlColor(summaryData.monthPnL)],
            ['Total Trades',  summaryData.monthTrades,        ''],
            ['Trading Days',  summaryData.tradingDays,        ''],
            ['Green Days',    `${summaryData.greenDays}/${summaryData.tradingDays}`,
              summaryData.greenDays / summaryData.tradingDays >= 0.5 ? 'text-profit' : 'text-loss'],
          ].map(([l, v, c]) => (
            <div key={l} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted mb-1">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Day detail */}
      {dayInfo && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold">{selectedDay}</span>
            <span className={`font-bold ${pnlColor(dayInfo.pnl)}`}>{fmtPnL(dayInfo.pnl)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {['Time', 'Symbol', 'Side', 'Entry', 'Exit', 'P&L'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayInfo.trades.map(t => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="px-4 py-2 text-muted text-xs">
                      {t.entryTime ? new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                    </td>
                    <td className="px-4 py-2 font-semibold">{t.instrument}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.side === 'long' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>
                        {(t.side || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2">{t.entryPrice?.toFixed(2) || '—'}</td>
                    <td className="px-4 py-2">{t.exitPrice?.toFixed(2) || '—'}</td>
                    <td className={`px-4 py-2 font-bold ${pnlColor(t.profit)}`}>{fmtPnL(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
