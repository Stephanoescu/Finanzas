// ============================================================
// CUADERNO DIGITAL DE CRÉDITOS — UTILIDADES FINANCIERAS
// financeUtils.ts
// ============================================================
//
// Todas las fórmulas siguen convención financiera:
//   - Tasas en DECIMAL (0.24 = 24%)
//   - Días en base 360 (año comercial / bancario)
//   - Meses de 30 días exactos
//   - Método Francés Vencido Simple Ordinario
//   - Capitalización compuesta para el período de gracia
//   - Mora compuesta sobre días exactos de atraso
//
// ============================================================

import type { TipoTasa, CuotaCronograma, ModalidadPago, Moneda } from '../types/models';
import { addMonths, differenceInDays, format, parseISO, startOfDay } from 'date-fns';

/** Formato ISO en hora local (sin zona), estable entre husos horarios. */
export function aISOLocal(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd'T'HH:mm:ss");
}

/** Días calendario exactos entre dos fechas, ignorando la hora del día. */
export function diasEntre(hasta: Date, desde: Date): number {
  return differenceInDays(startOfDay(hasta), startOfDay(desde));
}

// ─────────────────────────────────────────────────────────────
// 1. CONVERSIÓN DE TASAS
// ─────────────────────────────────────────────────────────────

/**
 * Tasa Efectiva del Período (TEP) para un plazo de `dias` días.
 * Es la ÚNICA fórmula de conversión de tasas del sistema.
 *
 * TNA: TEP(n) = (1 + TNA/m)^(n/d) − 1, con d = días por período de
 *      capitalización (1 = diaria, 30 = mensual) y m = 360/d.
 * TEA: TEP(n) = (1 + TEA)^(n/360) − 1
 *
 * @param tasa            Tasa anual en decimal (0.24 = 24%)
 * @param tipo            'TNA' | 'TEA'
 * @param dias            Plazo de la tasa resultante, en días
 * @param capitalizacion  d: días por período de capitalización (solo TNA). Por defecto 30.
 */
export function calcularTEP(
  tasa: number,
  tipo: TipoTasa,
  dias: number,
  capitalizacion = 30
): number {
  if (tipo === 'TEA') {
    return Math.pow(1 + tasa, dias / 360) - 1;
  }
  const d = capitalizacion > 0 ? capitalizacion : 30;
  const m = 360 / d;
  return Math.pow(1 + tasa / m, dias / d) - 1;
}

/** Tasa Efectiva Diaria: TEP de 1 día. */
export function calcularTED(tasa: number, tipo: TipoTasa, capitalizacion = 30): number {
  return calcularTEP(tasa, tipo, 1, capitalizacion);
}

/** Tasa Efectiva Mensual: TEP de 30 días. */
export function calcularTEM(tasa: number, tipo: TipoTasa, capitalizacion = 30): number {
  return calcularTEP(tasa, tipo, 30, capitalizacion);
}

/** Tasa Efectiva Anual: TEP de 360 días. */
export function calcularTEA(tasa: number, tipo: TipoTasa, capitalizacion = 30): number {
  return calcularTEP(tasa, tipo, 360, capitalizacion);
}

// ─────────────────────────────────────────────────────────────
// 2. INTERÉS DIARIO COMPUESTO (para pago a fin de mes / único)
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el monto total a pagar para un crédito de pago único
 * con capitalización compuesta por días exactos.
 *
 * Fórmula: M = C * (1 + TED)^días
 *
 * @param capital       Monto del crédito (o capital con gracia)
 * @param ted           Tasa Efectiva Diaria (decimal)
 * @param dias          Número de días transcurridos
 */
export function calcularMontoCompuesto(
  capital: number,
  ted: number,
  dias: number
): number {
  return capital * Math.pow(1 + ted, dias);
}

/**
 * Interés generado (solo el interés, sin devolver capital)
 * I = C * [(1 + TED)^días - 1]
 */
