import { Outlet, NavLink } from 'react-router-dom';
import { Home, Search, Network, BookMarked, Settings } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: 'Timeline' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/graph', icon: Network, label: 'Graph' },
  { to: '/read-later', icon: BookMarked, label: 'Read Later' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-dark-900 border-b border-dark-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-400">Recall</h1>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                  )
                }
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-900 border-t border-dark-800 px-2 py-2 safe-area-pb">
        <div className="flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary-400'
                    : 'text-dark-500 hover:text-dark-300'
                )
              }
            >
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
