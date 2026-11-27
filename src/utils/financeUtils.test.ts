import { describe, it, expect } from 'vitest';
import { format, parseISO } from 'date-fns';
import {
  construirTransaccion,
  calcularTCEA,
  calcularCuotaFrancesa,
  calcularTED,
  calcularTEM,
  calcularTEA,
  calcularMora,
  aplicarPrelacion,
  aplicarMoraAlCronograma,
  redondear,
  precioSegunModalidad,
  calcularCapitalPendiente,
  calcularLineaDisponible,
} from './financeUtils';
import type { CuotaCronograma, Transaccion } from '../types/models';

const base = {
  tipoTasa: 'TEA' as const,
  tasaInteres: 0.3,
  tasaMoratoria: 0.5,
  diaCorte: 20,
  diaPago: 26,
};

const fechas = (r: ReturnType<typeof construirTransaccion>) =>
  r.cronograma.map((c) => format(parseISO(c.fechaVencimiento), 'yyyy-MM-dd'));

describe('Caso del enunciado (3 cuotas, compra 15/09/2026, S/ 300)', () => {
  const r = construirTransaccion({
    ...base,
    montoOriginal: 300,
    modalidadPago: 'cuotas',
    numeroCuotas: 3,
    fechaCompra: new Date(2026, 8, 15),
  });

  it('11 días de gracia y C′ = 302.41', () => {
    expect(r.diasGracia).toBe(11);
    expect(r.capitalConGracia).toBe(302.41);
  });
  it('cuota R = 105.29 y última 105.30', () => {
    expect(r.cronograma[0].cuota).toBe(105.29);
    expect(r.cronograma[1].cuota).toBe(105.29);
    expect(r.cronograma[2].cuota).toBe(105.3);
  });
  it('vencen 26/10, 26/11 y 26/12/2026 (un mes después del pago del ciclo)', () => {
    expect(fechas(r)).toEqual(['2026-10-26', '2026-11-26', '2026-12-26']);
    expect(format(parseISO(r.fechaPagoCiclo), 'yyyy-MM-dd')).toBe('2026-09-26');
    expect(format(parseISO(r.fechaPrimeraCuota), 'yyyy-MM-dd')).toBe('2026-10-26');
  });
});

describe('Pago único', () => {
  it('compra 10/11/2026 10:00, S/ 72 → vence 26/11, 16 días, total 72.84', () => {
    const r = construirTransaccion({
      ...base,
      montoOriginal: 72,
      modalidadPago: 'fin_de_mes',
      numeroCuotas: 1,
      fechaCompra: new Date(2026, 10, 10, 10, 0, 0),
    });
    expect(fechas(r)).toEqual(['2026-11-26']);
    expect(r.diasGracia).toBe(16);
    expect(r.cronograma[0].cuota).toBe(72.84);
  });

  it('compra después del corte: 22/11/2026, S/ 200 → vence 26/12, 34 días', () => {
    const r = construirTransaccion({
      ...base,
      montoOriginal: 200,
      modalidadPago: 'fin_de_mes',
      numeroCuotas: 1,
      fechaCompra: new Date(2026, 10, 22),
    });
    expect(fechas(r)).toEqual(['2026-12-26']);
    expect(r.diasGracia).toBe(34);
  });
});

describe('3 cuotas, compra 10/11/2026, S/ 450', () => {
  const r = construirTransaccion({
    ...base,
    montoOriginal: 450,
    modalidadPago: 'cuotas',
    numeroCuotas: 3,
    fechaCompra: new Date(2026, 10, 10),
  });

  it('días 16, C′ 455.28, R 158.52, vencimientos 26/12, 26/01, 26/02', () => {
    expect(r.diasGracia).toBe(16);
    expect(r.capitalConGracia).toBe(455.28);
    expect(r.cronograma[0].cuota).toBe(158.52);
    expect(fechas(r)).toEqual(['2026-12-26', '2027-01-26', '2027-02-26']);
  });

  it('TCEA con meses de 30 días ≈ 30.0000000 %', () => {
    expect(r.tcea).toBeCloseTo(0.3, 6);
    // Recalculada a mano con los flujos exactos
    const ted = calcularTED(0.3, 'TEA');
    const cPrima = 450 * Math.pow(1 + ted, 16);
    const R = calcularCuotaFrancesa(cPrima, calcularTEM(0.3, 'TEA'), 3);
    const tcea = calcularTCEA(450, [46, 76, 106].map((dias) => ({ dias, monto: R })));
    expect(Math.abs(tcea - 0.3)).toBeLessThan(1e-6);
  });
});