export function calcularInteresCompuesto(
  capital: number,
  ted: number,
  dias: number
): number {
  return capital * (Math.pow(1 + ted, dias) - 1);
}

// ─────────────────────────────────────────────────────────────
// 3. CAPITALIZACIÓN POR PERÍODO DE GRACIA
// ─────────────────────────────────────────────────────────────

/**
 * Capitaliza el monto original durante el período de gracia.
 * El resultado es el "Capital Efectivo" (C') que entra a la fórmula francesa.
 *
 * C' = Monto * (1 + TED)^días_de_gracia
 *
 * @param montoOriginal   Monto de compra sin intereses
 * @param ted             Tasa Efectiva Diaria
 * @param diasGracia      Días desde la fecha de compra hasta la fecha de primer pago
 */
export function capitalizarGracia(
  montoOriginal: number,
  ted: number,
  diasGracia: number
): number {
  if (diasGracia <= 0) return montoOriginal;
  return calcularMontoCompuesto(montoOriginal, ted, diasGracia);
}

// ─────────────────────────────────────────────────────────────
// 4. MÉTODO FRANCÉS — CUOTA NIVELADA
// ─────────────────────────────────────────────────────────────

/**
 * Calcula la cuota mensual nivelada (método francés vencido).
 *
 * Fórmula:
 *   R = C' * [ TEM * (1 + TEM)^n ] / [ (1 + TEM)^n - 1 ]
 *
 * @param capital   Capital efectivo (con gracia capitalizada)
 * @param tem       Tasa Efectiva Mensual (decimal)
 * @param n         Número de cuotas (meses)
 */
export function calcularCuotaFrancesa(
  capital: number,
  tem: number,
  n: number
): number {
  if (n <= 0) throw new Error('El número de cuotas debe ser mayor a 0');
  if (tem === 0) return capital / n; // Sin interés, cuota lineal

  const factor = Math.pow(1 + tem, n);
  return capital * (tem * factor) / (factor - 1);
}

// ─────────────────────────────────────────────────────────────
// 5. GENERACIÓN DEL CRONOGRAMA DE PAGOS (Tabla de Amortización)
// ─────────────────────────────────────────────────────────────

/**
 * Genera el cronograma completo de amortización por método francés.
 *
 * @param capital         Capital efectivo (con gracia capitalizada)
 * @param tem             Tasa Efectiva Mensual
 * @param n               Número de cuotas
 * @param fechaPagoCiclo Fecha ISO de pago del ciclo (hasta donde se capitaliza).
 *                       La cuota k vence en fechaPagoCiclo + k meses.
 */
export function generarCronograma(
  capital: number,
  tem: number,
  n: number,
  fechaPagoCiclo: string
): Omit<CuotaCronograma, 'mora' | 'totalPagar' | 'estado' | 'fechaPago' | 'montoPagado'>[] {
  const cuota = calcularCuotaFrancesa(capital, tem, n);
  const cronograma = [];
  let saldo = capital;
  const fechaBase = parseISO(fechaPagoCiclo);

  for (let i = 1; i <= n; i++) {
    const interesPeriodo = saldo * tem;
    const capitalPeriodo = cuota - interesPeriodo;

    // Ajuste de la última cuota por redondeo
    const cuotaReal = i === n ? saldo + interesPeriodo : cuota;
    const capitalReal = i === n ? saldo : capitalPeriodo;

    cronograma.push({
      numeroCuota: i,
      fechaVencimiento: aISOLocal(addMonths(fechaBase, i)),
      saldoInicial: redondear(saldo),
      interes: redondear(interesPeriodo),
      capital: redondear(capitalReal),
      cuota: redondear(cuotaReal),
    });

    saldo = redondear(i === n ? 0 : saldo - capitalReal);
  }

  return cronograma;
}

