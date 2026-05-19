export function KpiCard({ label, value, sub, valueClass = '' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-muted uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-subtle mt-1">{sub}</div>}
    </div>
  )
}
