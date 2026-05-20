# TradeLog — NT8 Trading Journal

A local-first trading journal built with Vite + React. No backend, no accounts — all data lives in `localStorage` (trade data + journal) and IndexedDB (screenshots). Designed to import CSV exports from NinjaTrader 8 and provide full performance analytics.

---

## How to Run

```bash
cd "E:\Downloads\TradingJournal"
npm run dev
```

Open: http://localhost:5173

**To build for production:**
```bash
npm run build
```

---

## Deployment

- **GitHub repo:** https://github.com/olamunchi/trading-journal
- **Hosting:** Vercel — auto-deploys on every push to `main`
- **Live URL:** check Vercel dashboard → project → Domains for the stable production URL
- **To deploy:** just `git push` — Vercel auto-deploys from GitHub main branch

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Vite + React 19 |
| Charts | Recharts 2 |
| State | Zustand + `persist` middleware (localStorage key: `tj-v1`) |
| Screenshots | IndexedDB (`tj-images-v1`) via `src/services/imageStore.js` |
| CSV parsing | PapaParse 5 |
| Styling | Tailwind CSS v3 (custom dark theme — see `tailwind.config.js`) |

---

## Project Structure

```
src/
├── App.jsx                        # Root — state-based navigation (no react-router)
├── main.jsx                       # Entry point
├── index.css                      # Tailwind directives + base styles + scrollbar
│
├── store/
│   └── tradeStore.js              # Zustand store — all trade CRUD + journal + settings
│
├── engine/
│   ├── metrics.js                 # Pure analytics functions (no side effects)
│   ├── reportGenerator.js         # Generates markdown AI coaching report
│   └── csvParser.js               # Column auto-detection + trade normalization
│
├── services/
│   └── imageStore.js              # IndexedDB wrapper for trade screenshots
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx            # Left nav with 7 items
│   │   └── Topbar.jsx             # Period filter dropdown + Export + Import buttons
│   ├── ui/
│   │   ├── KpiCard.jsx            # Reusable metric card
│   │   └── ChartCard.jsx          # Reusable chart wrapper card
│   └── trades/
│       └── TradeDrawer.jsx        # Trade detail panel — narrow or full-screen (see below)
│
└── pages/
    ├── Dashboard.jsx              # KPIs + equity curve + all charts + daily loss limit
    ├── Trades.jsx                 # Filterable/sortable trade table
    ├── Calendar.jsx               # Monthly P&L heatmap
    ├── Analytics.jsx              # 10-tab analytics view
    ├── Journal.jsx                # Daily trading journal (3-column layout)
    ├── Report.jsx                 # AI coaching report — copy/paste to Claude.ai
    └── Import.jsx                 # Drag & drop CSV → column mapper → import
```

---

## Color Palette (Tailwind custom colors — `tailwind.config.js`)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0d1117` | Page background |
| `surface` | `#161b22` | Sidebar, topbar |
| `card` | `#1c2128` | All cards and panels |
| `border` | `#30363d` | All borders |
| `profit` | `#3fb950` | Wins, green values |
| `loss` | `#f85149` | Losses, red values |
| `warn` | `#d29922` | Commissions, warnings |
| `accent` | `#388bfd` | Active nav, buttons, focus rings |
| `muted` | `#8b949e` | Secondary labels |
| `subtle` | `#6e7681` | Tertiary / placeholder text |

---

## Data Model — Trade Object

Every trade stored in Zustand has this shape:

```js
{
  id: string,              // `${Date.now()}-${rowIndex}` — generated at import
  instrument: string,      // e.g. "NQ 06-26", "MES"
  side: 'long' | 'short',
  qty: number,
  entryTime: string,       // ISO 8601 string or null
  exitTime: string,        // ISO 8601 string or null
  entryPrice: number,
  exitPrice: number,
  profit: number,          // Net P&L
  commission: number,      // Always positive (stored as absolute value)
  mae: number,             // Max Adverse Excursion (absolute value)
  mfe: number,             // Max Favorable Excursion (absolute value)
  duration: number,        // seconds (exitTime - entryTime), null if either missing
  note: string,            // Free-text note (editable in TradeDrawer)
  tags: string[],          // Setup tags (editable in TradeDrawer)

  // — Set manually in TradeDrawer after reviewing the trade —
  stopPrice: number|null,  // Stop price → used to compute R-multiple automatically
  executionScore: 1|2|3|4|5|null,
  mood: 'calm'|'focused'|'fomo'|'revenge'|'tired'|'stressed'|'',
  confidence: 'low'|'medium'|'high'|'',
  followedPlan: true|false|null,
  mistakeType: string,
}
```

