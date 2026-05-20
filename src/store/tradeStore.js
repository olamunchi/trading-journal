import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectSessionOffset } from '../engine/metrics'

// Mistake categories from the user's Notion playbook — phrased positively
// so the existing "followed = good" rules-checklist semantics still work.
// Each rule keeps the original Notion link so the underlying explanation
// is one click away.
export const DEFAULT_TRADING_RULES = [
  { id: 'def-move-stop',     text: 'Did not move the stop (Fear of losing)',            link: 'https://www.notion.so/Move-the-stop-Fear-of-losing-71c2fa60d437412fb40ec6b8fd2c8ff8?pvs=21' },
  { id: 'def-move-targets',  text: 'Did not move the targets (Fear of losing profits)', link: 'https://www.notion.so/Move-the-Targets-Fear-of-losing-profits-165a9fe7d282451086c60a1acfad7348?pvs=21' },
  { id: 'def-chase',         text: 'Did not chase a trade (FOMO)',                      link: 'https://www.notion.so/Chase-a-trade-FOMO-8cc6fca5d60a44b29a16666c3d9a67bb?pvs=21' },
  { id: 'def-respect-risk',  text: 'Respected risk',                                    link: 'https://www.notion.so/Risk-not-respected-20ac376d88be80f1b3e9e4bd2cbb5800?pvs=21' },
  { id: 'def-breaks',        text: 'Took breaks / rest',                                link: 'https://www.notion.so/No-Breaks-Rest-20ac376d88be80309d8efa9d73416bf7?pvs=21' },
  { id: 'def-no-overtrade',  text: 'Did not over-trade',                                link: 'https://www.notion.so/Over-Trading-80fdce90aa3642e5975ed3e336c90185?pvs=21' },
  { id: 'def-no-dca',        text: 'Did not DCA',                                       link: 'https://www.notion.so/DCA-0d182edf7c394d58ab4713d53b1df033?pvs=21' },
  { id: 'def-process',       text: 'Traded inside the process (no mistake setups)',     link: 'https://www.notion.so/Trade-outside-process-mistake-d212f35c22fa4a93872f158ca01a6c39?pvs=21' },
  { id: 'def-right-risk',    text: 'Used correct risk size',                            link: 'https://www.notion.so/Wrong-Risk-b2a68c4eb8dc4029913ec1cac1101e56?pvs=21' },
  { id: 'def-copier',        text: 'No trade copier errors',                            link: 'https://www.notion.so/Trade-copier-error-1d6aa32ffd864993b5d63094f27d7ba8?pvs=21' },
]

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
      sessionOffset: detectSessionOffset(),
      sessionOffsetAuto: true,
      dailyLossLimit: null,
      lastImportStats: null,
      journalEntries: [],
      tradingRules: [...DEFAULT_TRADING_RULES],
      defaultRulesSeeded: true,
      // Map of CSV-header signature → saved column mapping. Re-importing a
      // file with the same headers skips the column mapper step.
      csvMappings: {},
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
      setSessionOffset: (n) => set({ sessionOffset: n, sessionOffsetAuto: false }),
      resetSessionOffsetAuto: () => set({ sessionOffset: detectSessionOffset(), sessionOffsetAuto: true }),
      setDailyLossLimit: (v) => set({ dailyLossLimit: v }),
      saveCsvMapping: (signature, mapping) => set(state => ({
        csvMappings: { ...state.csvMappings, [signature]: mapping },
      })),
      saveJournalEntry: (date, data) => set(state => ({
        journalEntries: [
          ...state.journalEntries.filter(e => e.date !== date),
          { ...data, date },
        ].sort((a, b) => b.date.localeCompare(a.date)),
      })),
      deleteJournalEntry: (date) => set(state => ({
        journalEntries: state.journalEntries.filter(e => e.date !== date),
      })),
      addTradingRule: (text, link) => set(state => ({
        tradingRules: [...state.tradingRules, { id: `${Date.now()}`, text: text.trim(), ...(link ? { link } : {}) }],
      })),
      deleteTradingRule: (id) => set(state => ({
        tradingRules: state.tradingRules.filter(r => r.id !== id),
      })),
      seedDefaultRules: () => set(state => ({
        tradingRules: [
          ...state.tradingRules,
          ...DEFAULT_TRADING_RULES.filter(d => !state.tradingRules.some(r => r.id === d.id)),
        ],
        defaultRulesSeeded: true,
      })),
    }),
    {
      name: 'tj-v1',
      // Seed default rules for users whose persisted state predates them.
      // Skip if the user has already curated their own list, even an empty one
      // marked via defaultRulesSeeded.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.defaultRulesSeeded && (!state.tradingRules || state.tradingRules.length === 0)) {
          state.tradingRules = [...DEFAULT_TRADING_RULES]
          state.defaultRulesSeeded = true
        }
      },
    }
  )
)
