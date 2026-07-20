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
| Icons | lucide-react (no emoji in UI chrome; mood emojis in Journal/TradeDrawer are intentional) |
| Font | Inter Variable via `@fontsource-variable/inter` (imported in `index.css`, `tabular-nums` on body) |

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

Rich-dark navy + violet theme (TradeZella-inspired), introduced July 2026.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0b0d16` | Page background |
| `surface` | `#10131f` | Sidebar, topbar |
| `card` | `#161a2b` | All cards and panels |
| `border` | `#262b41` | All borders |
| `profit` | `#34d399` | Wins, green values |
| `loss` | `#dc3d51` | Losses, red values |
| `warn` | `#e8a33d` | Commissions, warnings |
| `accent` | `#7c5cfa` | Active nav, buttons, focus rings |
| `accentHover` | `#8f73ff` | Hover state for accent buttons/links |
| `muted` | `#8b93b0` | Secondary labels |
| `subtle` | `#5e6584` | Tertiary / placeholder text |

**Chart colors live in `src/lib/chartTheme.js`** (`C`, `TT` tooltip style, `AX` axis style, `pnlFill`) and MUST stay in sync with the Tailwind tokens. Calendar day-cell tints hardcode the profit/loss rgb values in `PROFIT_RGB`/`LOSS_RGB` constants — update those too if the palette changes. The profit/loss pair was CVD-validated (deutan ΔE 16.3 on dark surface); the light-green/deep-red lightness gap is deliberate — keep it if re-tinting.

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

## Data Model — Weekly Recap Entry

```js
{
  weekStart: string,   // 'YYYY-MM-DD' — the Sunday of the week (Sunday-start, matches Calendar's grid)
  wentWell: string,    // freeform
  toImprove: string,   // freeform
  focusNext: string,   // freeform — one or two things to focus on next week
}
```

Stored separately from daily `journalEntries` (own array, own key). All quantitative content (net P&L, win rate, rule adherence, best/worst day, days-journaled count) is **computed live from `trades` + `journalEntries` every render, never stored** — so a recap can't drift out of sync with the underlying trade data the way a hand-copied number could.

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
| `periodFilter` | string | `all/today/week/month/3m/ytd/custom` |
| `customRange` | object\|null | `{ from, to }` (YYYY-MM-DD) — active when `periodFilter === 'custom'`; set via Topbar popover |
| `sessionOffset` | number | Hours to subtract from local time to reach ET (0=ET default) |
| `dailyLossLimit` | number\|null | Daily loss limit in $ |
| `lastImportStats` | object\|null | `{ added, skipped }` from last import |
| `journalEntries` | JournalEntry[] | Sorted descending by date |
| `weeklyEntries` | WeeklyEntry[] | Sorted descending by `weekStart`; actions `saveWeeklyEntry(weekStart, data)` / `deleteWeeklyEntry(weekStart)` |
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
| `filterByPeriod(trades, period, range?)` | Filtered array — `range` is `{from,to}` used when `period === 'custom'` |
| `computeMetrics(trades)` | KPI object (see below) |
| `computeEquityCurve(trades)` | `[{ i, date, value, profit }]` (per trade — legacy, no longer used by Dashboard) |
| `computeDailyEquity(trades)` | `[{ date: 'MM/DD', full: 'YYYY-MM-DD', pnl, value }]` — cumulative by calendar day |
| `computeDayStreak(trades)` | `{ green, red, lastDay }` — current green/red streak in trading days |
| `computeRuleAdherence(trades)` | `{ rate, ratedCount }` or `null` — % of `followedPlan`-rated trades actually followed |
| `getWeekStart(date)` | `'YYYY-MM-DD'` of the Sunday of that week |
| `getWeekEnd(weekStart)` | `'YYYY-MM-DD'` of the following Saturday |
| `shiftWeek(weekStart, deltaWeeks)` | `'YYYY-MM-DD'` — weekStart shifted by N weeks (+/-) |
| `tradesInWeek(trades, weekStart)` | Trades whose `entryTime` falls within that Sun–Sat range |
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

