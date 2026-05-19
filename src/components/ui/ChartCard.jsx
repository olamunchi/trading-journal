export function ChartCard({ title, children, className = '', action }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}
