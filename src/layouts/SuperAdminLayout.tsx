import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { BookOpen, LayoutDashboard, Store, LogOut, Shield } from 'lucide-react';
import TimeTravelBar from '../components/TimeTravelBar';

const navItems = [
  { to: '/superadmin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/superadmin/tiendas', icon: Store, label: 'Tiendas' },
];

export default function SuperAdminLayout() {
  const logout = useAppStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">CDC</p>
            <p className="text-xs text-gray-500">Cuaderno de Créditos</p>
          </div>
        </div>

        {/* Rol badge */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Super Admin
            </span>
          </div>
        </div>

        {/* Nav */}
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

        {/* Logout */}
        <div className="p-3 border-t border-gray-200">
          <button onClick={handleLogout} className="sidebar-item sidebar-item-inactive w-full">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TimeTravelBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

