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

import type { TipoTasa, CuotaCronograma, ModalidadPago } from '../types/models';
import { addMonths, differenceInDays, format } from 'date-fns';

// ─────────────────────────────────────────────────────────────
// 1. CONVERSIÓN DE TASAS
// ─────────────────────────────────────────────────────────────

/**
 * Calcula la Tasa Efectiva Diaria (TED) a partir de la tasa pactada.
 *
 * Si TNA: TED = TNA / 360
 * Si TEA: TED = (1 + TEA)^(1/360) - 1
 *
 * @param tasa    Tasa en decimal (ej: 0.24 para 24%)
 * @param tipo    'TNA' | 'TEA'
 */
export function calcularTED(tasa: number, tipo: TipoTasa): number {
  if (tipo === 'TNA') {
    return tasa / 360;
  }
  // TEA → TED
  return Math.pow(1 + tasa, 1 / 360) - 1;
}

/**
 * Calcula la Tasa Efectiva Mensual (TEM) a partir de la tasa pactada.
 *
 * Si TNA: TEM = TNA / 12
 * Si TEA: TEM = (1 + TEA)^(30/360) - 1
 *
 * @param tasa    Tasa en decimal
 * @param tipo    'TNA' | 'TEA'
 */
export function calcularTEM(tasa: number, tipo: TipoTasa): number {
  if (tipo === 'TNA') {
    return tasa / 12;
  }
  // TEA → TEM (equivalencia por 30/360)
  return Math.pow(1 + tasa, 30 / 360) - 1;
}

/**
 * Convierte cualquier tasa a TEA para referencia o display.
 */