// ─────────────────────────────────────────────────────────────
// 6. CRONOGRAMA FIN DE MES (PAGO ÚNICO)
// ─────────────────────────────────────────────────────────────

/**
 * Genera un "cronograma" de 1 sola cuota para el modo fin_de_mes.
 * El interés se calcula por días exactos entre la compra y la fecha de pago.
 *
 * @param montoOriginal   Monto de compra
 * @param ted             Tasa Efectiva Diaria
 * @param diasGracia      Días entre compra y fecha de pago
 * @param fechaPago       Fecha de vencimiento del pago
 */
export function generarCronogramaFinMes(
  montoOriginal: number,
  ted: number,
  diasGracia: number,
  fechaPago: string
): Omit<CuotaCronograma, 'mora' | 'totalPagar' | 'estado' | 'fechaPago' | 'montoPagado'>[] {
  const montoTotal = calcularMontoCompuesto(montoOriginal, ted, diasGracia);
  const interes = montoTotal - montoOriginal;

  return [
    {
      numeroCuota: 1,
      fechaVencimiento: fechaPago,
      saldoInicial: redondear(montoOriginal),
      interes: redondear(interes),
      capital: redondear(montoOriginal),
      cuota: redondear(montoTotal),
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// 7. CÁLCULO DE MORA
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el interés moratorio por días exactos de atraso.
 *
 * Fórmula:
 *   Mora = Cuota_Vencida * [ (1 + TED_mora)^días_mora - 1 ]
 *
 * Nota: se aplica sobre el total de la cuota vencida (capital + interés).
 *
 * @param cuotaVencida    Monto total de la cuota (o saldo pendiente)
 * @param tedMora         Tasa Efectiva Diaria moratoria
 * @param diasMora        Días de atraso desde la fecha de vencimiento
 */
export function calcularMora(
  cuotaVencida: number,
  tedMora: number,
  diasMora: number
): number {
  if (diasMora <= 0) return 0;
  return cuotaVencida * (Math.pow(1 + tedMora, diasMora) - 1);
}

/**
 * Evalúa todas las cuotas de un cronograma y actualiza mora en tiempo real.
 *
 * @param cronograma    Cronograma de cuotas
 * @param tasaMora      Tasa moratoria (decimal, ej: 0.36)
 * @param tipoTasa      'TNA' | 'TEA'
 * @param fechaActual   Fecha actual del sistema (puede ser simulada)
 * @param capitalizacion Días por período de capitalización (solo TNA)
 */
export function aplicarMoraAlCronograma(
  cronograma: CuotaCronograma[],
  tasaMora: number,
  tipoTasa: TipoTasa,
  fechaActual: Date,
  capitalizacion = 30
): CuotaCronograma[] {
  const tedMora = calcularTED(tasaMora, tipoTasa, capitalizacion);

  return cronograma.map((cuota) => {
    // Cuota pagada: la mora quedó congelada a la fecha del pago
    if (cuota.estado === 'pagada' || cuota.estado === 'pagada_parcial') {
      return { ...cuota, totalPagar: redondear(cuota.cuota + cuota.mora) };
    }

    const fechaVenc = parseISO(cuota.fechaVencimiento);
    const diasMora = diasEntre(fechaActual, fechaVenc);
    const mora = diasMora > 0 ? calcularMora(cuota.cuota, tedMora, diasMora) : 0;
    const estado: CuotaCronograma['estado'] =
      diasMora > 0 ? 'vencida' : 'pendiente';

    return {
      ...cuota,
      mora: redondear(mora),
      totalPagar: redondear(cuota.cuota + mora),
      estado,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 8. LÓGICA DE FECHAS DE CORTE Y PAGO
// ─────────────────────────────────────────────────────────────

/**
 * Determina la fecha de corte y la FECHA DE PAGO DEL CICLO a partir de la
 * fecha de compra y la configuración del cliente.
 *
 * Regla:
 *   - Si día_compra <= día_corte → corte este mes → pago este mes
 *   - Si día_compra >  día_corte → corte y pago el mes siguiente
 *   - Si día_pago <= día_corte el pago cae un mes después del corte
 *
 * La fecha de pago del ciclo es hasta donde se capitaliza la deuda; la
 * primera cuota vence un mes después de ella.
 */
export function calcularFechasCorteYPago(
  fechaCompra: Date,
  diaCorte: number,
  diaPago: number
): { fechaCorte: Date; fechaPagoCiclo: Date } {
  const año = fechaCompra.getFullYear();
  const mes = fechaCompra.getMonth(); // 0-indexed
  const diaCompra = fechaCompra.getDate();

  const offset = diaCompra <= diaCorte ? 0 : 1;
  const fechaCorte = new Date(año, mes + offset, diaCorte);
  let fechaPagoCiclo = new Date(año, mes + offset, diaPago);

  if (diaPago <= diaCorte) {
    fechaPagoCiclo = addMonths(fechaPagoCiclo, 1);
  }

  return { fechaCorte, fechaPagoCiclo };
}

/**
 * Días de gracia: días calendario exactos entre la fecha de compra y la
 * fecha de pago del ciclo (se ignora la hora de la compra).
 */
export function calcularDiasGracia(
  fechaCompra: Date,
  fechaPagoCiclo: Date
): number {
  return diasEntre(fechaPagoCiclo, fechaCompra);
}

// ─────────────────────────────────────────────────────────────
// 8.b TCEA (Tasa de Costo Efectivo Anual)
// ─────────────────────────────────────────────────────────────

export interface FlujoCredito {
  /** Días transcurridos desde la fecha de compra */
  dias: number;
  monto: number;
}

/**
 * TCEA = (1 + TIRd)^360 − 1, donde TIRd es la tasa diaria que iguala
 * el desembolso (monto de la compra, día 0) con el valor presente de los
 * pagos. Se resuelve por bisección.
 */
export function calcularTCEA(montoDesembolso: number, flujos: FlujoCredito[]): number {
  const vp = (r: number) =>
    flujos.reduce((sum, f) => sum + f.monto / Math.pow(1 + r, f.dias), 0) - montoDesembolso;

  let lo = -0.5;
  let hi = 1;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    // El valor presente decrece al subir la tasa
    if (vp(mid) > 0) lo = mid;
    else hi = mid;
  }
  const tirDiaria = (lo + hi) / 2;
  return Math.pow(1 + tirDiaria, 360) - 1;
}

/**
 * TCEA de una transacción ya registrada, usando su cronograma.
 * Convención del sistema: cada cuota k cae a diasGracia + 30·k días de la compra
 * (meses de 30 días); el pago único cae a diasGracia.
 */
export function calcularTCEATransaccion(
  montoOriginal: number,
  diasGracia: number,
  modalidadPago: ModalidadPago,
  cronograma: { numeroCuota: number; cuota: number }[]
): number {
  const flujos = cronograma.map((c) => ({
    dias: modalidadPago === 'fin_de_mes' ? diasGracia : diasGracia + 30 * c.numeroCuota,
    monto: c.cuota,
  }));
  return calcularTCEA(montoOriginal, flujos);
}

// ─────────────────────────────────────────────────────────────
// 8.c PRELACIÓN DE PAGOS
// ─────────────────────────────────────────────────────────────

/**
 * Imputa un pago en el orden legal: mora → interés compensatorio → capital.
 * El capital absorbe el remanente (evita descuadres de centavos).
 */
export function aplicarPrelacion(
  montoPagado: number,
  mora: number,
  interes: number
): { desgloseMora: number; desgloseInteres: number; desgloseCapital: number } {
  const desgloseMora = redondear(Math.min(montoPagado, mora));
  const restoInteres = montoPagado - desgloseMora;
  const desgloseInteres = redondear(Math.min(restoInteres, interes));
  const desgloseCapital = redondear(Math.max(0, restoInteres - desgloseInteres));
  return { desgloseMora, desgloseInteres, desgloseCapital };
}

// ─────────────────────────────────────────────────────────────
// 9. FUNCIÓN PRINCIPAL: CONSTRUIR TRANSACCIÓN COMPLETA
// ─────────────────────────────────────────────────────────────

export interface ParamsTransaccion {
  montoOriginal: number;
  tipoTasa: TipoTasa;
  capitalizacion?: number;
  tasaInteres: number;
  tasaMoratoria: number;
  modalidadPago: ModalidadPago;
  numeroCuotas: number;
  diaCorte: number;
  diaPago: number;
  fechaCompra: Date;
}

export interface ResultadoTransaccion {
  fechaCorte: string;
  /** Fecha de pago del ciclo: hasta donde se capitaliza la deuda */
  fechaPagoCiclo: string;
  /** Vencimiento real de la 1ra cuota (pagoCiclo + 1 mes; = pagoCiclo en pago único) */
  fechaPrimeraCuota: string;
  diasGracia: number;
  capitalConGracia: number;
  cuotaMensual: number;
  ted: number;
  tem: number;
  tcea: number;
  cronograma: Omit<CuotaCronograma, 'mora' | 'totalPagar' | 'estado' | 'fechaPago' | 'montoPagado'>[];
}

/**
 * Función central que calcula todos los valores financieros de una transacción.
 * Devuelve todos los datos necesarios para persistir en la Transaccion.
 */
export function construirTransaccion(params: ParamsTransaccion): ResultadoTransaccion {
  const {
    montoOriginal,
    tipoTasa,
    tasaInteres,
    modalidadPago,
    numeroCuotas,
    diaCorte,
    diaPago,
    fechaCompra,
    capitalizacion = 30,
  } = params;

  const ted = calcularTED(tasaInteres, tipoTasa, capitalizacion);
  const tem = calcularTEM(tasaInteres, tipoTasa, capitalizacion);

  const { fechaCorte, fechaPagoCiclo } = calcularFechasCorteYPago(
    fechaCompra,
    diaCorte,
    diaPago
  );

  const diasGracia = calcularDiasGracia(fechaCompra, fechaPagoCiclo);
  const capitalConGracia = capitalizarGracia(montoOriginal, ted, diasGracia);
  const isoPagoCiclo = aISOLocal(fechaPagoCiclo);

  let cronograma: ReturnType<typeof generarCronograma>;
  let tcea: number;

  if (modalidadPago === 'fin_de_mes') {
    // Pago único: vence en la fecha de pago del ciclo
    cronograma = generarCronogramaFinMes(montoOriginal, ted, diasGracia, isoPagoCiclo);
    tcea = calcularTCEA(montoOriginal, [
      { dias: diasGracia, monto: calcularMontoCompuesto(montoOriginal, ted, diasGracia) },
    ]);
  } else {
    cronograma = generarCronograma(capitalConGracia, tem, numeroCuotas, isoPagoCiclo);
    // TCEA con flujos sin redondear, meses de 30 días
    const cuotaExacta = calcularCuotaFrancesa(capitalConGracia, tem, numeroCuotas);
    tcea = calcularTCEA(
      montoOriginal,
      Array.from({ length: numeroCuotas }, (_, i) => ({
        dias: diasGracia + 30 * (i + 1),
        monto: cuotaExacta,
      }))
    );
  }

  return {
    fechaCorte: aISOLocal(fechaCorte),
    fechaPagoCiclo: isoPagoCiclo,
    fechaPrimeraCuota: cronograma[0].fechaVencimiento,
    diasGracia,
    capitalConGracia: redondear(capitalConGracia),
    cuotaMensual: redondear(cronograma[0].cuota),
    ted,
    tem,
    tcea,
    cronograma,
  };
}

// ─────────────────────────────────────────────────────────────
// 10. UTILIDADES GENERALES
// ─────────────────────────────────────────────────────────────

/**
 * Redondea un número a 2 decimales (estándar financiero).
 */
export function redondear(valor: number, decimales = 2): number {
  const factor = Math.pow(10, decimales);
  return Math.round(valor * factor) / factor;
}

/**
 * Formatea un número como moneda (sin símbolo, para ser flexible).
 * Ej: 1234.5 → "1,234.50"
 */
export function formatearMonto(valor: number, locale = 'es-PE'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Símbolo de la moneda: PEN → "S/", USD → "US$". */
export function simboloMoneda(moneda: Moneda | undefined): string {
  return moneda === 'USD' ? 'US$' : 'S/';
}

/** Monto con símbolo de moneda y 2 decimales. Ej: "S/ 1,234.50" */
export function formatearMoneda(valor: number, moneda: Moneda | undefined): string {
  return `${simboloMoneda(moneda)} ${formatearMonto(valor)}`;
}

/**
 * Formatea una tasa decimal como porcentaje para display.
 * Ej: 0.24 → "24.0000000%" (7 decimales por defecto: TED, TEM, TCEA)
 */
export function formatearTasa(tasa: number, decimales = 7): string {
  return `${(tasa * 100).toFixed(decimales)}%`;
}

/**
 * Calcula el saldo utilizado total de un cliente
 * sumando los saldos pendientes de capital de todas sus transacciones vigentes.
 */
export function calcularSaldoUtilizado(
  cronogramas: CuotaCronograma[][]
): number {
  return cronogramas.reduce((totalCredito, cronograma) => {
    const saldoPendiente = cronograma
      .filter((c) => c.estado !== 'pagada')
      .reduce((sum, c) => sum + c.capital, 0);
    return totalCredito + saldoPendiente;
  }, 0);
}

/**
 * Verifica si una compra excede el límite de crédito del cliente.
 *
 * @param saldoActualUtilizado  Saldo ya comprometido del cliente
 * @param montoNuevaCompra      Monto de la nueva compra
 * @param limiteCredito         Límite de crédito del cliente
 */
export function validarLimiteCredito(
  saldoActualUtilizado: number,
  montoNuevaCompra: number,
  limiteCredito: number
): { aprobado: boolean; saldoDisponible: number; exceso: number } {
  const saldoDisponible = limiteCredito - saldoActualUtilizado;
  const exceso = montoNuevaCompra - saldoDisponible;
  return {
    aprobado: montoNuevaCompra <= saldoDisponible,
    saldoDisponible: redondear(saldoDisponible),
    exceso: redondear(Math.max(0, exceso)),
  };
}

/**
 * Genera un resumen financiero de una cuota con mora al día de hoy.
 *
 * @param cuota         CuotaCronograma con campos base
 * @param tasaMora      Tasa moratoria (decimal)
 * @param tipoTasa      'TNA' | 'TEA'
 * @param fechaActual   Fecha del sistema (puede ser simulada)
 */
export function evaluarCuotaConMora(
  cuota: CuotaCronograma,
  tasaMora: number,
  tipoTasa: TipoTasa,
  fechaActual: Date,
  capitalizacion = 30
): CuotaCronograma {
  if (cuota.estado === 'pagada') {
    return { ...cuota, totalPagar: redondear(cuota.cuota + cuota.mora) };
  }

  const tedMora = calcularTED(tasaMora, tipoTasa, capitalizacion);
  const diasMora = Math.max(0, diasEntre(fechaActual, parseISO(cuota.fechaVencimiento)));
  const mora = calcularMora(cuota.cuota, tedMora, diasMora);
  const estado: CuotaCronograma['estado'] =
    diasMora > 0 ? 'vencida' : 'pendiente';

  return {
    ...cuota,
    mora: redondear(mora),
    totalPagar: redondear(cuota.cuota + mora),
    estado,
  };
}
