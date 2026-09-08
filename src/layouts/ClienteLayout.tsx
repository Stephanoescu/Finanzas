import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, LayoutDashboard, FileText, LogOut, User } from 'lucide-react';

const navItems = [
  { to: '/cliente', icon: LayoutDashboard, label: 'Mi Cuenta', end: true },
  { to: '/cliente/estado-cuenta', icon: FileText, label: 'Estado de Cuenta' },
];

export default function ClienteLayout() {
  const sesion = useAppStore((s) => s.sesion);
  const logout = useAppStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Mi Crédito</p>
            <p className="text-xs text-gray-500">Cuaderno Digital</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Cliente
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{sesion?.nombreCompleto}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="sidebar-item sidebar-item-inactive w-full"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

