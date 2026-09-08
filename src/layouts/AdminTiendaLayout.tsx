import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useAppData } from '../store/useAppStore';
import {
  BookOpen, LayoutDashboard, Users, Package,
  ShoppingCart, FileText, LogOut, Store
} from 'lucide-react';
import TimeTravelBar from '../components/TimeTravelBar';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/productos', icon: Package, label: 'Productos' },
  { to: '/admin/punto-venta', icon: ShoppingCart, label: 'Punto de Venta' },
  { to: '/admin/estado-cuenta', icon: FileText, label: 'Estado de Cuenta' },
];

export default function AdminTiendaLayout() {
  const sesion = useAppStore((s) => s.sesion);
  const logout = useAppStore((s) => s.logout);
  const navigate = useNavigate();
  const datos = useAppData();

  const tienda = datos.tiendas.find((t) => t.id === sesion?.tiendaId);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo + Tienda */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">
              {tienda?.nombre ?? 'Mi Tienda'}
            </p>
            <p className="text-xs text-gray-500">{tienda?.giro ?? 'Comercio'}</p>
          </div>
        </div>

        {/* Rol badge */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Admin Tienda
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {sesion?.nombreCompleto}
          </p>
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

