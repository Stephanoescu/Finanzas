import { useAppStore, useAppData } from '../../store/useAppStore';
import { aplicarMoraAlCronograma, formatearMoneda } from '../../utils/financeUtils';
import { CuotaCronograma } from '../../types/models';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CLDashboard() {
  const sesion = useAppStore((s) => s.sesion);
  const getFechaActual = useAppStore((s) => s.getFechaActual);
  const datos = useAppData();

  const clienteId = sesion?.userId ?? '';
  const fechaActual = getFechaActual();

  const cliente = datos.clientes.find((c) => c.id === clienteId);
  const fm = (v: number) => formatearMoneda(v, cliente?.moneda);
  const tienda = datos.tiendas.find((t) => t.id === cliente?.tiendaId);

  const transacciones = datos.transacciones.filter(
    (t) => t.clienteId === clienteId && t.estado !== 'castigado'
  );

  const transaccionesConMora = transacciones.map((tx) => {
    const cronograma = aplicarMoraAlCronograma(
      tx.cronograma as CuotaCronograma[],
      tx.tasaMoratoria,
      tx.tipoTasa,
      fechaActual,
      tx.capitalizacion ?? 30
    );
    const totalDeuda = cronograma.filter((c) => c.estado !== 'pagada').reduce((s, c) => s + c.cuota, 0);
    // Solo la mora de cuotas impagas: la mora de una cuota ya pagada quedó saldada en su pago
    const totalMora = cronograma.filter((c) => c.estado !== 'pagada').reduce((s, c) => s + c.mora, 0);
    const proximaVenc = cronograma.find((c) => c.estado === 'pendiente' || c.estado === 'vencida');
    return { tx, cronograma, totalDeuda, totalMora, proximaVenc };
  });

  const totalDeuda = transaccionesConMora.reduce((s, t) => s + t.totalDeuda, 0);
  const totalMora = transaccionesConMora.reduce((s, t) => s + t.totalMora, 0);
  const disponible = (cliente?.limiteCredito ?? 0) - totalDeuda;

  // Próximos pagos (cuotas pendientes de todas las transacciones, ordenadas por fecha)
  const proximosPagos = transaccionesConMora
    .flatMap(({ tx, cronograma }) =>
      cronograma
        .filter((c) => c.estado === 'pendiente' || c.estado === 'vencida')
        .map((c) => ({ ...c, txId: tx.id }))
    )
    .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
    .slice(0, 5);

  if (!cliente) {
    return <div className="text-center text-gray-400 py-12">Cargando datos del cliente...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hola, {cliente.nombreCompleto.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm">
          {tienda?.nombre} · {format(fechaActual, "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Tarjeta principal de línea de crédito */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 opacity-80" />
          <span className="text-primary-100 text-sm font-medium uppercase tracking-wide">
            Línea de Crédito
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-primary-200 text-xs">Límite Total</p>
            <p className="text-2xl font-bold text-money mt-1">
              {fm(cliente.limiteCredito)}
            </p>
          </div>
          <div>
            <p className="text-primary-200 text-xs">Utilizado</p>
            <p className="text-2xl font-bold text-money mt-1">
              {fm(totalDeuda)}
            </p>
          </div>
          <div>
            <p className="text-primary-200 text-xs">Disponible</p>
            <p className="text-2xl font-bold text-money mt-1">
              {fm(Math.max(0, disponible))}
            </p>
          </div>
        </div>

        {/* Barra de uso */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-primary-200 mb-1">
            <span>Utilización</span>
            <span>{((totalDeuda / cliente.limiteCredito) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalDeuda / cliente.limiteCredito) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats secundarios */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="stat-label">Créditos Activos</p>
            <TrendingUp className="w-4 h-4 text-primary-500" />
          </div>
          <p className="stat-value">{transacciones.filter((t) => t.estado !== 'liquidado').length}</p>
        </div>

        <div className={`stat-card ${totalMora > 0 ? 'border-danger-300' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="stat-label">Mora Acumulada</p>
            {totalMora > 0 ? (
              <AlertTriangle className="w-4 h-4 text-danger-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-success-500" />
            )}
          </div>
          <p className={`stat-value text-money ${totalMora > 0 ? 'text-danger-700' : 'text-gray-900'}`}>
            {fm(totalMora)}
          </p>
          <p className="stat-sub">{totalMora > 0 ? '⚠️ Tienes cuotas vencidas' : '✅ Al corriente'}</p>
        </div>
      </div>

      {/* Próximos pagos */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Próximos Pagos</h2>
        </div>
        <div className="card-body p-0">
          {proximosPagos.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-success-500" />
              No tienes cuotas pendientes
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {proximosPagos.map((cuota, idx) => {
                const fechaVenc = parseISO(cuota.fechaVencimiento);
                const esVencida = cuota.estado === 'vencida';
                return (
                  <div key={idx} className={`px-5 py-3 flex items-center justify-between ${esVencida ? 'bg-danger-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Crédito #{cuota.txId.slice(-6).toUpperCase()} — Cuota {cuota.numeroCuota}
                      </p>
                      <p className={`text-xs mt-0.5 ${esVencida ? 'text-danger-600 font-medium' : 'text-gray-500'}`}>
                        {esVencida ? '⚠️ Venció el ' : 'Vence el '}
                        {format(fechaVenc, "d 'de' MMMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-money">{fm(cuota.cuota)}</p>
                      {cuota.mora > 0 && (
                        <p className="text-xs text-danger-600">
                          +{fm(cuota.mora)} mora
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

