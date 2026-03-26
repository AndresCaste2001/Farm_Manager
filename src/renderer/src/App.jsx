import { useState } from 'react'
import Lotes from './components/Lotes'
import Ventas from './components/Ventas'
import Pagos from './components/Pagos'
import Reportes from './components/Reportes'

const NAV = [
  {
    id: 'lotes',
    label: 'Lotes',
    desc: 'Gestiona tus lotes de cerdos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )
  },
  {
    id: 'ventas',
    label: 'Ventas',
    desc: 'Registro de ventas por peso',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    )
  },
  {
    id: 'pagos',
    label: 'Pagos',
    desc: 'Control de gastos y facturas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    )
  },
  {
    id: 'reportes',
    label: 'Reportes',
    desc: 'Resumen financiero y exportar PDF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )
  }
]

const PAGES = { lotes: Lotes, ventas: Ventas, pagos: Pagos, reportes: Reportes }

export default function App() {
  const [activePage, setActivePage] = useState('lotes')
  const PageComponent = PAGES[activePage]
  const activeNav = NAV.find((n) => n.id === activePage)

  return (
    <div className="flex h-screen bg-[#06080f] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] flex flex-col border-r border-white/[0.06] shrink-0">
        {/* Brand mark — drag zone */}
        <div className="drag px-5 pt-6 pb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-white">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => {
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-default ${
                  isActive
                    ? 'bg-white/[0.06] text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                <span className={`transition-colors duration-150 ${isActive ? 'text-emerald-400' : ''}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-slate-700">v1.0.0</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#080b13]">
        {/* Header — drag zone */}
        <header className="drag px-8 py-6 shrink-0">
          <h1 className="text-lg font-semibold text-white tracking-tight">{activeNav?.label}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{activeNav?.desc}</p>
        </header>

        {/* Content */}
        <div key={activePage} className="flex-1 overflow-auto px-8 pb-8 page-enter">
          <PageComponent />
        </div>
      </main>
    </div>
  )
}
