// ============================================================
// CUADERNO DIGITAL DE CRÉDITOS — MODELOS DE DATOS
// ============================================================

// ─── ENUMERACIONES ──────────────────────────────────────────

export type UserRole = 'superadmin' | 'admin_tienda' | 'cliente';

/** Tipo de tasa de interés pactada con el cliente */
export type TipoTasa = 'TNA' | 'TEA'; // Nominal Anual | Efectiva Anual

/** Moneda en la que opera un cliente */
export type Moneda = 'PEN' | 'USD';

/** Modalidad de pago de una transacción */
export type ModalidadPago = 'fin_de_mes' | 'cuotas';

/** Estado de un cronograma de cuota */
export type EstadoCuota = 'pendiente' | 'pagada' | 'vencida' | 'pagada_parcial';

/** Estado general de una transacción de crédito */
export type EstadoCredito =
  | 'vigente'       // Al corriente
  | 'en_mora'       // Con días vencidos
  | 'liquidado'     // Pagado totalmente
  | 'castigado';    // Incobrable / dado de baja

// ─── SUPERADMIN ──────────────────────────────────────────────

export interface SuperAdmin {
  id: string;
  username: string;
  passwordHash: string; // En prod usar bcrypt; aquí SHA-256 o plain para demo
  email: string;
  creadoEn: string; // ISO 8601
}

// ─── TIENDA ──────────────────────────────────────────────────

export interface Tienda {
  id: string;
  nombre: string;
  giro: string;             // Ej: "Bodega", "Carnicería", "Peluquería"
  direccion?: string;
  telefono?: string;
  logoUrl?: string;
  activa: boolean;
  /** Tasa máxima BCRP (TEA, decimal). Tope para tasas compensatoria y moratoria de clientes. */
  tasaMaxBCRP?: number;
  creadaEn: string;         // ISO 8601
  adminId: string;          // Referencia al AdminTienda
}

// ─── USUARIO / ADMIN DE TIENDA ───────────────────────────────

export interface Usuario {
  id: string;
  tiendaId: string;         // A qué tienda pertenece (vacío si superadmin)
  rol: UserRole;
  username: string;
  passwordHash: string;
  nombreCompleto: string;
  email?: string;
  telefono?: string;
  activo: boolean;
  creadoEn: string;
}

// ─── PRODUCTO ────────────────────────────────────────────────

export interface Producto {
  id: string;
  tiendaId: string;
  proveedor?: string;
  marca?: string;
  descripcion: string;
  unidad: string;           // Ej: "kg", "lt", "unidad", "docena"
  precioContado: number;    // Precio de venta al contado
  precioCredito: number;    // Precio de venta a crédito (puede diferir)
  permiteCuotas: boolean;   // Toggle: ¿Se puede financiar en meses?
  imagenUrl?: string;       // URL o data URL (imagen pequeña subida)
  activo: boolean;
  creadoEn: string;
}

// ─── CLIENTE ─────────────────────────────────────────────────

export interface Cliente {
  id: string;
  tiendaId: string;

  // Datos personales
  nombreCompleto: string;
  dni?: string;             // Documento de identidad
  telefono?: string;
  direccion?: string;
  email?: string;

  // Credenciales de acceso (rol: cliente)
  username: string;
  passwordHash: string;

  // Configuración financiera
  moneda: Moneda;           // 'PEN' (por defecto) | 'USD'
  tipoTasa: TipoTasa;       // 'TNA' o 'TEA'
  /** Días por período de capitalización de la TNA (1 = diaria, 30 = mensual). Por defecto 30. */
  capitalizacion: number;
  tasaInteres: number;      // En decimal (ej: 0.24 = 24%)
  tasaMoratoria: number;    // En decimal (ej: 0.36 = 36% anual)
  limiteCredito: number;    // Monto máximo de línea
  maxMeses: number;         // Máximo de meses a financiar

  // Fechas de ciclo de facturación
  diaCorte: number;         // Día del mes en que cierra el período (ej: 20)
  diaPago: number;          // Día del mes en que vence el pago (ej: 26)

  saldoUtilizado: number;   // Calculado: suma de saldos pendientes
  activo: boolean;
  creadoEn: string;
}

// ─── ÍTEM DE COMPRA ──────────────────────────────────────────

export interface ItemCompra {
  productoId: string;
  descripcion: string;      // Snapshot del nombre al momento de compra
  cantidad: number;
  precioUnitario: number;   // Snapshot del precio al momento de compra
  subtotal: number;         // cantidad * precioUnitario
}

// ─── TRANSACCIÓN DE CRÉDITO ──────────────────────────────────

/**
 * Representa una compra a crédito.
 * Si modalidadPago = 'fin_de_mes': un solo pago con interés compuesto diario.
 * Si modalidadPago = 'cuotas': usa Método Francés con período de gracia.
 */
