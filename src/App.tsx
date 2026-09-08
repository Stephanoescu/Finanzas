import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';

// Layouts
import LoginPage from './pages/LoginPage';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import AdminTiendaLayout from './layouts/AdminTiendaLayout';
import ClienteLayout from './layouts/ClienteLayout';

// SuperAdmin pages
import SADashboard from './pages/superadmin/SADashboard';
import SATiendas from './pages/superadmin/SATiendas';

// Admin Tienda pages
import ATDashboard from './pages/admin/ATDashboard';
import ATClientes from './pages/admin/ATClientes';
import ATProductos from './pages/admin/ATProductos';
import ATPuntoVenta from './pages/admin/ATPuntoVenta';
import ATEstadoCuenta from './pages/admin/ATEstadoCuenta';

// Cliente pages
import CLDashboard from './pages/cliente/CLDashboard';
import CLEstadoCuenta from './pages/cliente/CLEstadoCuenta';

// ─── Guard de ruta ────────────────────────────────────────────

function PrivateRoute({
  children,
  rolesPermitidos,
}: {
  children: React.ReactNode;
  rolesPermitidos: string[];
}) {
  const sesion = useAppStore((s) => s.sesion);
  if (!sesion) return <Navigate to="/login" replace />;
  if (!rolesPermitidos.includes(sesion.rol)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ─── APP ─────────────────────────────────────────────────────

export default function App() {
  const sesion = useAppStore((s) => s.sesion);

  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Redirección raíz según rol */}
        <Route
          path="/"
          element={
            sesion?.rol === 'superadmin' ? (
              <Navigate to="/superadmin" replace />
            ) : sesion?.rol === 'admin_tienda' ? (
              <Navigate to="/admin" replace />
            ) : sesion?.rol === 'cliente' ? (
              <Navigate to="/cliente" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ── SuperAdmin ── */}
        <Route
          path="/superadmin"
          element={
            <PrivateRoute rolesPermitidos={['superadmin']}>
              <SuperAdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<SADashboard />} />
          <Route path="tiendas" element={<SATiendas />} />
        </Route>

        {/* ── Admin Tienda ── */}
        <Route
          path="/admin"
          element={
            <PrivateRoute rolesPermitidos={['admin_tienda']}>
              <AdminTiendaLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<ATDashboard />} />
          <Route path="clientes" element={<ATClientes />} />
          <Route path="productos" element={<ATProductos />} />
          <Route path="punto-venta" element={<ATPuntoVenta />} />
          <Route path="estado-cuenta/:clienteId" element={<ATEstadoCuenta />} />
          <Route path="estado-cuenta" element={<ATEstadoCuenta />} />
        </Route>

        {/* ── Cliente ── */}
        <Route
          path="/cliente"
          element={
            <PrivateRoute rolesPermitidos={['cliente']}>
              <ClienteLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<CLDashboard />} />
          <Route path="estado-cuenta" element={<CLEstadoCuenta />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

