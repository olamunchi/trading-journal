import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function mergeUnique(existing, incoming) {
  const keys = new Set(existing.map(t => `${t.instrument}|${t.entryTime}|${t.profit}`))
  const unique = incoming.filter(t => !keys.has(`${t.instrument}|${t.entryTime}|${t.profit}`))
  return {
    trades: [...existing, ...unique].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime)),
    skipped: incoming.length - unique.length,
  }
}

export const useTradeStore = create(
  persist(
    (set) => ({
      trades: [],
      periodFilter: 'all',
      sessionOffset: 0,
      dailyLossLimit: null,
      lastImportStats: null,
      journalEntries: [],
      tradingRules: [],
      addTrades: (incoming) => set(state => {
        const { trades, skipped } = mergeUnique(state.trades, incoming)
        return { trades, lastImportStats: { added: incoming.length - skipped, skipped } }
      }),
      updateTrade: (id, patch) => set(state => ({
        trades: state.trades.map(t => t.id === id ? { ...t, ...patch } : t),
      })),
      deleteTrade: (id) => set(state => ({ trades: state.trades.filter(t => t.id !== id) })),
      clearAll: () => set({ trades: [] }),
      setPeriodFilter: (f) => set({ periodFilter: f }),
      setSessionOffset: (n) => set({ sessionOffset: n }),
      setDailyLossLimit: (v) => set({ dailyLossLimit: v }),
      saveJournalEntry: (date, data) => set(state => ({
        journalEntries: [
          ...state.journalEntries.filter(e => e.date !== date),
          { ...data, date },
        ].sort((a, b) => b.date.localeCompare(a.date)),
      })),
      deleteJournalEntry: (date) => set(state => ({
        journalEntries: state.journalEntries.filter(e => e.date !== date),
      })),
      addTradingRule: (text) => set(state => ({
        tradingRules: [...state.tradingRules, { id: `${Date.now()}`, text: text.trim() }],
      })),
      deleteTradingRule: (id) => set(state => ({
        tradingRules: state.tradingRules.filter(r => r.id !== id),
      })),
    }),
    { name: 'tj-v1' }
  )
)
