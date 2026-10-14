import { describe, expect, it } from 'vitest';
import legacy from './fixtures/legacy.json';
import { CFG, EJEMPLO_DOCUMENTO_REQUISITOS } from '@/lib/config';
import { addMonths } from '@/lib/dates';
import {
  aplicarPagoAPrestamo, capacidadDisponible, capitalPendienteCliente, capitalPendienteAl, generarCronograma, r2,
  resumen, simular, validarPago, validarSolicitud
} from '@/lib/finance';
import type { Prestamo } from '@/types';

const prestamo = (capital: number, plazo: number, desembolso = '2026-01-13', extra: Partial<Prestamo> = {}): Prestamo => ({
  id: 'PR-T', clienteId: 'C-T', agencia: 'Lima Centro', capital, plazo, tea: CFG.tea, desembolso, asesor: 'Test',
  cronograma: generarCronograma(capital, plazo, desembolso), pagos: [], observaciones: '', ...extra
});

describe('equivalencia con el prototipo original (golden)', () => {
  it('parámetros de negocio intactos', () => {
    expect(legacy.cfg).toMatchObject({ minMonto: 1000, limite: 10000, tea: 0.3, plazoMin: 1, plazoMax: 60, diasProxVenc: 10, alertaLimite: 0.8, hoy: '2026-10-13' });
    expect(CFG).toMatchObject({ minMonto: 1000, limite: 10000, tea: 0.3, plazoMin: 1, plazoMax: 60, diasProxVenc: 10, alertaLimite: 0.8, hoy: '2026-10-13' });
  });

  it.each(legacy.schedules.map((s) => [`${s.capital} a ${s.plazo} meses desde ${s.desembolso}`, s] as const))('cronograma idéntico: %s', (_n, s) => {
    expect(generarCronograma(s.capital, s.plazo, s.desembolso)).toEqual(s.cronograma);
  });

  it.each(legacy.addMonthsCases)('addMonths($fecha, $meses) = $res', ({ fecha, meses, res }) => {
    expect(addMonths(fecha, meses)).toBe(res);
  });
});

describe('reglas de negocio', () => {
  it('primera cuota exactamente un mes después del desembolso, sin cobro inicial', () => {
    const s = simular({ monto: 3000, plazo: 12, desembolso: '2026-10-13' });
    expect(s?.primera).toBe('2026-11-13');
    expect(s?.cronograma[0]?.fecha).toBe('2026-11-13');
    expect(s?.cronograma.every((c) => c.abonado === 0)).toBe(true);
  });

  it('el capital del cronograma suma exactamente el monto y el saldo final es 0', () => {
    for (const [m, n] of [[1000, 1], [1234.56, 18], [9999.99, 7], [10000, 60]] as const) {
      const cr = generarCronograma(m, n, '2026-10-13');
      expect(r2(cr.reduce((a, c) => a + c.capital, 0))).toBe(m);
      expect(cr.at(-1)?.saldo).toBe(0);
    }
  });

  it('valida monto mínimo de S/ 1,000', () => {
    const base = { clienteId: 'C1', plazo: 12, desembolso: '2026-10-13', deudaActual: 0 };
    expect(validarSolicitud({ ...base, monto: 999.99 }).ok).toBe(false);
    expect(validarSolicitud({ ...base, monto: 1000 }).ok).toBe(true);
  });

  it('valida plazo entre 1 y 60 meses, entero', () => {
    const base = { clienteId: 'C1', monto: 2000, desembolso: '2026-10-13', deudaActual: 0 };
    for (const plazo of [0, 61, 12.5, NaN]) expect(validarSolicitud({ ...base, plazo }).ok).toBe(false);
    for (const plazo of [1, 60]) expect(validarSolicitud({ ...base, plazo }).ok).toBe(true);
  });

  it('límite de S/ 10,000 de capital pendiente por cliente (toda la empresa)', () => {
    const base = { clienteId: 'C1', plazo: 12, desembolso: '2026-10-13' };
    expect(validarSolicitud({ ...base, monto: 4000, deudaActual: 6000 }).ok).toBe(true);
    const sobre = validarSolicitud({ ...base, monto: 4001, deudaActual: 6000 });
    expect(sobre.ok).toBe(false);
    expect(sobre.checks.find((c) => !c.ok)?.campo).toBe('monto');
    expect(capacidadDisponible(6000)).toBe(4000);
    expect(capacidadDisponible(12000)).toBe(0);
  });

  it('el capital amortizado libera capacidad para nuevos préstamos', () => {
    let p = prestamo(8000, 12, '2026-01-13');
    const antes = capitalPendienteCliente([p], 'C-T');
    expect(antes).toBe(8000);
    const c1 = p.cronograma[0]!;
    p = aplicarPagoAPrestamo(p, { op: 'OP-1', fecha: c1.fecha, monto: c1.cuota, tipo: 'Pago de cuota', usuario: 't', medio: 'Efectivo', ref: '' });
    const despues = capitalPendienteCliente([p], 'C-T');
    expect(despues).toBe(r2(8000 - c1.capital));
    expect(capacidadDisponible(despues)).toBeGreaterThan(capacidadDisponible(antes));
  });
});

describe('discrepancia abierta con el documento de requisitos (documentada, NO corregida)', () => {
  it('S/ 1,000 a 12 meses NO da S/ 1,300 con TEA 30 %: el prototipo da S/ 1,149.43', () => {
    const s = simular({ monto: EJEMPLO_DOCUMENTO_REQUISITOS.monto, plazo: EJEMPLO_DOCUMENTO_REQUISITOS.plazo, desembolso: '2026-10-13' });
    expect(s?.total).toBe(1149.43);
    expect(s?.cuota).toBe(95.79);
    expect(s?.total).not.toBe(EJEMPLO_DOCUMENTO_REQUISITOS.totalEsperado);
    expect(legacy.ejemploPdf).toEqual({ total: 1149.43, cuota: 95.79 });
  });
});

