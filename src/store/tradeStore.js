import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function mergeUnique(existing, incoming) {
  const keys = new Set(existing.map(t => `${t.instrument}|${t.entryTime}|${t.profit}`))
  const unique = incoming.filter(t => !keys.has(`${t.instrument}|${t.entryTime}|${t.profit}`))
  return [...existing, ...unique].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime))
}

export const useTradeStore = create(
  persist(
    (set) => ({
      trades: [],
      periodFilter: 'all',
      sessionOffset: 0,
      dailyLossLimit: null,
      addTrades: (incoming) => set(state => ({ trades: mergeUnique(state.trades, incoming) })),
      updateTrade: (id, patch) => set(state => ({
        trades: state.trades.map(t => t.id === id ? { ...t, ...patch } : t),
      })),
      deleteTrade: (id) => set(state => ({ trades: state.trades.filter(t => t.id !== id) })),
      clearAll: () => set({ trades: [] }),
      setPeriodFilter: (f) => set({ periodFilter: f }),
      setSessionOffset: (n) => set({ sessionOffset: n }),
      setDailyLossLimit: (v) => set({ dailyLossLimit: v }),
    }),
    { name: 'tj-v1' }
  )
)