## Data Model — Journal Entry

```js
{
  date: string,            // 'YYYY-MM-DD'
  // Pre-market
  bias: 'bullish'|'bearish'|'neutral'|'',
  keyLevels: string,       // key prices, catalysts, news
  plan: string,            // today's trading plan
  // Session state
  mood: string,            // same values as trade mood
  energy: 'good'|'tired'|'low'|'overloaded'|'',
  // Rules checklist
  rulesChecked: object,    // { [ruleId]: boolean }
  // Post-session
  note: string,            // freeform reflection
}
```

## Data Model — Trading Rules

```js
// tradingRules: Array stored in Zustand (global, not per-entry)
{ id: string, text: string, link?: string }
// e.g. { id: 'def-no-dca', text: 'Did not DCA', link: 'https://notion.so/...' }
```

**Default rules** — `DEFAULT_TRADING_RULES` in `tradeStore.js` defines 10 mistake-category items from the user's Notion playbook (Move stop, Move targets, Chase, Respect risk, Breaks, Over-trading, DCA, Process, Wrong risk, Copier errors). Each carries the original Notion URL in the `link` field, rendered as a small ↗ icon next to the rule text. All items are phrased positively ("Did not …", "Used correct …") so the existing "followed = good" compliance ratio remains semantically correct.

**Seeding** — Initial store state ships with `tradingRules: [...DEFAULT_TRADING_RULES]` and `defaultRulesSeeded: true`. For users with persisted state predating the defaults, the persist middleware's `onRehydrateStorage` hook seeds the defaults exactly once when `tradingRules.length === 0 && !defaultRulesSeeded`. Users who clear their rules after seeding stay empty — they can re-seed via the "↻ Load default mistake checklist" button visible in the empty-state Journal section, which calls `seedDefaultRules()` (idempotent: skips IDs already present).

**Screenshots are NOT stored in the trade object.** They live in IndexedDB keyed as `{tradeId}-context` and `{tradeId}-orderflow`.

**Duplicate detection** in `mergeUnique()` (tradeStore.js): key = `instrument|entryTime|profit`. Re-importing the same file won't add duplicates. Import result stored in `lastImportStats: { added, skipped }`.

---

## Zustand Store (`src/store/tradeStore.js`)

Key: `tj-v1` (localStorage via persist middleware).

| Field | Type | Description |
|---|---|---|
| `trades` | Trade[] | All imported trades |
| `periodFilter` | string | `all/today/week/month/3m/ytd` |
| `sessionOffset` | number | Hours to subtract from local time to reach ET (0=ET default) |
| `dailyLossLimit` | number\|null | Daily loss limit in $ |
| `lastImportStats` | object\|null | `{ added, skipped }` from last import |
| `journalEntries` | JournalEntry[] | Sorted descending by date |
| `tradingRules` | Rule[] | Global user-defined trading rules |

---

## Screenshots — IndexedDB (`src/services/imageStore.js`)

- `saveImage(key, dataUrl)` — stores a base64 JPEG under `key`
- `loadImage(key)` — returns the data URL or `null`
- `deleteImage(key)` — removes one key
- `deleteTradeImages(tradeId)` — removes both `{tradeId}-context` and `{tradeId}-orderflow`
- `compressImage(file, maxWidth=1400, quality=0.82)` — resizes via canvas → JPEG (~150–300KB per image)

**Keys:** `{tradeId}-context` and `{tradeId}-orderflow`

---

## TradeDrawer — Two Layout Modes

**Narrow mode** (no screenshots): 420px right panel. Upload slots at the bottom of the form.

**Wide mode** (any screenshot loaded): full-screen `fixed inset-0`, 3 columns: context | orderflow | trade details (400px).

`wideMode = imagesReady && !!(screenshots.context || screenshots.orderflow)`

`imagesReady` is set after the `useEffect` resolves both `loadImage` calls — prevents layout flash.

---

## Engine Functions (`src/engine/metrics.js`)

All pure — take an array of trades, return computed data.

