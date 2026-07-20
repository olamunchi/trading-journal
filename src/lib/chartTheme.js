// Single source of truth for chart colors — must stay in sync with
// tailwind.config.js theme colors.
export const C = {
  profit: '#34d399',
  loss:   '#dc3d51',
  warn:   '#e8a33d',
  accent: '#7c5cfa',
  grid:   '#1e2337',
  axis:   '#5e6584',
  card:   '#161a2b',
  border: '#262b41',
}

export const TT = {
  contentStyle: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  },
  cursor: { stroke: C.border },
}

export const AX = { stroke: C.axis, fontSize: 11 }

export const pnlFill = v => (v >= 0 ? C.profit : C.loss)
