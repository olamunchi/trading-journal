import {
  LayoutDashboard, ClipboardList, CalendarDays, BarChart3,
  NotebookPen, FileText, Upload, TrendingUp,
} from 'lucide-react'

// Ordered by workflow frequency, not feature type: Dashboard (check-in) →
// Journal (the daily ritual — pre-market plan, post-session review) →
// Trade Log (raw record, referenced often) → Calendar (weekly/monthly
// review) → Analytics (periodic deep-dive) → AI Report (occasional export)
// → Import (setup/maintenance, rarely touched once live sync is running).
const NAV = [
  { id: 'dashboard', Icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'journal',   Icon: NotebookPen,     label: 'Journal' },
  { id: 'trades',    Icon: ClipboardList,   label: 'Trade Log' },
  { id: 'calendar',  Icon: CalendarDays,    label: 'Calendar' },
  { id: 'analytics', Icon: BarChart3,       label: 'Analytics' },
  { id: 'report',    Icon: FileText,        label: 'AI Report' },
  { id: 'import',    Icon: Upload,          label: 'Import CSV' },
]

export function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="w-52 bg-surface border-r border-border flex flex-col flex-shrink-0">
      <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-[#5236c9] flex items-center justify-center flex-shrink-0">
          <TrendingUp size={17} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-slate-100 font-bold text-[15px] tracking-tight leading-none">TradeLog</div>
          <div className="text-subtle text-[11px] mt-1 leading-none">NT8 Journal</div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg text-left transition-all ${
              currentPage === id
                ? 'bg-accent/15 text-slate-100 font-medium'
                : 'text-muted hover:text-slate-300 hover:bg-white/[0.03]'
            }`}
          >
            <Icon size={17} strokeWidth={2} className={currentPage === id ? 'text-accent' : ''} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-border">
        <div className="text-xs text-subtle">v2.0 · NT8 Journal</div>
      </div>
    </aside>
  )
}
