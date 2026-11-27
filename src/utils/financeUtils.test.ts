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
} from './financeUtils';

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