export interface Transaccion {
  id: string;
  tiendaId: string;
  clienteId: string;

  // Detalle de compra
  fechaCompra: string;      // ISO 8601 — fecha real de la operación
  items: ItemCompra[];
  montoOriginal: number;    // Suma de subtotales (sin intereses)

  // Configuración financiera al momento de la compra (snapshot)
  moneda?: Moneda;          // Snapshot (ausente en datos antiguos → PEN)
  tipoTasa: TipoTasa;
  capitalizacion?: number;  // Snapshot (ausente en datos antiguos → 30)
  tasaInteres: number;      // Decimal
  tasaMoratoria: number;    // Decimal

  // Modalidad
  modalidadPago: ModalidadPago;
  numeroCuotas: number;     // 1 si es fin_de_mes

  // Fechas calculadas
  fechaCorte: string;       // ISO: próxima fecha de corte
  fechaPagoCiclo: string;   // ISO: fecha de pago del ciclo (hasta donde se capitaliza la deuda)
  fechaPrimeraCuota: string; // ISO: vencimiento real de la 1ra cuota (pagoCiclo + 1 mes; = pagoCiclo en pago único)
  diasGracia: number;       // Días entre compra y fecha de pago del ciclo
  tcea?: number;            // TCEA de la operación (decimal)

  // Capitalización por gracia (C efectivo para la fórmula francesa)
  capitalConGracia: number; // montoOriginal * (1 + TED)^diasGracia

  // Cuota mensual calculada (método francés)
  cuotaMensual: number;     // 0 si fin_de_mes

  // Cronograma de pagos
  cronograma: CuotaCronograma[];

  // Estado
  estado: EstadoCredito;
  notas?: string;
  creadoEn: string;
}

// ─── CUOTA DEL CRONOGRAMA ────────────────────────────────────

export interface CuotaCronograma {
  numeroCuota: number;      // 1, 2, 3...
  fechaVencimiento: string; // ISO: cuándo vence esta cuota
  saldoInicial: number;     // Saldo al inicio del período
  interes: number;          // Interés del período
  capital: number;          // Amortización de capital
  cuota: number;            // capital + interes (cuota nivelada método francés)
  mora: number;             // Interés moratorio acumulado (se calcula en tiempo real)
  totalPagar: number;       // cuota + mora
  estado: EstadoCuota;
  fechaPago?: string;       // ISO: cuándo se pagó realmente (si pagada)
  montoPagado?: number;     // Cuánto se pagó
}

// ─── PAGO / ABONO ────────────────────────────────────────────

export interface Pago {
  id: string;
  tiendaId: string;
  clienteId: string;
  transaccionId: string;
  numeroCuota: number;      // A qué cuota se aplica
  fechaPago: string;        // ISO: fecha real del pago
  montoPagado: number;
  desgloseCapital: number;
  desgloseInteres: number;
  desgloseMora: number;
  notas?: string;
  registradoPor: string;    // userId del admin que registró
  creadoEn: string;
}

// ─── ESTADO DE CUENTA (Snapshot para mostrar) ────────────────

export interface EstadoCuenta {
  clienteId: string;
  tiendaId: string;
  fechaCorte: string;       // La fecha de corte usada para este estado
  fechaGeneracion: string;  // Cuándo se generó (fecha simulada)
  lineaCredito: number;
  saldoUtilizado: number;
  saldoDisponible: number;
  transacciones: ResumenTransaccion[];
  totalDeuda: number;
  totalMora: number;
  totalAPagar: number;      // totalDeuda + totalMora
}

export interface ResumenTransaccion {
  transaccionId: string;
  fechaCompra: string;
  items: ItemCompra[];
  montoOriginal: number;
  capitalConGracia: number;
  cuotasVencidas: CuotaCronograma[];
  cuotasPendientes: CuotaCronograma[];
  interesesMora: number;
  estado: EstadoCredito;
}

// ─── ESTRUCTURA ROOT DE LOCALSTORAGE ────────────────────────

/**
 * Clave raíz del localStorage.
 * Toda la persistencia se guarda bajo "cdc_data" como JSON.
 */
export interface AppData {
  version: string;          // Para migraciones futuras
  superAdmins: SuperAdmin[];
  tiendas: Tienda[];
  usuarios: Usuario[];      // Admins de tienda
  clientes: Cliente[];
  productos: Producto[];
  transacciones: Transaccion[];
  pagos: Pago[];
  ultimaActualizacion: string;
}

// ─── SESIÓN ACTIVA (No persiste en localStorage) ─────────────

export interface SesionActiva {
  userId: string;
  tiendaId?: string;        // Vacío si superadmin
  rol: UserRole;
  nombreCompleto: string;
}

