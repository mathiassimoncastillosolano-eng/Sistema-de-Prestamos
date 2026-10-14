import { describe, expect, it } from 'vitest';
import { calcularDashboard, calcularNotificaciones } from '@/lib/analytics';
import { construirSemilla } from '@/mocks/seed';
import { buscar } from '@/lib/selectors';
import { resumen } from '@/lib/finance';

const db = construirSemilla();

describe('analíticas del dashboard (derivadas de los registros)', () => {
  it('el último punto de capital pendiente coincide con el capital pendiente actual', () => {
    for (const alcance of ['mis', 'agencia', 'empresa'] as const) {
      const d = calcularDashboard(db, alcance, 6);
      expect(d.serie.at(-1)?.capitalPendiente).toBe(d.capitalPendiente);
    }
  });

  it('los desembolsos de la serie suman lo que dicen los registros del periodo', () => {
    const d = calcularDashboard(db, 'empresa', 12);
    const desemSerie = d.serie.reduce((a, p) => a + p.desembolsos, 0);
    const desemReal = db.prestamos.filter((p) => p.desembolso >= `${d.serie[0]!.mes}-01`).reduce((a, p) => a + p.capital, 0);
    expect(desemSerie).toBe(desemReal);
  });

  it('el dashboard no contiene indicadores de pagos', () => {
    const d = calcularDashboard(db, 'empresa', 6);
    expect(Object.keys(d).join(' ')).not.toMatch(/pago/i);
    expect(Object.keys(d.serie[0]!).join(' ')).not.toMatch(/pago/i);
  });

  it('el estado de la cartera suma todos los préstamos y la empresa agrega a los alcances', () => {
    const e = calcularDashboard(db, 'empresa', 6);
    expect(e.estados.reduce((a, x) => a + x.cantidad, 0)).toBe(db.prestamos.length);
    expect(e.prestamosActivos + e.prestamosFinalizados).toBe(db.prestamos.length);
    expect(e.vencidas.length).toBe(db.prestamos.reduce((a, p) => a + resumen(p).vencidas, 0));
    const mis = calcularDashboard(db, 'mis', 6);
    expect(mis.capitalPendiente).toBeLessThanOrEqual(e.capitalPendiente);
    expect(e.capitalPendiente).toBe(Math.round(db.prestamos.reduce((a, p) => a + resumen(p).capitalPend, 0) * 100) / 100);
  });

  it('no inventa tendencias: la variación es null cuando no hay base de comparación', () => {
    const d = calcularDashboard({ ...db, prestamos: [] }, 'empresa', 6);
    expect(d.variacionCapital).toBeNull();
  });

  it('genera notificaciones y búsqueda con datos reales', () => {
    expect(calcularNotificaciones(db).length).toBeGreaterThan(0);
    const b = buscar(db, 'quispe');
    expect(b.clientes[0]?.titulo).toContain('Quispe');
    expect(buscar(db, 'PR-1006').prestamos[0]?.id).toBe('PR-1006');
    expect(buscar(db, 'cardenas').clientes).toHaveLength(1); // sin tildes
    expect(buscar(db, 'zzzzzz')).toEqual({ clientes: [], prestamos: [] });
  });
});
