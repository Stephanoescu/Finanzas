import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageTransacciones } from '../../utils/storage';
import {
  aplicarMoraAlCronograma,
  formatearMonto,
  calcularTED,
} from '../../utils/financeUtils';
import { CuotaCronograma, Transaccion } from '../../types/models';
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

  // Transacciones del cliente
  const transacciones = datos.transacciones
    .filter((t) => t.clienteId === clienteSelId && t.tiendaId === tiendaId)
    .sort((a, b) => new Date(b.fechaCompra).getTime() - new Date(a.fechaCompra).getTime());

  // Calcular cronogramas con mora actualizada
  const transaccionesConMora = transacciones.map((tx) => {
    const cronogramaActualizado = aplicarMoraAlCronograma(
      tx.cronograma as CuotaCronograma[],
      tx.tasaMoratoria,
      tx.tipoTasa,
      fechaActual
    );

    const hayMora = cronogramaActualizado.some((c) => c.estado === 'vencida' && c.mora > 0);
    const totalDeuda = cronogramaActualizado
      .filter((c) => c.estado !== 'pagada')
      .reduce((s, c) => s + c.cuota, 0);
    const totalMora = cronogramaActualizado.reduce((s, c) => s + c.mora, 0);

    return { tx, cronograma: cronogramaActualizado, hayMora, totalDeuda, totalMora };
  });

  // Totales globales
  const totalDeudaGlobal = transaccionesConMora
    .filter(({ tx }) => tx.estado !== 'liquidado' && tx.estado !== 'castigado')
    .reduce((s, { totalDeuda }) => s + totalDeuda, 0);
  const totalMoraGlobal = transaccionesConMora.reduce((s, { totalMora }) => s + totalMora, 0);
  const lineaDisponible = cliente
    ? cliente.limiteCredito - totalDeudaGlobal
    : 0;

  const toggleExpand = (txId: string) => {
    setExpandedTx((prev) =>
      prev.includes(txId) ? prev.filter((x) => x !== txId) : [...prev, txId]
    );
  };

  // Marcar cuota como pagada
  const marcarPagada = (txId: string, numCuota: number) => {
    const tx = transacciones.find((t) => t.id === txId);
    if (!tx) return;

    const cronograma = tx.cronograma.map((c) =>
      c.numeroCuota === numCuota
        ? { ...c, estado: 'pagada' as const, fechaPago: fechaActual.toISOString() }
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
              <p className="stat-value text-money">S/ {formatearMonto(cliente.limiteCredito)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Deuda Total</p>
              <p className="stat-value text-money text-danger-700">S/ {formatearMonto(totalDeudaGlobal)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Mora Acumulada</p>
              <p className={`stat-value text-money ${totalMoraGlobal > 0 ? 'text-danger-500' : 'text-gray-400'}`}>
                S/ {formatearMonto(totalMoraGlobal)}
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Línea Disponible</p>
              <p className={`stat-value text-money ${lineaDisponible < 0 ? 'text-danger-700' : 'text-success-700'}`}>
                S/ {formatearMonto(Math.max(0, lineaDisponible))}
              </p>
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
              {transaccionesConMora.map(({ tx, cronograma, hayMora, totalDeuda, totalMora }) => (
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
                        <p className="font-semibold text-money">S/ {formatearMonto(totalDeuda)}</p>
                      </div>
                      {totalMora > 0 && (
                        <div>
                          <p className="text-xs text-danger-500">Mora</p>
                          <p className="font-semibold text-money text-danger-600">
                            S/ {formatearMonto(totalMora)}
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
                              <span className="text-money">S/ {formatearMonto(item.subtotal)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-1 flex justify-between font-semibold text-sm">
                            <span>Total Compra</span>
                            <span className="text-money">S/ {formatearMonto(tx.montoOriginal)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Capital capitalizado ({tx.diasGracia} días gracia)</span>
                            <span className="text-money">S/ {formatearMonto(tx.capitalConGracia)}</span>
                          </div>
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
                                  <td className="text-money">S/ {formatearMonto(cuota.saldoInicial)}</td>
                                  <td className="text-money">S/ {formatearMonto(cuota.capital)}</td>
                                  <td className="text-money">S/ {formatearMonto(cuota.interes)}</td>
                                  <td className="text-money font-semibold">
                                    S/ {formatearMonto(cuota.cuota)}
                                  </td>
                                  <td className={`text-money ${cuota.mora > 0 ? 'text-danger-600 font-semibold' : 'text-gray-400'}`}>
                                    {cuota.mora > 0 ? `S/ ${formatearMonto(cuota.mora)}` : '—'}
                                  </td>
                                  <td className="text-money font-bold text-gray-900">
                                    S/ {formatearMonto(cuota.totalPagar)}
                                  </td>
                                  <td><EstadoBadge estado={cuota.estado} /></td>
                                  <td>
                                    {cuota.estado !== 'pagada' && (
                                      <button
                                        onClick={() => marcarPagada(tx.id, cuota.numeroCuota)}
                                        className="btn-primary btn-sm text-xs px-2 py-1"
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
                            <span className="font-bold text-money">S/ {formatearMonto(totalMora)}</span>
                          </p>
                          <p className="text-xs text-danger-500 mt-1">
                            Tasa moratoria: {(tx.tasaMoratoria * 100).toFixed(2)}% {tx.tipoTasa} —
                            TED mora: {(calcularTED(tx.tasaMoratoria, tx.tipoTasa) * 100).toFixed(6)}%
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

