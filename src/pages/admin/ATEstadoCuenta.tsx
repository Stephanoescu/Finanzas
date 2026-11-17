import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageTransacciones, storagePagos, generarId } from '../../utils/storage';
import {
  aplicarMoraAlCronograma,
  aplicarPrelacion,
  calcularTED,
  calcularTEM,
  calcularTCEATransaccion,
  formatearMoneda,
  formatearTasa,
  redondear,
} from '../../utils/financeUtils';
import { CuotaCronograma, Transaccion, Pago } from '../../types/models';
import {
  FileText, AlertTriangle, CheckCircle, Clock,
  ChevronDown, ChevronUp, User, Calendar, TrendingUp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function EstadoBadge({ estado }: { estado: CuotaCronograma['estado'] }) {
  if (estado === 'pagada') return <span className="badge-green">Pagada</span>;
  if (estado === 'vencida') return <span className="badge-red">Vencida</span>;
  if (estado === 'pagada_parcial') return <span className="badge-yellow">Parcial</span>;
  return <span className="badge-gray">Pendiente</span>;
}

function EstadoCreditoBadge({ estado }: { estado: Transaccion['estado'] }) {
  if (estado === 'vigente') return <span className="badge-blue">Vigente</span>;
  if (estado === 'en_mora') return <span className="badge-red">En Mora</span>;
  if (estado === 'liquidado') return <span className="badge-green">Liquidado</span>;
  return <span className="badge-gray">Castigado</span>;
}

export default function ATEstadoCuenta() {
  const { clienteId: paramClienteId } = useParams<{ clienteId: string }>();
  const sesion = useAppStore((s) => s.sesion);
  const getFechaActual = useAppStore((s) => s.getFechaActual);
  const refrescarDatos = useAppStore((s) => s.refrescarDatos);
  const datos = useAppData();

  const tiendaId = sesion?.tiendaId ?? '';
  const clientes = datos.clientes.filter((c) => c.tiendaId === tiendaId);

  const [clienteSelId, setClienteSelId] = useState(paramClienteId ?? '');
  const [expandedTx, setExpandedTx] = useState<string[]>([]);

  const cliente = clientes.find((c) => c.id === clienteSelId);
  const fechaActual = getFechaActual();
  const moneda = cliente?.moneda ?? 'PEN';
  const fm = (v: number) => formatearMoneda(v, moneda);

  // Transacciones del cliente
  const transacciones = datos.transacciones
    .filter((t) => t.clienteId === clienteSelId && t.tiendaId === tiendaId)
    .sort((a, b) => new Date(a.fechaCompra).getTime() - new Date(b.fechaCompra).getTime());

  // Calcular cronogramas con mora actualizada
  const transaccionesConMora = transacciones.map((tx) => {
    const cronogramaActualizado = aplicarMoraAlCronograma(
      tx.cronograma as CuotaCronograma[],
      tx.tasaMoratoria,
      tx.tipoTasa,
      fechaActual,
      tx.capitalizacion ?? 30
    );

    const hayMora = cronogramaActualizado.some((c) => c.estado === 'vencida' && c.mora > 0);
    const totalDeuda = cronogramaActualizado
      .filter((c) => c.estado !== 'pagada')
      .reduce((s, c) => s + c.cuota, 0);
    // Solo la mora de cuotas impagas: la mora de una cuota ya pagada quedó saldada en su pago
    const totalMora = cronogramaActualizado.filter((c) => c.estado !== 'pagada').reduce((s, c) => s + c.mora, 0);
    const pendientes = cronogramaActualizado.filter((c) => c.estado !== 'pagada');
    const totalCapital = pendientes.reduce((s, c) => s + c.capital, 0);
    const totalInteres = pendientes.reduce((s, c) => s + c.interes, 0);
    const tcea = tx.tcea ?? calcularTCEATransaccion(
      tx.montoOriginal, tx.diasGracia, tx.modalidadPago, tx.cronograma
    );

    return { tx, cronograma: cronogramaActualizado, hayMora, totalDeuda, totalMora, totalCapital, totalInteres, tcea };
  });

  // Totales globales
  const totalDeudaGlobal = transaccionesConMora
    .filter(({ tx }) => tx.estado !== 'liquidado' && tx.estado !== 'castigado')
    .reduce((s, { totalDeuda }) => s + totalDeuda, 0);
  const totalMoraGlobal = transaccionesConMora.reduce((s, { totalMora }) => s + totalMora, 0);
  const activas = transaccionesConMora.filter(
    ({ tx }) => tx.estado !== 'liquidado' && tx.estado !== 'castigado'
  );
  const totalCapitalGlobal = activas.reduce((s, t) => s + t.totalCapital, 0);
  const totalInteresGlobal = activas.reduce((s, t) => s + t.totalInteres, 0);
  const lineaDisponible = cliente
    ? cliente.limiteCredito - totalDeudaGlobal
    : 0;

  const toggleExpand = (txId: string) => {
    setExpandedTx((prev) =>
      prev.includes(txId) ? prev.filter((x) => x !== txId) : [...prev, txId]
    );
  };

  // Pagar una cuota COMPLETA (cuota + mora a la fecha). No se admiten pagos parciales.
  const pagarCuota = (txId: string, numCuota: number) => {
    const tx = transacciones.find((t) => t.id === txId);
    const evaluada = transaccionesConMora
      .find((t) => t.tx.id === txId)
      ?.cronograma.find((c) => c.numeroCuota === numCuota);
    if (!tx || !evaluada || evaluada.estado === 'pagada' || !cliente) return;

    const mora = evaluada.mora;
    const montoPagado = redondear(evaluada.cuota + mora);
    if (!window.confirm(
      `Se registrará el pago COMPLETO de la cuota ${numCuota}: ${fm(montoPagado)} ` +
      `(cuota ${fm(evaluada.cuota)} + mora ${fm(mora)}). No se admiten pagos parciales. ¿Continuar?`
    )) return;

    const fechaPago = fechaActual.toISOString();
    const desglose = aplicarPrelacion(montoPagado, mora, evaluada.interes);

    const pago: Pago = {
      id: generarId('pago'),
      tiendaId,
      clienteId: tx.clienteId,
      transaccionId: tx.id,
      numeroCuota: numCuota,
      fechaPago,
      montoPagado,
      ...desglose,
      registradoPor: sesion?.userId ?? '',
      creadoEn: fechaPago,
    };
    storagePagos.guardar(pago);

    // La mora queda congelada a la fecha del pago
    const cronograma = tx.cronograma.map((c) =>
      c.numeroCuota === numCuota
        ? { ...c, estado: 'pagada' as const, mora, totalPagar: montoPagado, montoPagado, fechaPago }
        : c
    );

    const todasPagadas = cronograma.every((c) => c.estado === 'pagada');
    storageTransacciones.guardar({
      ...tx,
      cronograma,
      estado: todasPagadas ? 'liquidado' : tx.estado,
    });
    refrescarDatos();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" /> Estado de Cuenta
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Fecha del sistema: {format(fechaActual, "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Selector de cliente */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-gray-500" />
          <select
            className="input max-w-xs"
            value={clienteSelId}
            onChange={(e) => setClienteSelId(e.target.value)}
          >
            <option value="">-- Seleccionar cliente --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombreCompleto}</option>
            ))}
          </select>
        </div>
      </div>

      {!clienteSelId && (
        <div className="text-center text-gray-400 py-12">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona un cliente para ver su estado de cuenta</p>
        </div>
      )}

      {cliente && (
        <>
          {/* Resumen de línea de crédito */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="stat-label">Línea de Crédito</p>
              <p className="stat-value text-money">{fm(cliente.limiteCredito)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Deuda Total</p>
              <p className="stat-value text-money text-danger-700">{fm(totalDeudaGlobal)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Mora Acumulada</p>
              <p className={`stat-value text-money ${totalMoraGlobal > 0 ? 'text-danger-500' : 'text-gray-400'}`}>
                {fm(totalMoraGlobal)}
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Línea Disponible</p>
              <p className={`stat-value text-money ${lineaDisponible < 0 ? 'text-danger-700' : 'text-success-700'}`}>
                {fm(Math.max(0, lineaDisponible))}
              </p>
            </div>
          </div>

          {/* Resumen: compras en orden cronológico, interés compensatorio e intereses por mora separados */}
          <div className="card p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Capital pendiente</span>
              <span className="text-money">{fm(totalCapitalGlobal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Interés compensatorio</span>
              <span className="text-money">{fm(totalInteresGlobal)}</span>
            </div>
            <div className="flex justify-between text-danger-600">
              <span>Intereses por mora</span>
              <span className="text-money">{fm(totalMoraGlobal)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total a pagar</span>
              <span className="text-money">{fm(totalDeudaGlobal + totalMoraGlobal)}</span>
            </div>
          </div>

          {/* Barra de utilización */}
          <div className="card p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Utilización de línea</span>
              <span className="font-medium">
                {((totalDeudaGlobal / cliente.limiteCredito) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  totalDeudaGlobal / cliente.limiteCredito > 0.9
                    ? 'bg-danger-500'
                    : totalDeudaGlobal / cliente.limiteCredito > 0.7
                    ? 'bg-warning-500'
                    : 'bg-primary-500'
                }`}
                style={{
                  width: `${Math.min(100, (totalDeudaGlobal / cliente.limiteCredito) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Transacciones */}
          {transaccionesConMora.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Este cliente no tiene créditos registrados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transaccionesConMora.map(({ tx, cronograma, hayMora, totalDeuda, totalMora, totalCapital, totalInteres, tcea }) => (
                <div key={tx.id} className="card overflow-hidden">
                  {/* Header de transacción */}
                  <div
                    className="card-header flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(tx.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            Crédito #{tx.id.slice(-6).toUpperCase()}
                          </span>
                          <EstadoCreditoBadge estado={tx.estado} />
                          {hayMora && (
                            <span className="flex items-center gap-1 text-xs text-danger-600 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Con mora
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(tx.fechaCompra), "d MMM yyyy", { locale: es })}
                          </span>
                          <span>
                            {tx.modalidadPago === 'fin_de_mes' ? 'Pago único' : `${tx.numeroCuotas} cuotas`}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {(tx.tasaInteres * 100).toFixed(1)}% {tx.tipoTasa}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-500">Deuda</p>
                        <p className="font-semibold text-money">{fm(totalDeuda)}</p>
                      </div>
                      {totalMora > 0 && (
                        <div>
                          <p className="text-xs text-danger-500">Mora</p>
                          <p className="font-semibold text-money text-danger-600">
                            {fm(totalMora)}
                          </p>
                        </div>
                      )}
                      {expandedTx.includes(tx.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {expandedTx.includes(tx.id) && (
                    <div className="card-body space-y-4">
                      {/* Productos comprados */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Detalle de Compra
                        </p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {tx.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>
                                {item.cantidad}x {item.descripcion}
                              </span>
                              <span className="text-money">{fm(item.subtotal)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-1 flex justify-between font-semibold text-sm">
                            <span>Total Compra</span>
                            <span className="text-money">{fm(tx.montoOriginal)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Capital capitalizado ({tx.diasGracia} días gracia)</span>
                            <span className="text-money">{fm(tx.capitalConGracia)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Transparencia de tasas */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
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
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-500">Pago del ciclo / 1ra cuota</p>
                          <p className="font-mono">
                            {format(parseISO(tx.fechaPagoCiclo), 'dd/MM/yyyy')} / {format(parseISO(tx.fechaPrimeraCuota), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>

                      {/* Desglose de la deuda: interés compensatorio y mora por separado */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Capital pendiente</span>
                          <span className="text-money">{fm(totalCapital)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Interés compensatorio</span>
                          <span className="text-money">{fm(totalInteres)}</span>
                        </div>
                        <div className="flex justify-between text-danger-600">
                          <span>Intereses por mora</span>
                          <span className="text-money">{fm(totalMora)}</span>
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
                                <th>#</th>
                                <th>Vencimiento</th>
                                <th>Saldo Inicial</th>
                                <th>Capital</th>
                                <th>Interés</th>
                                <th>Cuota</th>
                                <th className="text-danger-600">Mora</th>
                                <th className="text-danger-600">Total a Pagar</th>
                                <th>Estado</th>
                                <th>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cronograma.map((cuota) => (
                                <tr
                                  key={cuota.numeroCuota}
                                  className={cuota.estado === 'vencida' ? 'bg-danger-50' : ''}
                                >
                                  <td className="font-medium">{cuota.numeroCuota}</td>
                                  <td>
                                    {format(parseISO(cuota.fechaVencimiento), 'dd/MM/yyyy')}
                                  </td>
                                  <td className="text-money">{fm(cuota.saldoInicial)}</td>
                                  <td className="text-money">{fm(cuota.capital)}</td>
                                  <td className="text-money">{fm(cuota.interes)}</td>
                                  <td className="text-money font-semibold">
                                    {fm(cuota.cuota)}
                                  </td>
                                  <td className={`text-money ${cuota.mora > 0 ? 'text-danger-600 font-semibold' : 'text-gray-400'}`}>
                                    {cuota.mora > 0 ? fm(cuota.mora) : '—'}
                                  </td>
                                  <td className="text-money font-bold text-gray-900">
                                    {fm(cuota.totalPagar)}
                                  </td>
                                  <td><EstadoBadge estado={cuota.estado} /></td>
                                  <td>
                                    {cuota.estado !== 'pagada' && (
                                      <button
                                        onClick={() => pagarCuota(tx.id, cuota.numeroCuota)}
                                        className="btn-primary btn-sm text-xs px-2 py-1"
                                        title="Se paga la cuota completa (cuota + mora)"
                                      >
                                        Pagar
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Resumen mora si aplica */}
                      {totalMora > 0 && (
                        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-danger-700 font-semibold mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            Intereses por Mora
                          </div>
                          <p className="text-sm text-danger-600">
                            Mora acumulada a la fecha:{' '}
                            <span className="font-bold text-money">{fm(totalMora)}</span>
                          </p>
                          <p className="text-xs text-danger-500 mt-1">
                            Tasa moratoria: {(tx.tasaMoratoria * 100).toFixed(2)}% {tx.tipoTasa} —
                            TED mora: {formatearTasa(calcularTED(tx.tasaMoratoria, tx.tipoTasa, tx.capitalizacion ?? 30))}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