describe('pagos y cancelación anticipada', () => {
  const pagoDe = (p: Prestamo, monto: number, tipo: 'Pago de cuota' | 'Cancelación anticipada', op = 'OP-9') =>
    aplicarPagoAPrestamo(p, { op, fecha: '2026-10-01', monto, tipo, usuario: 't', medio: 'Efectivo', ref: '' });

  it('un pago exacto cubre la cuota y no muta el préstamo original', () => {
    const p = prestamo(3000, 12);
    const snapshot = JSON.stringify(p);
    const c1 = p.cronograma[0]!;
    const q = pagoDe(p, c1.cuota, 'Pago de cuota');
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(q.cronograma[0]?.abonado).toBe(c1.cuota);
    expect(q.cronograma[1]?.abonado).toBe(0);
    expect(q.pagos).toHaveLength(1);
  });

  it('un importe mayor a una cuota se reparte en orden entre las cuotas abiertas', () => {
    const p = prestamo(3000, 12);
    const [c1, c2] = p.cronograma as [typeof p.cronograma[0], typeof p.cronograma[0]];
    const q = pagoDe(p, r2(c1.cuota + c2.cuota / 2), 'Pago de cuota');
    expect(q.cronograma[0]?.abonado).toBe(c1.cuota);
    expect(q.cronograma[1]?.abonado).toBe(r2(c2.cuota / 2));
  });

  it('cancelación anticipada = total contractual − abonado; conserva el cronograma original', () => {
    let p = prestamo(3000, 12);
    p = pagoDe(p, p.cronograma[0]!.cuota, 'Pago de cuota', 'OP-1');
    const antes = resumen(p);
    expect(antes.pendiente).toBe(r2(antes.total - antes.abonado));

    const v = validarPago(p, { monto: antes.pendiente, fecha: '2026-10-01', tipo: 'Cancelación anticipada' });
    expect(v.ok).toBe(true);
    const cancelado = pagoDe(p, antes.pendiente, 'Cancelación anticipada', 'OP-2');

    const r = resumen(cancelado);
    expect(r.estado).toBe('Cancelado');
    expect(r.pendiente).toBe(0);
    expect(r.capitalPend).toBe(0);
    // el cronograma original (importes contractuales) no cambia
    expect(cancelado.cronograma.map(({ n, fecha, capital, interes, cuota, saldo }) => ({ n, fecha, capital, interes, cuota, saldo })))
      .toEqual(p.cronograma.map(({ n, fecha, capital, interes, cuota, saldo }) => ({ n, fecha, capital, interes, cuota, saldo })));
    // la primera cuota pagada normalmente NO se marca como cubierta por cancelación; las demás sí
    expect(cancelado.cronograma[0]?.cubierta).toBe(false);
    expect(cancelado.cronograma.slice(1).every((c) => c.cubierta)).toBe(true);
  });

  it('rechaza importes inválidos, cancelación por otro importe, fechas futuras y referencias duplicadas', () => {
    let p = prestamo(3000, 12);
    const r = resumen(p);
    const ok = { fecha: '2026-10-01', tipo: 'Pago de cuota' as const };
    expect(validarPago(p, { ...ok, monto: 0 })).toMatchObject({ ok: false, campo: 'monto' });
    expect(validarPago(p, { ...ok, monto: r.pendiente + 1 })).toMatchObject({ ok: false, campo: 'monto' });
    expect(validarPago(p, { monto: r.pendiente - 1, fecha: '2026-10-01', tipo: 'Cancelación anticipada' })).toMatchObject({ ok: false, campo: 'monto' });
    expect(validarPago(p, { ...ok, monto: 50, fecha: '2026-10-14' })).toMatchObject({ ok: false, campo: 'fecha' });
    p = aplicarPagoAPrestamo(p, { op: 'OP-1', fecha: '2026-10-01', monto: 50, tipo: 'Pago de cuota', usuario: 't', medio: 'Yape', ref: 'ABC-1' });
    expect(validarPago(p, { ...ok, monto: 50, ref: 'abc-1' })).toMatchObject({ ok: false, campo: 'ref' });
  });

  it('un préstamo cancelado no admite más pagos', () => {
    const p = prestamo(1000, 3);
    const cancelado = pagoDe(p, resumen(p).total, 'Cancelación anticipada');
    expect(validarPago(cancelado, { monto: 10, fecha: '2026-10-01', tipo: 'Pago de cuota' })).toMatchObject({ ok: false });
  });

  it('capitalPendienteAl reproduce el estado actual al día de hoy y el desembolso pendiente antes del desembolso', () => {
    let p = prestamo(3000, 12, '2026-06-13');
    for (const c of p.cronograma.slice(0, 3)) p = aplicarPagoAPrestamo(p, { op: 'OP-' + c.n, fecha: c.fecha, monto: c.cuota, tipo: 'Pago de cuota', usuario: 't', medio: 'Efectivo', ref: '' });
    expect(capitalPendienteAl(p, CFG.hoy)).toBe(resumen(p).capitalPend);
    expect(capitalPendienteAl(p, '2026-06-12')).toBe(0);
    expect(capitalPendienteAl(p, '2026-06-13')).toBe(3000);
  });
});