describe('Mora', () => {
  it('cuota 72.84 con 9 días de atraso, TEA 50 % → 0.74', () => {
    const ted = calcularTED(0.5, 'TEA');
    expect(redondear(calcularMora(72.84, ted, 9))).toBe(0.74);
    expect(72.84 * (Math.pow(1.5, 9 / 360) - 1)).toBeCloseTo(0.74, 2);
  });

  it('los días de atraso ignoran la hora del día', () => {
    const cron = [
      {
        numeroCuota: 1, fechaVencimiento: '2026-11-26T00:00:00', saldoInicial: 72.84,
        interes: 0.84, capital: 72, cuota: 72.84, mora: 0, totalPagar: 72.84,
        estado: 'pendiente' as const,
      },
    ];
    const r = aplicarMoraAlCronograma(cron, 0.5, 'TEA', new Date(2026, 11, 5, 8, 30));
    expect(r[0].mora).toBe(0.74); // 9 días, no 8
  });

  it('una cuota pagada conserva la mora congelada', () => {
    const cron = [
      {
        numeroCuota: 1, fechaVencimiento: '2026-11-26T00:00:00', saldoInicial: 72.84,
        interes: 0.84, capital: 72, cuota: 72.84, mora: 0.5, totalPagar: 73.34,
        estado: 'pagada' as const,
      },
    ];
    const r = aplicarMoraAlCronograma(cron, 0.5, 'TEA', new Date(2027, 5, 1));
    expect(r[0].mora).toBe(0.5);
    expect(r[0].totalPagar).toBe(73.34);
  });
});

describe('Prelación de pagos', () => {
  it('mora → interés → capital', () => {
    expect(aplicarPrelacion(73.58, 0.74, 0.84)).toEqual({
      desgloseMora: 0.74,
      desgloseInteres: 0.84,
      desgloseCapital: 72,
    });
  });
  it('un monto menor se imputa primero a la mora', () => {
    expect(aplicarPrelacion(0.5, 0.74, 0.84)).toEqual({
      desgloseMora: 0.5,
      desgloseInteres: 0,
      desgloseCapital: 0,
    });
  });
});

describe('Tasa nominal coherente', () => {
  it('TNA 24 % capitalización mensual → TEM 2.0000000 %, TEA 26.8241795 %', () => {
    expect(calcularTEM(0.24, 'TNA', 30) * 100).toBeCloseTo(2.0, 7);
    expect(calcularTEA(0.24, 'TNA', 30) * 100).toBeCloseTo(26.8241795, 7);
  });
  it('TNA con capitalización diaria: TED = TNA/360', () => {
    expect(calcularTED(0.36, 'TNA', 1)).toBeCloseTo(0.001, 12);
  });
});

describe('Precio según modalidad (carrito del punto de venta)', () => {
  const cocina = { precioContado: 420, precioCredito: 450 };
  it('pago único usa precio de contado', () => {
    expect(precioSegunModalidad(cocina, 'fin_de_mes')).toBe(420);
  });
  it('cuotas usa precio de crédito', () => {
    expect(precioSegunModalidad(cocina, 'cuotas')).toBe(450);
  });
});

