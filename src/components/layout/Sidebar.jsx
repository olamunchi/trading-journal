const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'trades',    icon: '📋', label: 'Trade Log' },
  { id: 'calendar',  icon: '📅', label: 'Calendar' },
  { id: 'analytics', icon: '🔬', label: 'Analytics' },
  { id: 'report',    icon: '📄', label: 'AI Report' },
  { id: 'import',    icon: '⬆',  label: 'Import CSV' },
]

export function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="w-52 bg-surface border-r border-border flex flex-col flex-shrink-0">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-accent font-bold text-lg tracking-tight">TradeLog</div>
        <div className="text-muted text-xs mt-0.5">NT8 Journal</div>
      </div>

      <nav className="flex-1 py-2">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-l-2 transition-all ${
              currentPage === item.id
                ? 'border-accent text-accent bg-accent/10'
                : 'border-transparent text-muted hover:text-slate-300 hover:bg-white/[0.03]'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-border">
        <div className="text-xs text-subtle">v1.0 · NT8 Journal</div>
      </div>
    </aside>
  )
}
