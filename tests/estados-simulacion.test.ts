/* Pruebas de las reglas de la remasterización: estados de cuota y de préstamo, fecha de desembolso automática,
   primera cuota (fin de mes) y simulación financiera. Son puras: no usan la interfaz ni el servidor. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CFG } from '@/lib/config';
import { addMonths, hoySistema } from '@/lib/dates';
import { capitalPendienteCliente, cuotaParcial, estadoCuota, generarCronograma, r2, resumen, simular, tasaMensual, validarSolicitud } from '@/lib/finance';
import { construirSemilla } from '@/mocks/seed';
import type { Cuota, Prestamo } from '@/types';

const cuota = (over: Partial<Cuota>): Cuota => ({ n: 1, fecha: '2026-11-13', capital: 80, interes: 20, cuota: 100, cubierto: 0, saldo: 900, ...over });
const HOY = CFG.hoy; // 2026-10-13: fecha simulada con la que están construidos los datos mock

afterEach(() => { vi.useRealTimers(); });

describe('estadoCuota', () => {
  it('cuota futura con saldo: Pendiente', () => expect(estadoCuota(cuota({ fecha: '2026-12-13' }), HOY)).toBe('Pendiente'));
  it('cuota que vence dentro de la ventana (o hoy): Próxima a vencer', () => {
    expect(estadoCuota(cuota({ fecha: '2026-10-19' }), HOY)).toBe('Próxima a vencer');
    expect(estadoCuota(cuota({ fecha: HOY }), HOY)).toBe('Próxima a vencer');
    expect(estadoCuota(cuota({ fecha: '2026-10-24' }), HOY)).toBe('Pendiente'); // 11 días: fuera de la ventana de 10
  });
  it('cuota vencida con saldo: Vencida', () => expect(estadoCuota(cuota({ fecha: '2026-10-12' }), HOY)).toBe('Vencida'));
  it('cuota completamente cubierta: Pagada', () => expect(estadoCuota(cuota({ fecha: '2026-09-13', cubierto: 100 }), HOY)).toBe('Pagada'));
  it('una cuota parcialmente cubierta nunca es Pagada', () => {
    const vencidaParcial = cuota({ fecha: '2026-09-13', cubierto: 40 });
    expect(cuotaParcial(vencidaParcial)).toBe(true);
    expect(estadoCuota(vencidaParcial, HOY)).toBe('Vencida');
    expect(estadoCuota(cuota({ fecha: '2026-12-13', cubierto: 40 }), HOY)).toBe('Pendiente');
    expect(cuotaParcial(cuota({ cubierto: 100 }))).toBe(false);
  });
});

describe('estado del préstamo y datos mock', () => {
  const db = construirSemilla();
  const estado = (id: string) => resumen(db.prestamos.find((p) => p.id === id) as Prestamo).estado;

  it('cubre los seis estados con datos coherentes', () => {
    const estados = new Set(db.prestamos.map((p) => resumen(p).estado));
    expect([...estados].sort()).toEqual(['Aprobado', 'Cancelado', 'En evaluación', 'En mora', 'Rechazado', 'Vigente'].sort());
  });
  it('Cancelado solo si no queda saldo; En mora solo con cuotas vencidas abiertas', () => {
    for (const p of db.prestamos.filter((x) => !x.etapa)) {
      const r = resumen(p);
      if (r.estado === 'Cancelado') expect(r.pendiente).toBeLessThanOrEqual(0.005);
      else expect(r.pendiente).toBeGreaterThan(0.005);
      if (r.estado === 'En mora') expect(r.vencidas).toBeGreaterThan(0);
    }
  });
  it('una solicitud aprobada no es un préstamo desembolsado: sin saldo, sin deuda y sin contar para el límite', () => {
    const aprobada = db.prestamos.find((p) => p.id === 'PR-1033') as Prestamo;
    expect(estado('PR-1033')).toBe('Aprobado');
    expect(aprobada.etapa).toBe('aprobado');
    const r = resumen(aprobada);
    expect(r.capitalPend).toBe(0);
    expect(r.pendiente).toBe(0);
    const sinSolicitudes = db.prestamos.filter((p) => !p.etapa);
    expect(capitalPendienteCliente(db.prestamos, aprobada.clienteId)).toBe(capitalPendienteCliente(sinSolicitudes, aprobada.clienteId));
  });
  it('el caso de pago parcial queda vencido, con capital pendiente y sin figurar como pagada', () => {
    const p = db.prestamos.find((x) => x.id === 'PR-1030') as Prestamo;
    const estados = p.cronograma.map((c) => estadoCuota(c));
    expect(estados).toEqual(expect.arrayContaining(['Pagada', 'Vencida', 'Próxima a vencer', 'Pendiente']));
    const parcial = p.cronograma.find(cuotaParcial);
    expect(parcial).toBeDefined();
    expect(estadoCuota(parcial as Cuota)).toBe('Vencida');
  });
});

describe('fecha de desembolso y primera cuota', () => {
  it('hoySistema usa la fecha actual del sistema, sin fecha fija', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 2, 5, 10, 0, 0));
    expect(hoySistema()).toBe('2027-03-05');
    vi.setSystemTime(new Date(2026, 9, 17, 23, 30, 0));
    expect(hoySistema()).toBe('2026-10-17');
  });
  it('la primera cuota vence un mes después, respetando fin de mes y bisiestos', () => {
    expect(addMonths('2026-10-17', 1)).toBe('2026-11-17');
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-31');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });
});

describe('simulación financiera', () => {
  it('convierte la TEA con TEM = (1+TEA)^(1/12) − 1', () => {
    expect(tasaMensual(0.3)).toBeCloseTo(Math.pow(1.3, 1 / 12) - 1, 12);
    expect(tasaMensual(0.3)).toBeCloseTo(0.022104, 6);
  });
  it('cuota, intereses y total son coherentes entre sí y con el cronograma', () => {
    const sim = simular({ monto: 2000, plazo: 12, desembolso: '2026-10-17' });
    expect(sim).not.toBeNull();
    if (!sim) return;
    expect(sim.cronograma).toHaveLength(12);
    expect(sim.total).toBe(r2(sim.cronograma.reduce((a, c) => a + c.cuota, 0)));
    expect(sim.interes).toBe(r2(sim.total - 2000));
    expect(sim.cuota).toBe(sim.cronograma[0]?.cuota);
    expect(sim.primera).toBe('2026-11-17');
    expect(sim.cronograma[11]?.saldo).toBe(0);
    // cuota francesa: PMT = C·r / (1 − (1+r)^−n)
    const r = tasaMensual(CFG.tea);
    expect(sim.cuota).toBeCloseTo((2000 * r) / (1 - Math.pow(1 + r, -12)), 1);
  });
  it('cambia al cambiar monto y plazo, y no genera resultados con valores incorrectos', () => {
    const a = simular({ monto: 2000, plazo: 12, desembolso: '2026-10-17' });
    const b = simular({ monto: 3000, plazo: 24, desembolso: '2026-10-17' });
    expect(a?.cuota).not.toBe(b?.cuota);
    expect(b?.cronograma).toHaveLength(24);
    expect(simular({ monto: NaN, plazo: 12, desembolso: '2026-10-17' })).toBeNull();
    expect(simular({ monto: 2000, plazo: 0, desembolso: '2026-10-17' })).toBeNull();
    expect(simular({ monto: 2000, plazo: 61, desembolso: '2026-10-17' })).toBeNull();
    expect(simular({ monto: 2000, plazo: 12.5, desembolso: '2026-10-17' })).toBeNull();
  });
  it('las validaciones de negocio rechazan monto bajo, plazo fuera de rango y exceso del límite', () => {
    const base = { clienteId: 'C001', monto: 2000, plazo: 12, desembolso: '2026-10-17', deudaActual: 0 };
    expect(validarSolicitud(base).ok).toBe(true);
    expect(validarSolicitud({ ...base, monto: 500 }).ok).toBe(false);
    expect(validarSolicitud({ ...base, plazo: 61 }).ok).toBe(false);
    expect(validarSolicitud({ ...base, deudaActual: 9000 }).ok).toBe(false);
  });
  it('generarCronograma no altera el cronograma al recalcular con la misma entrada (sin fórmulas duplicadas)', () => {
    expect(generarCronograma(2000, 12, '2026-10-17')).toEqual(simular({ monto: 2000, plazo: 12, desembolso: '2026-10-17' })?.cronograma);
  });
});