| Function | Returns |
|---|---|
| `filterByPeriod(trades, period)` | Filtered array |
| `computeMetrics(trades)` | KPI object (see below) |
| `computeEquityCurve(trades)` | `[{ i, date, value, profit }]` |
| `computeMonthly(trades)` | `[{ label, pnl }]` |
| `computeDow(trades)` | `[{ label, count, pnl, ...metrics }]` — 7 days |
| `computeHourly(trades)` | `[{ label, pnl, count }]` — hours 06–20 |
| `computeDist(trades)` | `[{ label, count, isWin }]` — 20-bucket histogram |
| `computeBySymbol(trades)` | `[{ sym, ...metrics }]` |
| `computeByTag(trades)` | `[{ tag, ...metrics }]` |
| `computeBySession(trades, offset)` | `[{ label, ...metrics }]` — 8 ET time blocks |
| `computeByMood(trades)` | `[{ mood, ...metrics }]` |
| `computeByConfidence(trades)` | `[{ confidence, ...metrics }]` |
| `computeByExecScore(trades)` | `[{ score, label, ...metrics }]` |
| `computeMAEMFE(trades)` | `{ avgCapture, captureBuckets, avgMaeRatio, avgLoserRatio, … }` |
| `computeRMultiples(trades)` | `{ avgR, avgWinR, avgLossR, distribution, … }` or `null` |
| `computeTradeR(trade)` | Single trade R-multiple or `null` |
| `computeDisciplineScore(trades)` | `{ score, ratedCount, totalTrades, components }` or `null` if <3 rated |
| `fmtPnL(v)` | `"+$1,234.56"` / `"-$567.89"` |
| `pnlColor(v)` | `"text-profit"` / `"text-loss"` / `"text-muted"` |
| `formatDuration(sec)` | `"4m 30s"` / `"1h 12m"` / `"—"` |
| `toDateStr(d)` | `"YYYY-MM-DD"` |

**Session time blocks** (24h ET — `computeBySession` offset param subtracts from local hours):
```
Pre-Market     h < 9.5
09:30–10:30    9.5  ≤ h < 10.5
10:30–11:30    10.5 ≤ h < 11.5
11:30–12:30    11.5 ≤ h < 12.5
12:30–13:30    12.5 ≤ h < 13.5
13:30–14:30    13.5 ≤ h < 14.5
14:30–16:00    14.5 ≤ h < 16
After Hours    h ≥ 16
```

All labels are 24h ET so afternoon sessions can't be misread as AM.

**Session offset autodetect** — `detectSessionOffset()` in `metrics.js` reads the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and computes hours between the user's local time and `America/New_York`. The store initializes `sessionOffset` from this on first load; `sessionOffsetAuto: true` flag tracks whether the user has overridden it. The Analytics tab shows the detected zone ("Auto-detected from your PC: Europe/Lisbon · ET offset +0h") with a "↻ Use auto-detected" button when the user has overridden the value.

**Session offset reference** (for data with explicit timezone markers):
- ET (no timezone in CSV, NT8 default) → offset = 0
- UK / Portugal winter (GMT) → offset = 5
- UK / Portugal summer (BST/WEST) → offset = 5
- Central Europe (France/Germany, CET/CEST) → offset = 6
- Eastern Europe → offset = 7

The Time Analysis tab shows a sample conversion hint: "a trade timestamped HH:MM in your data = 09:30–10:30 ET" so the user can verify their setting.

**Time display format** — All trade time displays use 24h (`hour12: false`) for consistency with the ET session blocks. Applied in Trades.jsx, Calendar.jsx, Journal.jsx, and reportGenerator.js.

---

## CSV Import — Column Auto-Detection (`src/engine/csvParser.js`)

`detectColumns(headers)` fuzzy-matches against known NT8 patterns. The column mapper UI lets you override any mapping before confirming.

**NT8 standard export path:** Control Center → New → Trade Performance → right-click grid → Export → To Excel (CSV)

**Import feedback:** The done screen shows `X new trades added · Y duplicates skipped · Z total in journal`. Duplicates detected by `instrument|entryTime|profit` key.

**Mapping persistence** — `Import.jsx` calls `headerSignature(headers)` (lowercase, sorted, joined with `|`) and looks it up in `state.csvMappings`. Same-signature CSVs recall the prior mapping; a banner shows "Mapping restored from a previous import with the same columns." The mapping is re-saved on import so subsequent edits stick. Recall is skipped if any saved column no longer exists in the new file (protects against partial renames).

---

## Pages

### Dashboard (`pages/Dashboard.jsx`)
- 10 KPI cards in a responsive 5-column grid
- Full-width equity curve (AreaChart)
- Monthly P&L bar chart + Win/Loss summary card
- Sessions bar chart, Day of Week, Hour of Day, P&L Distribution
- **Daily loss limit tracker** — inline editable $limit, progress bar turns amber at 70%, red at 100%

### Trade Log (`pages/Trades.jsx`)
- Filters: symbol search, side, win/loss, tag
- All columns sortable; 50 trades per page
- R column (if stopPrice set), Score column
- Click row → opens `TradeDrawer`
- Toolbar shows `Showing N of M trades · period: <label>` with an inline "clear" button when the topbar period filter is anything other than All Time — so the user knows when results are being narrowed by a non-local filter.

