import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Tailor', icon: '✨' },
  { to: '/history', label: 'History', icon: '📋' },
  { to: '/resume', label: 'Resume', icon: '📄' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-2xl mx-auto flex">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
