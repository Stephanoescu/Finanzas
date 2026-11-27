import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, useAppData } from '../../store/useAppStore';
import { storageTransacciones, generarId } from '../../utils/storage';
import {
  construirTransaccion,
  validarLimiteCredito,
  calcularLineaDisponible,
  AYUDA_LINEA_DISPONIBLE,
  formatearMoneda,
  formatearTasa,
  precioSegunModalidad,
} from '../../utils/financeUtils';
import HelpTip from '../../components/HelpTip';
import {
  Transaccion, ItemCompra, CuotaCronograma, ModalidadPago
} from '../../types/models';
import {
  ShoppingCart, Search, Plus, Minus, Trash2,
  AlertCircle, CheckCircle, User, Package, Info
} from 'lucide-react';

interface CarritoItem extends ItemCompra {
  productoId: string;
}

export default function ATPuntoVenta() {
  const sesion = useAppStore((s) => s.sesion);
  const getFechaActual = useAppStore((s) => s.getFechaActual);
  const refrescarDatos = useAppStore((s) => s.refrescarDatos);
  const datos = useAppData();
  const navigate = useNavigate();

  const tiendaId = sesion?.tiendaId ?? '';

  // ── Estado ──
  const [clienteId, setClienteId] = useState('');
  const [buscarProducto, setBuscarProducto] = useState('');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [modalidadPago, setModalidadPago] = useState<ModalidadPago>('fin_de_mes');
  const [numeroCuotas, setNumeroCuotas] = useState(1);
  const [preview, setPreview] = useState<ReturnType<typeof construirTransaccion> | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const clientes = datos.clientes.filter((c) => c.tiendaId === tiendaId && c.activo);
  const productos = datos.productos.filter((p) => p.tiendaId === tiendaId && p.activo);
  const cliente = clientes.find((c) => c.id === clienteId);
  const moneda = cliente?.moneda ?? 'PEN';
  const fm = (v: number) => formatearMoneda(v, moneda);
  const linea = cliente
    ? calcularLineaDisponible(cliente, datos.transacciones)
    : { utilizado: 0, disponible: 0 };

  const productosFiltrados = productos.filter(
    (p) =>
      p.descripcion.toLowerCase().includes(buscarProducto.toLowerCase()) ||
      (p.marca ?? '').toLowerCase().includes(buscarProducto.toLowerCase())
  );

  // ── Carrito ──
  const totalCarrito = carrito.reduce((s, i) => s + i.subtotal, 0);

  // "Cuotas" solo si TODOS los productos del carrito permiten cuotas
  const sinCuotas = carrito.filter(
    (i) => !productos.find((p) => p.id === i.productoId)?.permiteCuotas
  );
  const cuotasBloqueadas = sinCuotas.length > 0;
  const motivoCuotas = cuotasBloqueadas
    ? `No se puede financiar en cuotas: ${sinCuotas.map((i) => i.descripcion).join(', ')} no ${
        sinCuotas.length === 1 ? 'permite' : 'permiten'
      } cuotas. Quítelo(s) del carrito o use pago único.`
    : '';

  /** Precio unitario según modalidad: contado para pago único, crédito para cuotas. */
  const precioPara = (productoId: string, m: ModalidadPago, fallback: number) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return fallback;
    return precioSegunModalidad(p, m);
  };

  /** Recalcula precios y subtotales del carrito para la modalidad indicada. */
  const repreciar = (items: CarritoItem[], m: ModalidadPago): CarritoItem[] =>
    items.map((i) => {
      const precio = precioPara(i.productoId, m, i.precioUnitario);
      return { ...i, precioUnitario: precio, subtotal: precio * i.cantidad };
    });

  const cambiarModalidad = (m: ModalidadPago) => {
    setModalidadPago(m);
    if (m === 'fin_de_mes') setNumeroCuotas(1);
    setCarrito((prev) => repreciar(prev, m));
    setPreview(null);
    setError('');
  };

  const agregarAlCarrito = (productoId: string) => {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return;

    // Si se agrega un producto sin cuotas estando en "Cuotas", se pasa a pago único
    const modalidadEf: ModalidadPago =
      modalidadPago === 'cuotas' && (cuotasBloqueadas || !producto.permiteCuotas)
        ? 'fin_de_mes'
        : modalidadPago;
    if (modalidadEf !== modalidadPago) {
      setModalidadPago(modalidadEf);
      setNumeroCuotas(1);
    }
    const precioUsar = precioPara(productoId, modalidadEf, 0);

    setCarrito((prev) => {
      const base = modalidadEf !== modalidadPago ? repreciar(prev, modalidadEf) : prev;
      const exist = base.find((i) => i.productoId === productoId);
      if (exist) {
        return base.map((i) =>
          i.productoId === productoId
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
            : i
        );
      }
      return [
        ...base,
        {
          productoId,
          descripcion: producto.descripcion,
          cantidad: 1,
          precioUnitario: precioUsar,
          subtotal: precioUsar,
        },
      ];
    });
    setPreview(null);
    setError('');
    setExito('');
  };

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.productoId === productoId
            ? {
                ...i,
                cantidad: Math.max(0, i.cantidad + delta),
                subtotal: Math.max(0, i.cantidad + delta) * i.precioUnitario,
              }
            : i
        )
        .filter((i) => i.cantidad > 0)
    );
    setPreview(null);
  };

  const eliminarItem = (productoId: string) => {
    setCarrito((prev) => prev.filter((i) => i.productoId !== productoId));
    setPreview(null);
  };

  // ── Calcular preview ──
  const calcularPreview = () => {
    setError('');
    if (!cliente) { setError('Selecciona un cliente'); return; }
    if (carrito.length === 0) { setError('El carrito está vacío'); return; }
    if (modalidadPago === 'cuotas' && cuotasBloqueadas) { setError(motivoCuotas); return; }

    // Validar límite de crédito (F9: solo el capital pendiente consume línea)
    const validacion = validarLimiteCredito(linea.utilizado, totalCarrito, cliente.limiteCredito);
    if (!validacion.aprobado) {
      setError(
        `Excede el límite de crédito. Disponible: ${fm(validacion.saldoDisponible)}. Exceso: ${fm(validacion.exceso)}`
      );
      return;
    }

    const cuotasEfectivas =
      modalidadPago === 'fin_de_mes' ? 1 : Math.max(1, numeroCuotas);

    const resultado = construirTransaccion({
      montoOriginal: totalCarrito,
      tipoTasa: cliente.tipoTasa,
      capitalizacion: cliente.capitalizacion ?? 30,
      tasaInteres: cliente.tasaInteres,
      tasaMoratoria: cliente.tasaMoratoria,
      modalidadPago,
      numeroCuotas: cuotasEfectivas,
      diaCorte: cliente.diaCorte,
      diaPago: cliente.diaPago,
      fechaCompra: getFechaActual(),
    });

    setPreview(resultado);
  };

  // ── Confirmar venta ──
  const confirmarVenta = () => {
    if (!preview || !cliente) return;
    if (modalidadPago === 'cuotas' && cuotasBloqueadas) { setError(motivoCuotas); return; }

    const fechaActual = getFechaActual();
    const cuotasEfectivas = modalidadPago === 'fin_de_mes' ? 1 : Math.max(1, numeroCuotas);

    // Construir cronograma completo con campos de estado
    const cronograma: CuotaCronograma[] = preview.cronograma.map((c) => ({
      ...c,
      mora: 0,
      totalPagar: c.cuota,
      estado: 'pendiente' as const,
    }));

    const transaccion: Transaccion = {
      id: generarId('tx'),
      tiendaId,
      clienteId,
      fechaCompra: fechaActual.toISOString(),
      items: carrito,
      montoOriginal: totalCarrito,
      moneda: cliente.moneda ?? 'PEN',
      tipoTasa: cliente.tipoTasa,
      capitalizacion: cliente.capitalizacion ?? 30,
      tasaInteres: cliente.tasaInteres,
      tasaMoratoria: cliente.tasaMoratoria,
      modalidadPago,
      numeroCuotas: cuotasEfectivas,
      fechaCorte: preview.fechaCorte,
      fechaPagoCiclo: preview.fechaPagoCiclo,
      fechaPrimeraCuota: preview.fechaPrimeraCuota,
      tcea: preview.tcea,
      diasGracia: preview.diasGracia,
      capitalConGracia: preview.capitalConGracia,
      cuotaMensual: preview.cuotaMensual,
      cronograma,
      estado: 'vigente',
      creadoEn: fechaActual.toISOString(),
    };

    storageTransacciones.guardar(transaccion);
    refrescarDatos();

    setExito(`✅ Venta registrada. Crédito #${transaccion.id.slice(-6).toUpperCase()}`);
    setCarrito([]);
    setClienteId('');
    setPreview(null);
    setNumeroCuotas(1);
    setModalidadPago('fin_de_mes');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Punto de Venta</h1>
        <p className="text-gray-500 text-sm mt-1">Registra una venta a crédito</p>
      </div>

      {exito && (
        <div className="flex items-center gap-2 bg-success-50 text-success-700 border border-success-500 rounded-lg px-4 py-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {exito}
          <button
            className="ml-auto text-xs underline"
            onClick={() => navigate(`/admin/estado-cuenta/${clienteId || ''}`)}
          >
            Ver estado de cuenta
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna Izquierda: Selección ── */}
        <div className="space-y-4">
          {/* Selector de Cliente */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-4 h-4" /> Seleccionar Cliente
                <HelpTip text="Cliente que recibe el crédito. De él se toman la moneda, la tasa, la mora, los días de corte y pago y el límite de crédito disponible." />
              </h2>
            </div>
            <div className="card-body">
              <select
                className="input"
                value={clienteId}
                onChange={(e) => { setClienteId(e.target.value); setPreview(null); setError(''); }}
              >
                <option value="">-- Seleccionar cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombreCompleto} — Límite: {fm(c.limiteCredito)}
                  </option>
                ))}
              </select>

              {cliente && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Tasa:</span>{' '}
                    {(cliente.tasaInteres * 100).toFixed(2)}% {cliente.tipoTasa}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Moratoria:</span>{' '}
                    {(cliente.tasaMoratoria * 100).toFixed(2)}% {cliente.tipoTasa}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Corte día:</span> {cliente.diaCorte}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Pago día:</span> {cliente.diaPago}
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <span className="font-medium">Línea utilizada (capital):</span>{' '}
                    <span className="text-money">{fm(linea.utilizado)}</span>
                  </div>
                  <div className="bg-gray-50 rounded p-2" data-testid="linea-disponible">
                    <span className="font-medium">Línea disponible<HelpTip text={AYUDA_LINEA_DISPONIBLE} />:</span>{' '}
                    <span className={`text-money ${linea.disponible < 0 ? 'text-danger-700' : 'text-success-700'}`} data-monto>
                      {fm(Math.max(0, linea.disponible))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modalidad de pago */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-800">Modalidad de Pago
                <HelpTip text="Fin de mes / único: un solo pago en la fecha de pago del ciclo, con interés por los días transcurridos. Cuotas: método francés con cuotas mensuales iguales; solo disponible si todos los productos del carrito permiten cuotas." />
              </h2>
            </div>
            <div className="card-body space-y-3">
              <div className="flex gap-3">
                <label className={`flex-1 border-2 rounded-lg p-3 cursor-pointer transition-colors ${
                  modalidadPago === 'fin_de_mes'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    checked={modalidadPago === 'fin_de_mes'}
                    onChange={() => cambiarModalidad('fin_de_mes')}
                  />
                  <p className="font-medium text-sm">Fin de mes / Único</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pago único con interés diario</p>
                </label>
                <label className={`flex-1 border-2 rounded-lg p-3 transition-colors ${
                  cuotasBloqueadas
                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                    : modalidadPago === 'cuotas'
                    ? 'border-primary-500 bg-primary-50 cursor-pointer'
                    : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    disabled={cuotasBloqueadas}
                    checked={modalidadPago === 'cuotas'}
                    onChange={() => cambiarModalidad('cuotas')}
                  />
                  <p className="font-medium text-sm">Cuotas</p>
                  <p className="text-xs text-gray-500 mt-0.5">Método Francés Vencido</p>
                </label>
              </div>

              {cuotasBloqueadas && (
                <p className="flex items-start gap-2 text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {motivoCuotas}
                </p>
              )}

              {modalidadPago === 'cuotas' && cliente && (
                <div>
                  <label className="label">Número de cuotas<HelpTip text="Cantidad de cuotas mensuales, de 1 hasta el máximo de meses del cliente. La 1.ª cuota vence un mes después de la fecha de pago del ciclo; más cuotas = cuota menor pero más interés total." /></label>
                  <select
                    className="input"
                    value={numeroCuotas}
                    onChange={(e) => { setNumeroCuotas(Number(e.target.value)); setPreview(null); }}
                  >
                    {Array.from({ length: cliente.maxMeses }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses'}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Catálogo de productos */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4" /> Productos
                <HelpTip text="Busque por descripción o marca y agregue al carrito con +. El precio unitario depende de la modalidad: precio de contado para pago único, precio de crédito para cuotas." />
              </h2>
            </div>
            <div className="card-body space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Buscar producto..."
                  value={buscarProducto}
                  onChange={(e) => setBuscarProducto(e.target.value)}
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {productosFiltrados.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">
                    No hay productos.{' '}
                    <a href="/admin/productos" className="text-primary-600 underline">
                      Agregar productos
                    </a>
                  </p>
                ) : (
                  productosFiltrados.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-gray-100"
                    >
                      {p.imagenUrl ? (
                        <img src={p.imagenUrl} alt={p.descripcion} className="w-10 h-10 rounded object-cover mr-2 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-300 mr-2 flex-shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.descripcion}</p>
                        <p className="text-xs text-gray-500">
                          Contado: {fm(p.precioContado)} |
                          Crédito: {fm(p.precioCredito)}
                          {!p.permiteCuotas && ' | Sin cuotas'}
                        </p>
                      </div>
                      <button
                        onClick={() => agregarAlCarrito(p.id)}
                        className="ml-2 btn-primary btn-sm"
                        disabled={!clienteId}
                        title={!clienteId ? 'Selecciona primero un cliente' : ''}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Columna Derecha: Carrito + Preview ── */}
        <div className="space-y-4">
          {/* Carrito */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Carrito
                <HelpTip text="Productos de la venta con su cantidad. El total del carrito es el monto del crédito y se valida contra el límite disponible del cliente." />
              </h2>
              <span className="text-sm font-bold text-gray-900">
                {fm(totalCarrito)}
              </span>
            </div>
            <div className="card-body">
              {carrito.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  Agrega productos al carrito
                </p>
              ) : (
                <div className="space-y-2">
                  {carrito.map((item) => (
                    <div key={item.productoId} className="flex items-center gap-2">
                      {productos.find((p) => p.id === item.productoId)?.imagenUrl && (
                        <img
                          src={productos.find((p) => p.id === item.productoId)?.imagenUrl}
                          alt={item.descripcion}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.descripcion}</p>
                        <p className="text-xs text-gray-500">
                          {fm(item.precioUnitario)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cambiarCantidad(item.productoId, -1)}
                          className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(item.productoId, 1)}
                          className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => eliminarItem(item.productoId)}
                          className="w-6 h-6 flex items-center justify-center text-danger-500 hover:bg-danger-50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold w-20 text-right">
                        {fm(item.subtotal)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total Compra</span>
                    <span>{fm(totalCarrito)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validación y Preview Financiero */}
          {error && (
            <div className="flex items-start gap-2 bg-danger-50 text-danger-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            onClick={calcularPreview}
            className="btn-secondary w-full justify-center"
            disabled={carrito.length === 0 || !clienteId}
          >
            Calcular Condiciones Financieras
          </button>

          {preview && (
            <div className="card border-primary-200">
              <div className="card-header bg-primary-50">
                <h3 className="font-semibold text-primary-800">Vista Previa Financiera</h3>
              </div>
              <div className="card-body space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Monto Compra<HelpTip text="Suma de los subtotales del carrito, sin intereses, en la moneda del cliente." /></p>
                    <p className="font-semibold">{fm(totalCarrito)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Capital c/ Gracia<HelpTip text="Monto de la compra capitalizado con la TED durante los días de gracia: C′ = Monto × (1 + TED)^días. Es la base de las cuotas." /></p>
                    <p className="font-semibold">{fm(preview.capitalConGracia)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Días de Gracia<HelpTip text="Días calendario exactos entre la compra y la fecha de pago del ciclo (la hora de la compra no cuenta). Durante ellos solo corre interés compensatorio." /></p>
                    <p className="font-semibold">{preview.diasGracia} días</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Cuota Mensual<HelpTip text="Cuota nivelada del método francés vencido: R = C′ × TEM × (1+TEM)^n / ((1+TEM)^n − 1). La última cuota se ajusta por redondeo." /></p>
                    <p className="font-semibold text-primary-700">{fm(preview.cuotaMensual)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">TED<HelpTip text="Tasa efectiva diaria: (1+TEA)^(1/360) − 1, o (1 + TNA/m)^(1/d) − 1 si la tasa es nominal. Se muestra con 7 decimales." /></p>
                    <p className="font-mono">{formatearTasa(preview.ted)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">TEM<HelpTip text="Tasa efectiva mensual de 30 días: (1+TEA)^(30/360) − 1. Es la tasa de cada cuota." /></p>
                    <p className="font-mono">{formatearTasa(preview.tem)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">TCEA<HelpTip text="Tasa de costo efectivo anual: TIR diaria de los flujos (−monto en la compra, cuotas en sus fechas, meses de 30 días) llevada a 360 días: (1+TIRd)^360 − 1." /></p>
                    <p className="font-mono font-semibold">{formatearTasa(preview.tcea)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Pago del ciclo<HelpTip text="Fecha de pago del ciclo: hasta ella se capitaliza la deuda. En cuotas, la primera vence un mes después; en pago único, vence ese día." /></p>
                    <p className="font-semibold">{new Date(preview.fechaPagoCiclo).toLocaleDateString('es-PE')}</p>
                  </div>
                </div>

                {/* Cronograma */}
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Cronograma de Pagos</p>
                  <div className="table-wrapper">
                    <table className="table text-xs">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Vencimiento</th>
                          <th>Capital</th>
                          <th>Interés</th>
                          <th>Cuota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.cronograma.map((c) => (
                          <tr key={c.numeroCuota}>
                            <td>{c.numeroCuota}</td>
                            <td>{new Date(c.fechaVencimiento).toLocaleDateString('es-PE')}</td>
                            <td className="text-money">{fm(c.capital)}</td>
                            <td className="text-money">{fm(c.interes)}</td>
                            <td className="text-money font-semibold">{fm(c.cuota)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  onClick={confirmarVenta}
                  className="btn-primary w-full justify-center py-2.5"
                >
                  ✅ Confirmar y Registrar Crédito
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
