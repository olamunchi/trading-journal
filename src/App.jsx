import { useState } from 'react'
import { Sidebar }   from './components/layout/Sidebar'
import { Topbar }    from './components/layout/Topbar'
import { Dashboard } from './pages/Dashboard'
import { Trades }    from './pages/Trades'
import { Calendar }  from './pages/Calendar'
import { Analytics } from './pages/Analytics'
import { Import }    from './pages/Import'
import { Report }    from './pages/Report'
import { Journal }   from './pages/Journal'

export default function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-slate-300">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar page={page} onNavigate={setPage} />
        <main className="flex-1 overflow-y-auto">
          {page === 'dashboard' && <Dashboard />}
          {page === 'trades'    && <Trades />}
          {page === 'calendar'  && <Calendar />}
          {page === 'analytics' && <Analytics />}
          {page === 'journal'   && <Journal />}
          {page === 'report'    && <Report />}
          {page === 'import'    && <Import onDone={() => setPage('dashboard')} />}
        </main>
      </div>
    </div>
  )
}
