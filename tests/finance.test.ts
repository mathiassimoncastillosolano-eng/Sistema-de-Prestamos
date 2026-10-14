import { describe, expect, it } from 'vitest';
import legacy from './fixtures/legacy.json';
import { CFG, EJEMPLO_DOCUMENTO_REQUISITOS } from '@/lib/config';
import { addMonths } from '@/lib/dates';
import * as finance from '@/lib/finance';
import {
  capacidadDisponible, capitalPendienteCliente, capitalPendienteAl, estadoCuota, generarCronograma, importarHistorico, r2,
  resumen, simular, validarSolicitud
} from '@/lib/finance';
import type { Prestamo } from '@/types';

const prestamo = (capital: number, plazo: number, desembolso = '2026-01-13', extra: Partial<Prestamo> = {}): Prestamo => ({
  id: 'PR-T', clienteId: 'C-T', agencia: 'Lima Centro', capital, plazo, tea: CFG.tea, desembolso, asesor: 'Test',
  cronograma: generarCronograma(capital, plazo, desembolso), historico: [], observaciones: '', ...extra
});

/** El cronograma programado no incluye el campo de cobertura histórica. */
type Programada = { n: number; fecha: string; capital: number; interes: number; cuota: number; saldo: number };
const programado = (cr: Programada[]) => cr.map(({ n, fecha, capital, interes, cuota, saldo }) => ({ n, fecha, capital, interes, cuota, saldo }));

describe('equivalencia con el prototipo original (golden)', () => {
  it('parámetros de negocio intactos', () => {
    expect(legacy.cfg).toMatchObject({ minMonto: 1000, limite: 10000, tea: 0.3, plazoMin: 1, plazoMax: 60, diasProxVenc: 10, alertaLimite: 0.8, hoy: '2026-10-13' });
    expect(CFG).toMatchObject({ minMonto: 1000, limite: 10000, tea: 0.3, plazoMin: 1, plazoMax: 60, diasProxVenc: 10, alertaLimite: 0.8, hoy: '2026-10-13' });
  });

  it.each(legacy.schedules.map((s) => [`${s.capital} a ${s.plazo} meses desde ${s.desembolso}`, s] as const))('cronograma idéntico: %s', (_n, s) => {
    expect(programado(generarCronograma(s.capital, s.plazo, s.desembolso))).toEqual(programado(s.cronograma));
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
    expect(s?.cronograma.every((c) => c.cubierto === 0)).toBe(true);
  });

  it('último día de mes: una política uniforme (31-ene + 1 mes = fin de febrero)', () => {
    expect(generarCronograma(1000, 3, '2026-01-31').map((c) => c.fecha)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
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

describe('alcance: sin operativa de pagos', () => {
  it('el módulo de finanzas no expone funciones de pago, cancelación ni liquidación', () => {
    const nombres = Object.keys(finance).join(' ');
    expect(nombres).not.toMatch(/pago|pagar|abono|cancelaci|anticipad|liquid/i);
  });

  it('sin registro histórico el capital pendiente NO disminuye con el paso del tiempo', () => {
    const p = prestamo(3000, 12, '2025-01-13'); // todas sus cuotas ya vencieron por fecha
    const r = resumen(p);
    expect(r.capitalPend).toBe(3000);
    expect(r.pendiente).toBe(r.total);
    expect(r.cubierto).toBe(0);
    expect(capitalPendienteCliente([p], 'C-T')).toBe(3000);
  });

  it('el estado de la cuota se calcula solo desde fechas y registro histórico: Vencida, Próxima a vencer, Pendiente', () => {
    const cr = generarCronograma(1200, 3, '2026-09-20'); // vencen 2026-10-20, 11-20, 12-20; hoy = 2026-10-13
    expect(cr.map((c) => estadoCuota(c))).toEqual(['Próxima a vencer', 'Pendiente', 'Pendiente']);
    expect(estadoCuota(cr[0]!, '2026-10-21')).toBe('Vencida');
    expect(estadoCuota(cr[0]!, '2026-10-10')).toBe('Próxima a vencer');
    expect(estadoCuota(cr[0]!, '2026-09-01')).toBe('Pendiente');
  });

  it('un préstamo nuevo nunca tiene cuotas cubiertas ni estado Finalizado', () => {
    const r = resumen(prestamo(5000, 24, CFG.hoy));
    expect(r.estado).toBe('Vigente');
    expect(r.cubierto).toBe(0);
  });
});

describe('registro histórico importado (solo lectura, usado por la semilla mock)', () => {
  const importar = (p: Prestamo, k: number) =>
    p.cronograma.slice(0, k).reduce((acc, c, i) => importarHistorico(acc, { op: 'HIS-' + i, fecha: c.fecha, monto: c.cuota, usuario: 't' }), p);

  it('no muta el préstamo original y marca las cuotas respaldadas como "Cubierta (histórico)"', () => {
    const p = prestamo(3000, 12, '2026-01-13');
    const snapshot = JSON.stringify(p);
    const q = importar(p, 3);
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(q.cronograma.slice(0, 3).every((c) => estadoCuota(c) === 'Cubierta (histórico)')).toBe(true);
    expect(q.cronograma[3] && estadoCuota(q.cronograma[3])).not.toBe('Cubierta (histórico)');
    expect(programado(q.cronograma)).toEqual(programado(p.cronograma));
  });

  it('el capital cubierto históricamente libera capacidad dentro del límite', () => {
    const p = prestamo(8000, 12, '2026-01-13');
    const q = importar(p, 1);
    expect(capitalPendienteCliente([q], 'C-T')).toBe(r2(8000 - p.cronograma[0]!.capital));
    expect(capacidadDisponible(capitalPendienteCliente([q], 'C-T'))).toBeGreaterThan(capacidadDisponible(capitalPendienteCliente([p], 'C-T')));
  });

  it('capitalPendienteAl reproduce el estado actual al día de hoy y el capital completo en el desembolso', () => {
    const q = importar(prestamo(3000, 12, '2026-06-13'), 3);
    expect(capitalPendienteAl(q, CFG.hoy)).toBe(resumen(q).capitalPend);
    expect(capitalPendienteAl(q, '2026-06-12')).toBe(0);
    expect(capitalPendienteAl(q, '2026-06-13')).toBe(3000);
  });

  it('cubrir todas las cuotas deja el préstamo Finalizado', () => {
    const p = prestamo(1000, 3, '2026-01-13');
    const q = importar(p, 3);
    expect(resumen(q).estado).toBe('Finalizado');
    expect(resumen(q).pendiente).toBe(0);
  });
});
