import { useAppStore, useAppData } from '../../store/useAppStore';
import { formatearMonto } from '../../utils/financeUtils';
import { useNavigate } from 'react-router-dom';
import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ATDashboard() {
  const sesion = useAppStore((s) => s.sesion);
  const getFechaActual = useAppStore((s) => s.getFechaActual);
  const datos = useAppData();
  const navigate = useNavigate();

  const tiendaId = sesion?.tiendaId ?? '';
  const tienda = datos.tiendas.find((t) => t.id === tiendaId);
  const fechaActual = getFechaActual();

  const clientes = datos.clientes.filter((c) => c.tiendaId === tiendaId && c.activo);
  const productos = datos.productos.filter((p) => p.tiendaId === tiendaId && p.activo);
  const transacciones = datos.transacciones.filter((t) => t.tiendaId === tiendaId);
  const vigentes = transacciones.filter((t) => t.estado === 'vigente' || t.estado === 'en_mora');

  // Detectar créditos con mora
  const conMora = vigentes.filter((tx) =>
    tx.cronograma.some((c) => {
      if (c.estado === 'pagada') return false;
      return new Date(c.fechaVencimiento) < fechaActual;
    })
  );

  // Monto total vigente
  const totalVigente = vigentes.reduce((sum, tx) => {
    const pendiente = tx.cronograma
      .filter((c) => c.estado !== 'pagada')
      .reduce((s, c) => s + c.cuota, 0);
    return sum + pendiente;
  }, 0);

  // Últimas transacciones
  const ultimasTx = transacciones
    .sort((a, b) => new Date(b.fechaCompra).getTime() - new Date(a.fechaCompra).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {tienda?.nombre ?? 'Dashboard'}
        </h1>
        <p className="text-gray-500 text-sm">
          {format(fechaActual, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/clientes')}>
          <div className="flex items-center justify-between">
            <p className="stat-label">Clientes Activos</p>
            <Users className="w-4 h-4 text-primary-500" />
          </div>
          <p className="stat-value">{clientes.length}</p>
        </div>

        <div className="stat-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/productos')}>
          <div className="flex items-center justify-between">
            <p className="stat-label">Productos</p>
            <Package className="w-4 h-4 text-primary-500" />
          </div>
          <p className="stat-value">{productos.length}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="stat-label">Créditos Vigentes</p>
            <TrendingUp className="w-4 h-4 text-primary-500" />
          </div>
          <p className="stat-value">{vigentes.length}</p>
          <p className="stat-sub">S/ {formatearMonto(totalVigente)} total</p>
        </div>

        <div
          className={`stat-card cursor-pointer ${conMora.length > 0 ? 'border-danger-300 bg-danger-50' : ''}`}
          onClick={() => navigate('/admin/estado-cuenta')}
        >
          <div className="flex items-center justify-between">
            <p className="stat-label">Con Mora</p>
            <AlertTriangle className={`w-4 h-4 ${conMora.length > 0 ? 'text-danger-500' : 'text-gray-400'}`} />
          </div>
          <p className={`stat-value ${conMora.length > 0 ? 'text-danger-700' : ''}`}>{conMora.length}</p>
          <p className="stat-sub">{conMora.length > 0 ? 'Requieren atención' : 'Al corriente'}</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/admin/punto-venta')}
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
        >
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Nueva Venta</p>
            <p className="text-xs text-gray-500">Registrar crédito</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/admin/clientes')}
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
        >
          <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-success-700" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Gestionar Clientes</p>
            <p className="text-xs text-gray-500">CRUD de clientes</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/admin/estado-cuenta')}
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
        >
          <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-warning-700" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Estado de Cuenta</p>
            <p className="text-xs text-gray-500">Ver deudas y mora</p>
          </div>
        </button>
      </div>

      {/* Últimas transacciones */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-800">Últimas Transacciones</h2>
        </div>
        <div className="card-body p-0">
          {ultimasTx.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              Aún no hay transacciones. <br />
              <button onClick={() => navigate('/admin/punto-venta')} className="text-primary-600 underline mt-1">
                Registrar primera venta
              </button>
            </p>
          ) : (
            <div className="table-wrapper border-0 rounded-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Fecha Compra</th>
                    <th>Modalidad</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasTx.map((tx) => {
                    const cli = datos.clientes.find((c) => c.id === tx.clienteId);
                    const tieneMora = tx.cronograma.some(
                      (c) => c.estado !== 'pagada' && new Date(c.fechaVencimiento) < fechaActual
                    );
                    return (
                      <tr
                        key={tx.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/estado-cuenta/${tx.clienteId}`)}
                      >
                        <td className="font-mono text-xs">{tx.id.slice(-6).toUpperCase()}</td>
                        <td className="font-medium">{cli?.nombreCompleto ?? '—'}</td>
                        <td>{format(parseISO(tx.fechaCompra), 'dd/MM/yyyy')}</td>
                        <td>
                          {tx.modalidadPago === 'fin_de_mes'
                            ? 'Pago único'
                            : `${tx.numeroCuotas} cuotas`}
                        </td>
                        <td className="text-money">S/ {formatearMonto(tx.montoOriginal)}</td>
                        <td>
                          {tx.estado === 'liquidado' ? (
                            <span className="badge-green">Liquidado</span>
                          ) : tieneMora ? (
                            <span className="badge-red">En mora</span>
                          ) : (
                            <span className="badge-blue">Vigente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

