# TradeLog — NT8 Trading Journal

A local-first trading journal built with Vite + React. No backend, no accounts — all data lives in `localStorage` (trade data) and IndexedDB (screenshots). Designed to import CSV exports from NinjaTrader 8 and provide full performance analytics.

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
- **Live URL:** check Vercel dashboard → project → Domains for the stable production URL (each push generates a new immutable deployment URL; the production alias auto-updates)
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
│   └── tradeStore.js              # Zustand store — all trade CRUD + periodFilter
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
    ├── Dashboard.jsx              # KPIs + equity curve + all charts
    ├── Trades.jsx                 # Filterable/sortable trade table
    ├── Calendar.jsx               # Monthly P&L heatmap
    ├── Analytics.jsx              # 9-tab analytics view
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
                           // R = (exitPrice - entryPrice) / (entryPrice - stopPrice)
                           // Works for both longs and shorts (qty/point-value cancel out)
  executionScore: 1|2|3|4|5|null, // 1=Poor, 2=Below Avg, 3=Neutral, 4=Good, 5=Perfect
  mood: 'calm'|'focused'|'fomo'|'revenge'|'tired'|'stressed'|'',
  confidence: 'low'|'medium'|'high'|'',
  followedPlan: true|false|null,
  mistakeType: string,     // e.g. 'FOMO Entry', 'Moved Stop', 'Cut Winner', etc.
}
```

**Screenshots are NOT stored in the trade object.** They live in IndexedDB keyed as `{tradeId}-context` and `{tradeId}-orderflow`. The trade object has no screenshot fields — presence is determined at runtime by querying IndexedDB.

**Duplicate detection** in `mergeUnique()` (tradeStore.js): key = `instrument|entryTime|profit`. Re-importing the same file won't add duplicates.

---

## Screenshots — IndexedDB (`src/services/imageStore.js`)

localStorage is capped at ~5MB total — not viable for chart images. Screenshots use IndexedDB (`tj-images-v1`, object store `screenshots`).

**API:**
- `saveImage(key, dataUrl)` — stores a base64 JPEG under `key`
- `loadImage(key)` — returns the data URL or `null`
- `deleteImage(key)` — removes one key
- `deleteTradeImages(tradeId)` — removes both `{tradeId}-context` and `{tradeId}-orderflow`
- `compressImage(file, maxWidth=1400, quality=0.82)` — resizes via canvas → JPEG (~150–300KB per image)

**Keys:** `{tradeId}-context` and `{tradeId}-orderflow`

Images are saved immediately on upload (not gated by the Save button). Deleting a trade also calls `deleteTradeImages`.

---

## TradeDrawer — Two Layout Modes

**Narrow mode** (no screenshots loaded): 420px right panel slides in. Shows upload slots at the bottom of the form.

**Wide mode** (at least one screenshot loaded): expands to full-screen 3-column layout:
- Left column: Context Chart image (or upload slot if empty)
- Middle column: Order Flow Entry image (or upload slot if empty)
- Right column (400px): all trade detail fields

Uploading the first screenshot auto-triggers wide mode. Removing both images collapses back to narrow. Clicking an image opens a full-screen lightbox. Remove button is visible at the top of each image column in wide mode.

`wideMode = imagesReady && !!(screenshots.context || screenshots.orderflow)`

`imagesReady` is set after the `useEffect` resolves both `loadImage` calls — prevents a layout flash while IndexedDB loads.

---

## Engine Functions (`src/engine/metrics.js`)

All pure — take an array of trades, return computed data. No store access.

| Function | Returns |
|---|---|
| `filterByPeriod(trades, period)` | Filtered array. Period: `all / today / week / month / 3m / ytd` |
| `computeMetrics(trades)` | Single object with all KPIs (see KPI list below) |
| `computeEquityCurve(trades)` | `[{ i, date, value, profit }]` sorted by entryTime |
| `computeMonthly(trades)` | `[{ label, pnl }]` grouped by month |
| `computeDow(trades)` | `[{ label, count, pnl, ...computeMetrics }]` — 7 days, avg P&L + full metrics per day |
| `computeHourly(trades)` | `[{ label, pnl, count }]` — hours 06:00–20:00 |
| `computeDist(trades)` | `[{ label, count, isWin }]` — 20-bucket P&L histogram |
| `computeBySymbol(trades)` | `[{ sym, ...metrics }]` sorted by netPnL desc |
| `computeByTag(trades)` | `[{ tag, ...metrics }]` — untagged trades go in "Untagged" |
| `computeBySession(trades)` | `[{ label, ...metrics }]` — 8 time blocks (Pre-Market / 9:30–10:30 / … / After Hours) |
| `computeByMood(trades)` | `[{ mood, ...metrics }]` grouped by `t.mood` |
| `computeByExecScore(trades)` | `[{ score, label, ...metrics }]` for scores 1–5 |
| `computeMAEMFE(trades)` | `{ avgCapture, captureBuckets, avgMaeRatio, avgLoserRatio, … }` |
| `computeRMultiples(trades)` | `{ avgR, avgWinR, avgLossR, distribution, … }` or `null` if no stopPrice set |
| `computeTradeR(trade)` | Single trade R-multiple as a number, or `null` if stopPrice not set |
| `fmtPnL(v)` | `"+$1,234.56"` or `"-$567.89"` |
| `pnlColor(v)` | `"text-profit"` / `"text-loss"` / `"text-muted"` Tailwind class |
| `formatDuration(sec)` | `"4m 30s"` / `"1h 12m"` / `"—"` — rounds to whole seconds |
| `toDateStr(d)` | `"YYYY-MM-DD"` from a Date object |

**`computeMetrics` returns:**
```js
{
  total, wins, losses,
  netPnL, grossProfit, grossLoss,
  winRate,          // 0–1
  profitFactor,     // Infinity when grossLoss === 0
  avgWin, avgLoss, expectancy,
  totalComm,
  maxDD,            // max drawdown in $
  maxW, maxL,       // max consecutive wins/losses
  curW, curL,       // current streak (only one will be > 0)
  avgDuration,      // seconds
}
```

**R-multiple formula:**
```js
// computeTradeR(trade) — works for both long and short
const stopDist = trade.entryPrice - trade.stopPrice  // positive for long, negative for short
return (trade.exitPrice - trade.entryPrice) / stopDist
// qty and point value cancel out — it's a pure price ratio
```

**Session time blocks (SESSIONS constant in metrics.js):**
```
Pre-Market   < 9:30
9:30–10:30   h >= 9.5  && h < 10.5
10:30–11:30  h >= 10.5 && h < 11.5
11:30–12:30  h >= 11.5 && h < 12.5
12:30–1:30   h >= 12.5 && h < 13.5
1:30–2:30    h >= 13.5 && h < 14.5
2:30–4:00    h >= 14.5 && h < 16
After Hours  h >= 16
```

---

## CSV Import — Column Auto-Detection (`src/engine/csvParser.js`)

`detectColumns(headers)` fuzzy-matches the CSV headers against known NT8 patterns:

| Field | Patterns it looks for |
|---|---|
| `instrument` | instrument, symbol, market, ticker, contract |
| `side` | market pos., market pos, side, action, direction |
| `qty` | qty, quantity, contracts, shares |
| `entryTime` | entry time, entry date, open time, date/time, time |
| `exitTime` | exit time, close time, exit date |
| `entryPrice` | entry price, avg entry price, avg. entry price |
| `exitPrice` | exit price, avg exit price, avg. exit price |
| `profit` | profit, p&l, pnl, net p&l, net profit, gain/loss |
| `commission` | commission, fees, comm, fee |
| `mae` | mae |
| `mfe` | mfe |

The column mapper UI lets you override any mapping before confirming the import.

**NT8 standard export path:** Control Center → New → Trade Performance → right-click grid → Export → To Excel (CSV)

---

## Pages

### Dashboard (`pages/Dashboard.jsx`)
- 10 KPI cards in a responsive 5-column grid
- Full-width equity curve (AreaChart)
- Monthly P&L bar chart (2/3 width) + Win/Loss summary card (1/3)
- Sessions bar chart (8 time blocks)
- Bottom row: Day of Week avg P&L, Hour of Day avg P&L, P&L Distribution

### Trade Log (`pages/Trades.jsx`)
- Filters: symbol search, side (long/short), win/loss, tag
- All columns sortable (click header — toggles asc/desc)
- 50 trades per page with pagination
- R column — shows R-multiple if `stopPrice` is set on trade
- Score column — execution score badge
- Click any row → opens `TradeDrawer`

### Calendar (`pages/Calendar.jsx`)
- Month nav (prev/next)
- Each day cell: date number + P&L total + trade count
- Cell background color intensity scales with P&L magnitude (green = profit, red = loss)
- Click a day → trade detail table appears below
- Monthly summary row: Month P&L, Total Trades, Trading Days, Green Days %

### Analytics (`pages/Analytics.jsx`)
Nine tabs:
1. **By Symbol** — bar chart + full stats table per instrument
2. **By Setup/Tag** — same layout grouped by trade tags (shows Avg Win + Avg Loss)
3. **Time Analysis** — two tables: (a) 8 hourly time blocks with full metrics; (b) Day of Week with full metrics
4. **Long vs Short** — side-by-side stat breakdown + comparison bar chart
5. **Psychology** — By mood chart/table, by execution score chart/table, Followed Plan vs Broke Rules
6. **MAE/MFE** — Capture rate KPIs + distribution chart + entry cleanliness + stop placement analysis
7. **R-Multiple** — KPI cards + distribution chart (empty state if no stopPrice set)
8. **Patterns** — auto-detects best/worst time block, day of week, setup; flags consistently losing periods (min 3 trades per group, win rate < 40% + negative P&L = red flag)
9. **Best & Worst** — top 5 winning and losing trades (shows R if stopPrice set)

### AI Report (`pages/Report.jsx`)
- Generates a full markdown performance report from all current trade data
- Textarea preview + character count
- "Copy Report" button (copies to clipboard, turns green with checkmark)
- 3-step instructions: copy → open claude.ai → paste
- Period filter affects report content
- Report ends with a suggested Claude prompt for trade coaching analysis

### Import (`pages/Import.jsx`)
Three-step flow: `drop → map → done`
- Drag & drop or click-to-browse
- PapaParse reads CSV with `header: true`
- Column mapper shows auto-detected mapping + editable dropdowns + live "e.g. X" preview
- "Import N Trades →" button normalizes and merges into store
- "Clear All Data" button in drop step (with confirmation)

---

## Topbar — Export CSV

The `↓ Export` button appears in the topbar when at least one trade is loaded.
It downloads `tradelog-YYYY-MM-DD.csv` containing all trade fields including notes, tags, mood, stopPrice, executionScore, followedPlan, mistakeType.
This file can be re-imported later — it will re-map columns via the Import mapper.

Note: screenshots are stored in IndexedDB and are NOT exported to CSV.

---

## Known Limitations / Next Things to Build

- **Stop price per instrument default** — currently set manually per trade; a default stop per instrument would auto-fill it
- **Import duplicate feedback** — mergeUnique silently skips duplicates; the done screen should show "X new + Y skipped"
- **NT8 live connection** — requires a NinjaScript C# add-on that POSTs to a local server or Supabase on trade close; CSV import is the current workflow
- **Daily log writing** — needed for analytics energy trends / recovery state
- **PWA** — `vite-plugin-pwa` for offline use

---

## Coding Standards

- Functional components only, no class components
- Zustand for global state; `useState` for UI-only state (filters, selected row, open drawer)
- All engine functions in `src/engine/` are pure — no store imports
- Services in `src/services/` may have side effects (IndexedDB, Drive API, etc.)
- Tailwind utility classes only — no `App.css` or component CSS files
- File names lowercase (Windows compatibility)
- No comments unless the WHY is non-obvious

---

*Version: 1.3 — Screenshots per trade via IndexedDB. TradeDrawer expands to full-screen 3-column layout when images are present (context chart | order flow | trade details). Narrow drawer retained when no images loaded.*