**Three-tier hierarchy** (added July 2026, modeled on TradeZella's published dashboard structure — "Trading Dashboard: 8 KPIs That Actually Matter"): outcome metrics lead because they're scanned first, but process metrics predict future results better than outcome metrics, which is why they anchor the bottom tier instead of the top even though they matter just as much long-term. Each tier has a `TierLabel` (eyebrow + one-line "why this tier" caption) so the ordering logic is visible in the UI, not just in this doc.

- **Today panel** (above all tiers — this is "right now," not part of the period-based hierarchy below it): today's P&L, trade count, win rate, day streak (Flame icon), inline-editable daily loss limit tracker (amber at 70%, red at 100%)
- **Tier 1 — Outcome** ("is trading working right now"): 4 large KPI cards — Net P&L, Win Rate, Profit Factor, Max Drawdown (paired with *current* drawdown-from-peak, computed from `computeDailyEquity`'s peak vs. latest value — TradeZella pairs max DD with current DD so you can tell "worst ever" from "right now"). Equity curve (by calendar day) sits directly below as the trend companion.
- **Tier 2 — Patterns** ("what's driving the outcome"): Monthly P&L + Win/Loss donut (win-rate % in the center, with Avg Win/Avg Loss/Avg R:R/Gross P/Gross L/Current Streak tiles), Sessions, Day of Week, Hour of Day, P&L Distribution
- **Tier 3 — Process** ("predicts future results better than outcome does"): 6 small KPI cards — Trades, **Rule Adherence %** (new — `computeRuleAdherence` in metrics.js, % of `followedPlan`-rated trades actually followed), Expectancy, Commissions, Avg Duration, Best Streak

`KpiCard` now takes a `size` prop (`lg`/`md`/`sm`, default `md`) controlling type scale — used to make Tier 1 visually dominant and Tier 3 recede, reinforcing the hierarchy instead of just labeling it.

### Trade Log (`pages/Trades.jsx`)
- Filters: symbol search, side, win/loss, tag
- All columns sortable; 50 trades per page
- R column (if stopPrice set), Score column
- Click row → opens `TradeDrawer`
- Toolbar shows `Showing N of M trades · period: <label>` with an inline "clear" button when the topbar period filter is anything other than All Time — so the user knows when results are being narrowed by a non-local filter.

### Calendar (`pages/Calendar.jsx`)
- Month nav, daily P&L cells (min-height 76px), click day → trade detail table
- Each day cell shows: day number, net P&L, trade count + W/L split
- **Weekly total column** on the right of each week row (P&L, trades, active days)
- Monthly summary row: month P&L, trades, trading days, green days, **current day streak** (Flame icon)

### Analytics (`pages/Analytics.jsx`)
Six tabs (underline-style tab bar; regrouped from the former 10 tabs in July 2026 — the old Psychology/Emotions duplication was merged). **Tab order is conclusion-first**: Overview (synthesized findings) leads, then supporting breakdowns — the way a report states findings before its data, not after. It's also the default tab on load (`useState('highlights')`).
1. **Overview** (tab id stays `highlights` in code) — best/worst time/day/setup pattern cards + red-flag list + top 5 best/worst trades
2. **Setups** — by Setup/Tag (first) + by Symbol, each with bar chart + full stats table
3. **Time** — timezone offset selector + session time blocks + day of week
4. **Direction** — Long vs Short breakdown + comparison bar chart
5. **Psychology** — Discipline Score card + by mood + by confidence (each chart + expectancy table) + by execution score + Followed Plan vs Broke Rules + best/worst mood×confidence state combos
6. **Risk** — MAE/MFE section (scatter, capture-rate KPIs, exit quality, entry cleanliness/stop placement) + R-Multiple section (KPI cards + distribution)

### Journal (`pages/Journal.jsx`)
Three-column layout: entry list (left) | form (middle, 440–520px) | trades (right). A **Daily / Weekly mode toggle** at the top of the left column switches all three columns between the two entry types below; `mode` is local UI state (`useState`), not persisted.

**Daily mode — form sections:**
1. **Pre-Market Prep** — market bias (Bullish / Neutral / Bearish, lucide TrendingUp/MoveHorizontal/TrendingDown icons), key levels/catalysts textarea, today's plan textarea
2. **Session State** — mood + energy selectors
3. **Rules Checklist** — global user-defined rules (add/delete inline); checkbox per rule per day; X/N followed counter; sidebar shows compliance ratio
4. **Post-Session Reflection** — freeform notes + click-to-insert prompts

Sidebar list shows: date, bias icon, mood emoji, rules compliance (X/N).

**Weekly mode** (added July 2026) — one recap per Sunday-start week (`getWeekStart` in metrics.js), navigated with Prev/Next arrows (`shiftWeek`); Next is disabled once it would go past the current week.
- **"This Week, Automatically"** — live-computed stat tiles (never stored): Net P&L, Trades, Win Rate, Rule Adherence % (`computeRuleAdherence`), Best Day, Worst Day, plus a "Days journaled X/7" counter (from `journalEntries` within the week range) that nudges toward actually filling in the daily side.
- **"Day by Day"** — Sun–Sat row list with per-day P&L and a dot marking days with a journal entry; clicking a (non-future) day jumps straight to it in Daily mode (`jumpToDay`).
- **Reflection** — three freeform textareas: What Went Well / What To Improve / Focus For Next Week (the `weeklyEntries` fields).
- Right column mirrors the daily trades panel, scoped to the week's trades (`tradesInWeek`) instead of one day's.

Sidebar list (weekly mode) shows: week date range, net P&L for that week, and the "Focus For Next Week" text as a preview line.

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

## Topbar

- **Segmented period control** (Today / Week / Month / 3M / YTD / All) replaces the old dropdown
- **Custom date-range popover** (CalendarRange icon button): two date inputs + Apply → sets `customRange` in the store and `periodFilter: 'custom'`; the X inside the active button clears it back to All
- Export CSV + Import buttons (lucide icons)

`Export` button downloads `tradelog-YYYY-MM-DD.csv` with all trade fields (notes, tags, mood, stopPrice, executionScore, followedPlan, mistakeType). Re-importable via the Import mapper.

Screenshots are NOT exported to CSV (IndexedDB only).

---

## NT8 Live Sync

Trades executed in MADSnowball appear in the journal automatically on position close. No CSV export needed.

### Architecture

```
NinjaTrader 8 (local Windows)
  └─ MADSnowball.cs → OnPositionUpdate (position goes flat)
       └─ HTTP POST  →  https://<journal>.vercel.app/api/trades
                              │  validates X-NT8-Secret header
                              │  writes to Supabase
                              ▼
                        Supabase (PostgreSQL)
                              │
                              ▼
                        React journal (mirrors Supabase on load; one-click delete writes back)
```

**Status: LIVE — tested in Sim (June 2026).** Production: `https://trading-journal-phi-one.vercel.app`. Supabase project ref: `albgewupfypuxupcwznk`.

### Component 1 — NT8 NinjaScript (MADSnowball.cs)

Add to existing strategy — no separate AddOn needed.

**Trigger**: `OnPositionUpdate` when `position.MarketPosition == MarketPosition.Flat`. At that point `SystemPerformance.AllTrades` contains the completed trade.

**As built** (in `Strategies\MAD\MADSnowball.cs`, property group "06. Journal Sync"):
- `Task.Run` + `System.Net.HttpWebRequest` (deliberately **not** `HttpClient` — avoids an NT8 assembly-reference dependency). Fire-and-forget, never blocks `OnPositionUpdate`. Forces `ServicePointManager.SecurityProtocol = Tls12`.
- Props: `JournalSyncEnabled` (bool, default true — flip to false to test without sending), `JournalWebhookUrl` (defaults to prod), `JournalWebhookSecret` (pasted once in the strategy panel). URL + secret are `.Trim()`-ed before use (a stray space caused a 401 during setup).
- Guard: `if (State == State.Realtime)` only — backtests never send; Sim/live do.
- **Aggregates the whole position**: `PostTradeToJournal(entryCnt)` sums every fill whose entry-order name is `MADEntry{cnt}` or `MADAdd{cnt}_*` (from `SystemPerformance.AllTrades`) into ONE row — total qty, qty-weighted avg entry/exit, summed pnl + commission. Side from `madDir`. So base + snowball adds = one journal row, not several.
- Times sent as **naive NT8 wall-clock** (`yyyy-MM-ddTHH:mm:ss`, no Z) — confirmed displaying correctly in the journal.

**Payload** (JSON POST body — field names match the journal's trade object):
```json
{
  "instrument": "NQ 09-25",
  "side": "long",
  "qty": 2,
  "entryPrice": 21500.25,
  "exitPrice": 21585.50,
  "entryTime": "2026-06-02T14:35:00Z",
  "exitTime": "2026-06-02T15:10:00Z",
  "profit": 1700.00,
  "commission": 8.00,
  "strategyName": "MADSnowball",
  "account": "Sim101"
}
```

### Component 2 — Vercel API Route (`api/trades.js`)

Lives at repo root (not inside `src/`). Vercel routes `/api/trades` here automatically.

1. Validate `X-NT8-Secret` header against `process.env.NT8_WEBHOOK_SECRET`
2. Validate required fields (instrument, side, entryPrice, exitPrice, entryTime, exitTime, profit)
3. Generate deterministic `id` = `nt8-${entryMs}-${exitMs}` and **upsert** with `ignoreDuplicates` — a re-sent fill can't create a duplicate row
4. Insert into Supabase `trades` table using the service role key
5. Return `{ id }` on 200, error + status on failure

**Dependency**: `npm install @supabase/supabase-js`

**Vercel environment variables** (never committed — set in Vercel dashboard):
```
NT8_WEBHOOK_SECRET=<random 32-char hex>   # must match NT8 strategy property
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>   # NOT anon key — bypasses RLS
```

### Component 3 — Frontend (`src/store/tradeStore.js`, `src/lib/supabase.js`)

- `src/lib/supabase.js` — singleton client using the **anon/publishable key** (public, safe to ship). `fetchTrades()` returns `null` (not `[]`) when no backend / on error, so a transient failure never wipes the local cache. `rowToTrade()` maps DB rows → the in-app Trade shape with `source: 'nt8'`. `deleteTradeRemote(id)` deletes a row.
- `syncFromBackend()` runs once on load (`App.jsx` useEffect). It **reconciles**: Supabase is the source of truth for `source:'nt8'` trades — local nt8 trades are dropped and replaced by the current backend set (so a trade deleted in Supabase disappears here too), while local-only trades (CSV imports, manual) are kept. Dedupe via existing `mergeUnique()`.
- `deleteTrade(id)` (the trash button in `TradeDrawer`) also calls `deleteTradeRemote(id)`, so deletes hit Supabase and **stick** instead of being re-synced back on the next load.
- localStorage still holds journal entries, session gate, Spielfeld, rules, and CSV/manual trades. Notes / setup-quality fields on nt8 trades are **not yet** written back to Supabase (future work).

**Frontend environment variables** (`.env.local` locally + Vercel dashboard for prod):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/public key>
```

### Database schema (Supabase)

```sql
create table trades (
  id             text primary key,          -- same format as store: "${ms}-nt8"
  created_at     timestamptz default now(),

  -- matches the journal Trade object exactly
  instrument     text not null,
  side           text not null check (side in ('long','short')),
  qty            int not null,
  entry_price    numeric not null,
  exit_price     numeric not null,
  entry_time     timestamptz not null,
  exit_time      timestamptz not null,
  profit         numeric not null,
  commission     numeric default 0,
  mae            numeric,
  mfe            numeric,
  strategy_name  text,
  account        text,

  -- filled later by user in the journal (nullable)
  note           text,
  tags           text[],
  stop_price     numeric,
  execution_score int,
  mood           text,
  confidence     text,
  followed_plan  boolean,
  mistake_type   text,
  denisenko      jsonb
);

alter table trades enable row level security;
create policy "anon read"   on trades for select using (true);
create policy "anon delete" on trades for delete using (true);  -- one-click delete from the journal (personal app; insert still server-only via service key)
-- Inserts/updates only via the service key from Vercel, never from the browser
```

### Future / optional

- Supabase **realtime** subscription so a filled trade appears without a manual refresh
- Write journal **notes / setup-quality** fields back to Supabase (currently local-only, lost on reconcile if ever set on an nt8 trade)
- **Lock down delete** (password / Supabase auth) if the site ever becomes public — today it uses an open anon-delete policy, fine for a private personal journal

---

## Known Limitations / Next Things to Build

- **Stop price per instrument default** — currently set manually per trade; a default stop per instrument would auto-fill R-multiple
- **Trade note search** — search bar in Trade Log that also matches against notes text
- **Market conditions tag on journal** — single-click: Trending / Ranging / Choppy / News-driven (not yet built)
- **Streak tracker** — green/red day streaks visible on Calendar
- **PWA** — `vite-plugin-pwa` for offline/installable use
- **AI Report doesn't include Journal data** — `reportGenerator.js` is 100% trade-derived; pre-market plan/notes and per-rule compliance from the Journal never appear in the report, even though they're the "why" behind the numbers already in it

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

*Version: 3.2 — Weekly recap (July 2026): new `weeklyEntries` store array (Sunday-start weeks) + Journal page Daily/Weekly mode toggle. Weekly form auto-computes Net P&L, Win Rate, Rule Adherence %, Best/Worst Day, and a Days-Journaled counter live from trades + daily entries (nothing quantitative is stored, so it can't drift). Three reflection fields (What Went Well / To Improve / Focus Next Week) are the only persisted weekly fields. New metrics.js helpers: `getWeekStart`, `getWeekEnd`, `shiftWeek`, `tradesInWeek`. No changes to daily journal or trade data — additive only.*

*Version: 3.1 — Information-hierarchy pass (July 2026), grounded in TradeZella's published dashboard structure and Edgewonk's widget conventions (researched, not guessed). Dashboard rebuilt into an Outcome → Patterns → Process 3-tier hierarchy with visible `TierLabel` captions explaining the "why" of the ordering; added current-drawdown-vs-peak and Rule Adherence % (`computeRuleAdherence`, new in metrics.js). `KpiCard` gained a `size` prop (lg/md/sm) so tiers are visually, not just positionally, distinct. Sidebar nav reordered by workflow frequency (Journal moved to position 2, right after Dashboard). Analytics tab order flipped to conclusion-first (Overview/Highlights leads, is now the default tab). No data model or storage changes.*

*Version: 3.0 — Visual redesign (July 2026): rich-dark navy/violet palette (CVD-validated profit/loss pair), Inter Variable font + tabular numerals, lucide-react icons replacing all emoji UI chrome (mood emojis kept intentionally), shared chart theme in `src/lib/chartTheme.js`. Analytics regrouped 10 tabs → 6 (Psychology/Emotions merge removed a duplicated mood chart). Calendar: weekly total column + bigger day cells + day-streak card. Dashboard: Today panel (P&L/trades/WR/streak + loss limit), day-based equity curve, win/loss donut. Topbar: segmented period pills + custom date range (`customRange` store field, `filterByPeriod` third param). All data models and storage keys unchanged — no migration needed.*

*Version: 2.3 — NT8 live sync LIVE (Supabase + Vercel). `MADSnowball.cs` posts each closed position (aggregated base+adds) to `api/trades.js` → Supabase; journal `syncFromBackend` reconciles (Supabase = source of truth for `source:'nt8'` trades), and the trash button deletes from Supabase too (`deleteTradeRemote` + `anon delete` RLS policy). `fetchTrades` returns null on no-backend/error to protect the local cache.*

*Version: 2.2 — Default mistake checklist (10 items from Notion playbook) seeded on first load with ↗ link icons to Notion explanations. `seedDefaultRules()` action + empty-state re-seed button. `addTradingRule(text, link)` now optionally stores a link.*

*Version: 2.1 — Timezone autodetect for session classifier (Intl.DateTimeFormat → ET offset). Session labels rewritten to 24h ET (no more AM/PM ambiguity). All trade-row time displays forced to 24h. Dashboard session chart now respects `sessionOffset`. R-multiple sign fixed for shorts. Calendar day cells show W/L split. Trade Log shows "Showing N of M · period: X" with clear button. CSV column mappings persist per header signature.*
