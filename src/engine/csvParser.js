const PATTERNS = {
  instrument: ['instrument', 'symbol', 'market', 'ticker', 'contract', 'asset'],
  side: ['market pos.', 'market pos', 'side', 'action', 'direction', 'type', 'position'],
  qty: ['qty', 'quantity', 'contracts', 'shares', 'size', 'volume'],
  entryTime: ['entry time', 'entry date', 'open time', 'date/time', 'datetime', 'time', 'date'],
  exitTime: ['exit time', 'close time', 'exit date'],
  entryPrice: ['entry price', 'avg entry price', 'avg. entry price', 'open price', 'avg entry'],
  exitPrice: ['exit price', 'avg exit price', 'avg. exit price', 'close price', 'avg exit'],
  profit: ['profit', 'p&l', 'pnl', 'net p&l', 'net profit', 'gain/loss', 'gain', 'realized p&l', 'realized pnl'],
  commission: ['commission', 'fees', 'comm', 'fee', 'total commission'],
  mae: ['mae'],
  mfe: ['mfe'],
}

export const FIELD_LABELS = {
  instrument: 'Symbol / Instrument *',
  side: 'Side (Long/Short) *',
  qty: 'Quantity',
  entryTime: 'Entry Time *',
  exitTime: 'Exit Time',
  entryPrice: 'Entry Price',
  exitPrice: 'Exit Price',
  profit: 'Profit / P&L *',
  commission: 'Commission',
  mae: 'MAE',
  mfe: 'MFE',
}

export function detectColumns(headers) {
  const lower = headers.map(h => h.toLowerCase().trim())
  const result = {}
  for (const [key, patterns] of Object.entries(PATTERNS)) {
    for (const p of patterns) {
      const idx = lower.findIndex(h => h === p || h.includes(p))
      if (idx >= 0) { result[key] = headers[idx]; break }
    }
    if (!result[key]) result[key] = ''
  }
  return result
}

function parseNum(str) {
  if (str === undefined || str === null || str === '') return 0
  return parseFloat(String(str).replace(/[$,%\s]/g, '').replace(/,/g, '')) || 0
}

function parseSide(str) {
  if (!str) return ''
  const s = str.toLowerCase()
  if (s.includes('long') || s.startsWith('buy')) return 'long'
  if (s.includes('short') || s.startsWith('sell')) return 'short'
  return s
}

function parseDate(str) {
  if (!str || !String(str).trim()) return null
  const d = new Date(str)
  return isNaN(d) ? null : d.toISOString()
}

export function normalizeTrades(rows, mapping) {
  return rows.map((row, i) => {
    const profit = parseNum(row[mapping.profit])
    const commission = Math.abs(parseNum(row[mapping.commission]))
    const entryTime = parseDate(row[mapping.entryTime])
    const exitTime = parseDate(row[mapping.exitTime])
    const duration = entryTime && exitTime
      ? Math.round((new Date(exitTime) - new Date(entryTime)) / 1000)
      : null
    return {
      id: `${Date.now()}-${i}`,
      instrument: (row[mapping.instrument] || 'Unknown').trim(),
      side: parseSide(row[mapping.side]),
      qty: parseNum(row[mapping.qty]),
      entryTime,
      exitTime,
      entryPrice: parseNum(row[mapping.entryPrice]),
      exitPrice: parseNum(row[mapping.exitPrice]),
      profit,
      commission,
      mae: Math.abs(parseNum(row[mapping.mae])),
      mfe: Math.abs(parseNum(row[mapping.mfe])),
      duration,
      note: '',
      tags: [],
    }
  }).filter(t => t.profit !== 0 || t.entryTime)
}