export function calcularTEA(tasa: number, tipo: TipoTasa): number {
  if (tipo === 'TEA') return tasa;
  // TNA → TEA: capitalización mensual de 12 períodos
  const tem = tasa / 12;
  return Math.pow(1 + tem, 12) - 1;
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
 * @param fechaPrimerPago Fecha ISO de la primera cuota
 */
export function generarCronograma(
  capital: number,
  tem: number,
  n: number,
  fechaPrimerPago: string
): Omit<CuotaCronograma, 'mora' | 'totalPagar' | 'estado' | 'fechaPago' | 'montoPagado'>[] {
  const cuota = calcularCuotaFrancesa(capital, tem, n);
  const cronograma = [];
  let saldo = capital;
  const fechaBase = new Date(fechaPrimerPago);

  for (let i = 1; i <= n; i++) {
    const interesPeriodo = saldo * tem;
    const capitalPeriodo = cuota - interesPeriodo;

    // Ajuste de la última cuota por redondeo
    const cuotaReal = i === n ? saldo + interesPeriodo : cuota;
    const capitalReal = i === n ? saldo : capitalPeriodo;

    cronograma.push({
      numeroCuota: i,
      fechaVencimiento: format(addMonths(fechaBase, i - 1), "yyyy-MM-dd'T'HH:mm:ss"),
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
 */
export function aplicarMoraAlCronograma(
  cronograma: CuotaCronograma[],
  tasaMora: number,
  tipoTasa: TipoTasa,
  fechaActual: Date
): CuotaCronograma[] {
  const tedMora = calcularTED(tasaMora, tipoTasa);

  return cronograma.map((cuota) => {
    // Solo aplica mora a cuotas pendientes o vencidas no pagadas
    if (cuota.estado === 'pagada' || cuota.estado === 'pagada_parcial') {
      return { ...cuota, totalPagar: cuota.cuota + cuota.mora };
    }

    const fechaVenc = new Date(cuota.fechaVencimiento);
    const diasMora = differenceInDays(fechaActual, fechaVenc);
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
 * Determina la PRÓXIMA fecha de corte y fecha de pago,
 * a partir de la fecha de compra y la configuración del cliente.
 *
 * Regla:
 *   - Si fecha_compra <= dia_corte del mes actual → corte este mes → pago este mes
 *   - Si fecha_compra > dia_corte del mes actual → corte el mes que viene → pago el mes que viene
 *
 * @param fechaCompra   Fecha de la compra (objeto Date)
 * @param diaCorte      Día del mes de corte (ej: 20)
 * @param diaPago       Día del mes de pago (ej: 26)
 */
export function calcularFechasCorteYPago(
  fechaCompra: Date,
  diaCorte: number,
  diaPago: number
): { fechaCorte: Date; fechaPrimerPago: Date } {
  const año = fechaCompra.getFullYear();
  const mes = fechaCompra.getMonth(); // 0-indexed
  const diaCompra = fechaCompra.getDate();

  let fechaCorte: Date;
  let fechaPrimerPago: Date;

  if (diaCompra <= diaCorte) {
    // Entra al corte de ESTE mes
    fechaCorte = new Date(año, mes, diaCorte);
    fechaPrimerPago = new Date(año, mes, diaPago);
  } else {
    // Pasa al corte del MES SIGUIENTE
    fechaCorte = new Date(año, mes + 1, diaCorte);
    fechaPrimerPago = new Date(año, mes + 1, diaPago);
  }

  // Edge case: si diaPago <= diaCorte (ej: pago día 5 y corte día 20),
  // el pago es en el mes POSTERIOR al corte.
  if (diaPago <= diaCorte) {
    fechaPrimerPago = addMonths(fechaPrimerPago, 1);
  }

  return { fechaCorte, fechaPrimerPago };
}

/**
 * Calcula los días de gracia entre la fecha de compra y la fecha de primer pago.
 * En este sistema = días exactos entre compra y fechaPrimerPago.
 */
export function calcularDiasGracia(
  fechaCompra: Date,
  fechaPrimerPago: Date
): number {
  return differenceInDays(fechaPrimerPago, fechaCompra);
}

// ─────────────────────────────────────────────────────────────
// 9. FUNCIÓN PRINCIPAL: CONSTRUIR TRANSACCIÓN COMPLETA
// ─────────────────────────────────────────────────────────────

export interface ParamsTransaccion {
  montoOriginal: number;
  tipoTasa: TipoTasa;
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
  fechaPrimerPago: string;
  diasGracia: number;
  capitalConGracia: number;
  cuotaMensual: number;
  ted: number;
  tem: number;
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
  } = params;

  const ted = calcularTED(tasaInteres, tipoTasa);
  const tem = calcularTEM(tasaInteres, tipoTasa);

  const { fechaCorte, fechaPrimerPago } = calcularFechasCorteYPago(
    fechaCompra,
    diaCorte,
    diaPago
  );

  const diasGracia = calcularDiasGracia(fechaCompra, fechaPrimerPago);
  const capitalConGracia = capitalizarGracia(montoOriginal, ted, diasGracia);

  let cronograma: ReturnType<typeof generarCronograma>;
  let cuotaMensual: number;

  if (modalidadPago === 'fin_de_mes' || numeroCuotas === 1) {
    cronograma = generarCronogramaFinMes(
      montoOriginal,
      ted,
      diasGracia,
      fechaPrimerPago.toISOString()
    );
    cuotaMensual = cronograma[0].cuota;
  } else {
    cronograma = generarCronograma(
      capitalConGracia,
      tem,
      numeroCuotas,
      fechaPrimerPago.toISOString()
    );
    cuotaMensual = cronograma[0].cuota;
  }

  return {
    fechaCorte: fechaCorte.toISOString(),
    fechaPrimerPago: fechaPrimerPago.toISOString(),
    diasGracia,
    capitalConGracia: redondear(capitalConGracia),
    cuotaMensual: redondear(cuotaMensual),
    ted,
    tem,
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

/**
 * Formatea una tasa decimal como porcentaje para display.
 * Ej: 0.24 → "24.00%"
 */
export function formatearTasa(tasa: number, decimales = 2): string {
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
  fechaActual: Date
): CuotaCronograma {
  if (cuota.estado === 'pagada') {
    return { ...cuota, mora: 0, totalPagar: cuota.cuota };
  }

  const tedMora = calcularTED(tasaMora, tipoTasa);
  const fechaVenc = new Date(cuota.fechaVencimiento);
  const diasMora = Math.max(0, differenceInDays(fechaActual, fechaVenc));
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
