import { useAppStore, useAppData } from '../../store/useAppStore';
import {
  aplicarMoraAlCronograma, formatearMoneda, formatearTasa, calcularTED, calcularTEM, calcularTCEATransaccion,
} from '../../utils/financeUtils';
import { CuotaCronograma } from '../../types/models';
import { FileText, AlertTriangle, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function EstadoBadge({ estado }: { estado: CuotaCronograma['estado'] }) {
  if (estado === 'pagada') return <span className="badge-green">Pagada</span>;
  if (estado === 'vencida') return <span className="badge-red">Vencida</span>;
  if (estado === 'pagada_parcial') return <span className="badge-yellow">Parcial</span>;
  return <span className="badge-gray">Pendiente</span>;
}

export default function CLEstadoCuenta() {
  const sesion = useAppStore((s) => s.sesion);
  const getFechaActual = useAppStore((s) => s.getFechaActual);
  const datos = useAppData();

  const clienteId = sesion?.userId ?? '';
  const fechaActual = getFechaActual();

  const cliente = datos.clientes.find((c) => c.id === clienteId);
  const fm = (v: number) => formatearMoneda(v, cliente?.moneda);
  const transacciones = datos.transacciones
    .filter((t) => t.clienteId === clienteId)
    .sort((a, b) => new Date(a.fechaCompra).getTime() - new Date(b.fechaCompra).getTime());

  const transaccionesConMora = transacciones.map((tx) => {
    const cronograma = aplicarMoraAlCronograma(
      tx.cronograma as CuotaCronograma[],
      tx.tasaMoratoria,
      tx.tipoTasa,
      fechaActual,
      tx.capitalizacion ?? 30
    );
    const pendientes = cronograma.filter((c) => c.estado !== 'pagada');
    const totalDeuda = pendientes.reduce((s, c) => s + c.cuota, 0);
    const totalInteres = pendientes.reduce((s, c) => s + c.interes, 0);
    const totalMora = cronograma.reduce((s, c) => s + c.mora, 0);
    const tcea = tx.tcea ?? calcularTCEATransaccion(tx.montoOriginal, tx.diasGracia, tx.modalidadPago, tx.cronograma);
    return { tx, cronograma, totalDeuda, totalMora, totalInteres, tcea };
  });

  const totalDeudaGlobal = transaccionesConMora.reduce((s, t) => s + t.totalDeuda, 0);
  const totalMoraGlobal = transaccionesConMora.reduce((s, t) => s + t.totalMora, 0);

  if (!cliente) return <p className="text-gray-400 text-center py-12">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" /> Mi Estado de Cuenta
        </h1>
        <p className="text-gray-500 text-sm">
          Al {format(fechaActual, "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Deuda Total</p>
          <p className="stat-value text-money">{fm(totalDeudaGlobal)}</p>
        </div>
        <div className={`stat-card ${totalMoraGlobal > 0 ? 'border-danger-300 bg-danger-50' : ''}`}>
          <p className="stat-label">Mora Acumulada</p>
          <p className={`stat-value text-money ${totalMoraGlobal > 0 ? 'text-danger-700' : 'text-gray-400'}`}>
            {fm(totalMoraGlobal)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total a Pagar</p>
          <p className="stat-value text-money text-primary-700">
            {fm(totalDeudaGlobal + totalMoraGlobal)}
          </p>
        </div>
      </div>

      {transaccionesConMora.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success-500 opacity-50" />
          <p className="font-medium">No tienes créditos registrados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {transaccionesConMora.map(({ tx, cronograma, totalDeuda, totalMora, totalInteres, tcea }) => (
            <div key={tx.id} className="card overflow-hidden">
              {/* Encabezado de crédito */}
              <div className="card-header bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Crédito #{tx.id.slice(-6).toUpperCase()}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(tx.fechaCompra), "d MMM yyyy", { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {(tx.tasaInteres * 100).toFixed(2)}% {tx.tipoTasa}
                      </span>
                      <span>
                        {tx.modalidadPago === 'fin_de_mes' ? 'Pago único' : `${tx.numeroCuotas} cuotas`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.estado === 'liquidado' ? (
                      <span className="badge-green">Liquidado</span>
                    ) : totalMora > 0 ? (
                      <span className="badge-red">En Mora</span>
                    ) : (
                      <span className="badge-blue">Vigente</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card-body space-y-4">
                {/* Detalle de compras */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Detalle de Compra
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    {tx.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-700">{item.cantidad}x {item.descripcion}</span>
                        <span className="text-money text-gray-800">{fm(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Subtotal</span>
                      <span className="text-money">{fm(tx.montoOriginal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Capital con gracia ({tx.diasGracia}d)</span>
                      <span className="text-money">{fm(tx.capitalConGracia)}</span>
                    </div>
                  </div>
                </div>

                {/* Transparencia de tasas */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-500">TED</p>
                    <p className="font-mono">{formatearTasa(calcularTED(tx.tasaInteres, tx.tipoTasa, tx.capitalizacion ?? 30))}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-500">TEM</p>
                    <p className="font-mono">{formatearTasa(calcularTEM(tx.tasaInteres, tx.tipoTasa, tx.capitalizacion ?? 30))}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-500">TCEA</p>
                    <p className="font-mono">{formatearTasa(tcea)}</p>
                  </div>
                </div>

                {/* Cronograma */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Cronograma de Pagos
                  </p>
                  <div className="table-wrapper">
                    <table className="table text-xs">
                      <thead>
                        <tr>
                          <th>Cuota</th>
                          <th>Vencimiento</th>
                          <th>Capital</th>
                          <th>Interés</th>
                          <th>Cuota</th>
                          <th>Mora</th>
                          <th>Total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cronograma.map((c) => (
                          <tr key={c.numeroCuota} className={c.estado === 'vencida' ? 'bg-danger-50' : ''}>
                            <td className="font-medium">{c.numeroCuota}</td>
                            <td>{format(parseISO(c.fechaVencimiento), 'dd/MM/yyyy')}</td>
                            <td className="text-money">{fm(c.capital)}</td>
                            <td className="text-money">{fm(c.interes)}</td>
                            <td className="text-money font-semibold">{fm(c.cuota)}</td>
                            <td className={`text-money ${c.mora > 0 ? 'text-danger-600 font-semibold' : 'text-gray-400'}`}>
                              {c.mora > 0 ? fm(c.mora) : '—'}
                            </td>
                            <td className="text-money font-bold">{fm(c.totalPagar)}</td>
                            <td><EstadoBadge estado={c.estado} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Interés compensatorio e intereses por mora, por separado */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Interés compensatorio pendiente</span>
                    <span className="text-money">{fm(totalInteres)}</span>
                  </div>
                  <div className="flex justify-between text-danger-600">
                    <span>Intereses por mora</span>
                    <span className="text-money">{fm(totalMora)}</span>
                  </div>
                </div>

                {/* Mora */}
                {totalMora > 0 && (
                  <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-danger-700 font-semibold mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Intereses por Mora
                    </div>
                    <p className="text-sm text-danger-600">
                      Total mora: <strong className="text-money">{fm(totalMora)}</strong>
                    </p>
                    <p className="text-xs text-danger-500 mt-1">
                      Tasa moratoria: {(tx.tasaMoratoria * 100).toFixed(2)}% {tx.tipoTasa}
                    </p>
                  </div>
                )}

                {/* Totales del crédito */}
                <div className="bg-primary-50 rounded-lg p-3 flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-gray-600">Deuda pendiente:</span>
                    <span className="font-semibold text-money ml-2">{fm(totalDeuda)}</span>
                    {totalMora > 0 && (
                      <>
                        <span className="text-gray-400 mx-2">+</span>
                        <span className="text-danger-600 font-semibold text-money">{fm(totalMora)} mora</span>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total a pagar</p>
                    <p className="font-bold text-lg text-money text-primary-700">
                      {fm(totalDeuda + totalMora)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

