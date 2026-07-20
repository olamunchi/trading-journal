const SIZES = {
  lg: { pad: 'p-5', value: 'text-[28px] leading-8', label: 'text-xs' },
  md: { pad: 'p-4', value: 'text-[22px] leading-7', label: 'text-[11px]' },
  sm: { pad: 'p-3', value: 'text-base leading-5', label: 'text-[10px]' },
}

export function KpiCard({ label, value, sub, valueClass = '', icon = null, size = 'md' }) {
  const s = SIZES[size]
  return (
    <div className={`bg-card border border-border rounded-xl ${s.pad} shadow-card hover:border-subtle/60 transition-colors`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`${s.label} font-medium text-muted uppercase tracking-wider`}>{label}</div>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <div className={`${s.value} font-bold ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-subtle mt-1">{sub}</div>}
    </div>
  )
}