### Calendar (`pages/Calendar.jsx`)
- Month nav, daily P&L cells, click day → trade detail table
- Each day cell shows: net P&L, W/L split (e.g. `3W · 1L`)
- Monthly summary row

### Analytics (`pages/Analytics.jsx`)
Ten tabs:
1. **By Symbol** — bar chart + full stats table
2. **By Setup/Tag** — grouped by trade tags
3. **Time Analysis** — session time blocks + day of week; timezone offset dropdown (see offset guide above)
4. **Long vs Short** — side-by-side breakdown + comparison bar chart
5. **Psychology** — Discipline Score card + by mood + by execution score + Followed Plan vs Broke Rules
6. **Emotions** — by mood chart/table + by confidence chart/table + best/worst trading state combos
7. **MAE/MFE** — MAE vs MFE scatter plot (wins green, losses red) + capture rate KPIs + entry cleanliness + stop placement
8. **R-Multiple** — KPI cards + distribution chart (empty state if no stopPrice)
9. **Patterns** — auto-detects best/worst time/day/setup; red-flags consistently losing groups
10. **Best & Worst** — top 5 winning and losing trades

### Journal (`pages/Journal.jsx`)
Three-column layout: entry list (left) | form (middle, 500px) | day's trades (right).

**Form sections:**
1. **Pre-Market Prep** — market bias (📈 Bullish / ↔ Neutral / 📉 Bearish), key levels/catalysts textarea, today's plan textarea
2. **Session State** — mood + energy selectors
3. **Rules Checklist** — global user-defined rules (add/delete inline); checkbox per rule per day; X/N followed counter; sidebar shows compliance ratio
4. **Post-Session Reflection** — freeform notes + click-to-insert prompts

Sidebar list shows: date, bias emoji, mood emoji, rules compliance (X/N).

### AI Report (`pages/Report.jsx`)
- Generates markdown performance report from current trade data
- Textarea preview + "Copy Report" button
- Period filter affects content

### Import (`pages/Import.jsx`)
Three-step flow: `drop → map → done`
- Drag & drop or click-to-browse CSV
- Column mapper with auto-detection + live preview
- Done screen: "X new · Y skipped · Z total"

---

## Topbar — Export CSV

`↓ Export` button downloads `tradelog-YYYY-MM-DD.csv` with all trade fields (notes, tags, mood, stopPrice, executionScore, followedPlan, mistakeType). Re-importable via the Import mapper.

Screenshots are NOT exported to CSV (IndexedDB only).

---

## Known Limitations / Next Things to Build

- **Stop price per instrument default** — currently set manually per trade; a default stop per instrument would auto-fill R-multiple
- **Trade note search** — search bar in Trade Log that also matches against notes text
- **Market conditions tag on journal** — single-click: Trending / Ranging / Choppy / News-driven (not yet built)
- **Streak tracker** — green/red day streaks visible on Calendar
- **Weekly recap** — a summary journal entry type that auto-pulls week metrics
- **NT8 live connection** — requires NinjaScript C# add-on; CSV import is the current workflow
- **PWA** — `vite-plugin-pwa` for offline/installable use

---

## Coding Standards

- Functional components only, no class components
- Zustand for global state; `useState` for UI-only state
- All engine functions in `src/engine/` are pure — no store imports
- Services in `src/services/` may have side effects (IndexedDB)
- Tailwind utility classes only — no component CSS files
- File names lowercase (Windows compatibility)
- No comments unless the WHY is non-obvious

---

## R-Multiple Sign Convention

`computeTradeR(trade)` in `metrics.js` uses `Math.abs(entry - stop)` for the stop distance and multiplies the price move by `dir` (+1 long / −1 short). A short with entry 100, stop 105, exit 90 correctly returns `+2R`. Without the side flip, shorts were getting opposite-signed R values and were misclassified as winners/losers in the R-multiple distribution.

---

*Version: 2.2 — Default mistake checklist (10 items from Notion playbook) seeded on first load with ↗ link icons to Notion explanations. `seedDefaultRules()` action + empty-state re-seed button. `addTradingRule(text, link)` now optionally stores a link.*

*Version: 2.1 — Timezone autodetect for session classifier (Intl.DateTimeFormat → ET offset). Session labels rewritten to 24h ET (no more AM/PM ambiguity). All trade-row time displays forced to 24h. Dashboard session chart now respects `sessionOffset`. R-multiple sign fixed for shorts. Calendar day cells show W/L split. Trade Log shows "Showing N of M · period: X" with clear button. CSV column mappings persist per header signature.*