describe('Línea disponible (F9: solo el capital pendiente consume línea)', () => {
  // María: línea S/ 1,000; cocina S/ 450 en 3 cuotas comprada el 15/09/2026.
  // El cronograma francés amortiza C′ = 453.62 (monto + gracia capitalizada de
  // 11 días), así que el capital pendiente sin pagos es C′, no 450.
  const maria = { id: 'cli-maria', limiteCredito: 1000 };
  const r = construirTransaccion({
    ...base,
    montoOriginal: 450,
    modalidadPago: 'cuotas',
    numeroCuotas: 3,
    fechaCompra: new Date(2026, 8, 15),
  });
  const cronograma: CuotaCronograma[] = r.cronograma.map((c) => ({
    ...c,
    mora: 0,
    totalPagar: c.cuota,
    estado: 'pendiente',
  }));
  const cocina = { clienteId: maria.id, estado: 'vigente' as Transaccion['estado'], cronograma };

  it('el cronograma amortiza exactamente C′ = 453.62', () => {
    expect(r.capitalConGracia).toBe(453.62);
    expect(redondear(cronograma.reduce((s, c) => s + c.capital, 0))).toBe(453.62);
  });

  it('sin pagos: capital pendiente 453.62 y disponible 546.38', () => {
    expect(calcularCapitalPendiente([cocina])).toBe(453.62);
    expect(calcularLineaDisponible(maria, [cocina])).toEqual({ utilizado: 453.62, disponible: 546.38 });
  });

  it('intereses y mora no consumen línea (con mora vigente el disponible no cambia)', () => {
    const conMora = aplicarMoraAlCronograma(cronograma, 0.5, 'TEA', new Date(2026, 11, 5));
    expect(conMora.some((c) => c.mora > 0)).toBe(true);
    expect(calcularLineaDisponible(maria, [{ ...cocina, estado: 'en_mora', cronograma: conMora }]).disponible).toBe(546.38);
  });

  it('pagar la cuota 1 aumenta el disponible exactamente en su amortización', () => {
    const antes = calcularLineaDisponible(maria, [cocina]).disponible;
    const pagada = cronograma.map((c) => (c.numeroCuota === 1 ? { ...c, estado: 'pagada' as const } : c));
    const despues = calcularLineaDisponible(maria, [{ ...cocina, cronograma: pagada }]).disponible;
    expect(redondear(despues - antes)).toBe(cronograma[0].capital);
    expect(despues).toBe(redondear(546.38 + cronograma[0].capital));
  });

  it('un crédito liquidado aporta 0 (y uno castigado tampoco)', () => {
    const pagado = cronograma.map((c) => ({ ...c, estado: 'pagada' as const }));
    expect(calcularCapitalPendiente([{ ...cocina, estado: 'liquidado', cronograma: pagado }])).toBe(0);
    // Aunque quedaran cuotas sin marcar, el estado del crédito manda
    expect(calcularCapitalPendiente([{ ...cocina, estado: 'liquidado' }])).toBe(0);
    expect(calcularCapitalPendiente([{ ...cocina, estado: 'castigado' }])).toBe(0);
    expect(calcularLineaDisponible(maria, [{ ...cocina, estado: 'liquidado', cronograma: pagado }]).disponible).toBe(1000);
  });

  it('pago único: consume el monto de la compra, no el total con interés', () => {
    const fm = construirTransaccion({
      ...base,
      montoOriginal: 72,
      modalidadPago: 'fin_de_mes',
      numeroCuotas: 1,
      fechaCompra: new Date(2026, 10, 10),
    });
    const tx = {
      clienteId: maria.id,
      estado: 'vigente' as Transaccion['estado'],
      cronograma: fm.cronograma.map((c) => ({ ...c, estado: 'pendiente' as const })),
    };
    expect(calcularLineaDisponible(maria, [cocina, tx])).toEqual({ utilizado: 525.62, disponible: 474.38 });
  });

  it('solo cuenta las transacciones del cliente indicado', () => {
    const otro = { ...cocina, clienteId: 'cli-jose' };
    expect(calcularLineaDisponible(maria, [cocina, otro]).utilizado).toBe(453.62);
  });
});
