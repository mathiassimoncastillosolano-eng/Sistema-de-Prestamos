import { describe, expect, it } from 'vitest';
import legacy from './fixtures/legacy.json';
import { CFG } from '@/lib/config';
import { estadoCuota, resumen } from '@/lib/finance';
import { construirSemilla } from '@/mocks/seed';

const db = construirSemilla();

describe('semilla vs. prototipo original', () => {
  it('conserva los 15 clientes originales (mismos IDs y datos; solo puede adelantarse el alta si era posterior al 1.er desembolso)', () => {
    legacy.seed.clientes.forEach((old) => {
      const c = db.clientes.find((x) => x.id === old.id)!;
      expect(c, old.id).toBeDefined();
      expect({ nombre: c.nombre, tipo: c.tipo, doc: c.doc, agencia: c.agencia, telefono: c.telefono, asesor: c.asesor })
        .toEqual({ nombre: old.nombre, tipo: old.tipo, doc: old.doc, agencia: old.agencia, telefono: old.telefono, asesor: old.asesor });
      expect(c.alta <= old.alta).toBe(true);
      if ('rep' in old) expect(c.representante).toEqual(old.rep);
      if ('negocio' in old) expect({ n: c.negocio, d: c.dniTitular }).toEqual({ n: old.negocio, d: old.dniTitular });
    });
  });

  it('conserva los 16 préstamos originales: cronogramas, pagos y resúmenes idénticos', () => {
    legacy.seed.prestamos.forEach((old, i) => {
      const p = db.prestamos[i]!;
      expect(p.id).toBe(old.id);
      expect({ c: p.clienteId, cap: p.capital, n: p.plazo, d: p.desembolso, a: p.asesor, ag: p.agencia, t: p.tea })
        .toEqual({ c: old.cid, cap: old.cap, n: old.n, d: old.desembolso, a: old.asesor, ag: old.agencia, t: old.tea });
      expect(p.cronograma).toEqual(old.cronograma);
      expect(p.pagos).toEqual(old.pagos);

      const lr = legacy.resumenes[i]!;
      const r = resumen(p);
      expect({ total: r.total, abonado: r.abonado, pendiente: r.pendiente, interes: r.interes, capitalPend: r.capitalPend, vencidas: r.vencidas, estado: r.estado })
        .toEqual({ total: lr.total, abonado: lr.abonado, pendiente: lr.pendiente, interes: lr.interes, capitalPend: lr.capitalPend, vencidas: lr.vencidas, estado: lr.estado });
      expect(r.proxima?.n ?? null).toBe(lr.proxima?.n ?? null);
      expect(p.cronograma.map((c) => estadoCuota(c))).toEqual(lr.estados);
    });
  });

  it('el contador de operaciones original continúa sin colisiones', () => {
    const ops = db.prestamos.flatMap((p) => p.pagos.map((g) => g.op));
    expect(new Set(ops).size).toBe(ops.length);
    expect(db.contador).toBeGreaterThan(Math.max(...ops.map((o) => Number(o.slice(3)))));
  });
});

describe('integridad de los datos mock', () => {
  it('IDs y documentos únicos; formatos válidos', () => {
    expect(new Set(db.clientes.map((c) => c.id)).size).toBe(db.clientes.length);
    expect(new Set(db.clientes.map((c) => c.doc)).size).toBe(db.clientes.length);
    expect(new Set(db.prestamos.map((p) => p.id)).size).toBe(db.prestamos.length);
    db.clientes.forEach((c) => {
      if (c.tipo === 'DNI') expect(c.doc).toMatch(/^\d{8}$/);
      if (c.tipo === 'RUC 10') { expect(c.doc).toMatch(/^10\d{9}$/); expect(c.dniTitular).toMatch(/^\d{8}$/); expect(c.negocio).toBeTruthy(); }
      if (c.tipo === 'RUC 20') { expect(c.doc).toMatch(/^20\d{9}$/); expect(c.representante?.dni).toMatch(/^\d{8}$/); expect(c.domicilio).toBeTruthy(); }
      expect(c.telefono).toMatch(/^9\d{8}$/);
    });
  });

  it('relaciones válidas: cada préstamo tiene cliente; pagos entre desembolso y hoy; cliente dado de alta antes de su primer préstamo', () => {
    db.prestamos.forEach((p) => {
      const c = db.clientes.find((x) => x.id === p.clienteId);
      expect(c, p.id).toBeDefined();
      expect(p.agencia).toBe(c!.agencia);
      expect(c!.alta <= p.desembolso, `${c!.id} alta ${c!.alta} vs ${p.id} ${p.desembolso}`).toBe(true);
      p.pagos.forEach((g) => { expect(g.fecha >= p.desembolso && g.fecha <= CFG.hoy, `${p.id} ${g.op}`).toBe(true); });
    });
  });

  it('los importes abonados coinciden con la suma de pagos de cada préstamo', () => {
    db.prestamos.forEach((p) => {
      const pagado = Math.round(p.pagos.reduce((a, g) => a + g.monto, 0) * 100) / 100;
      expect(resumen(p).abonado, p.id).toBe(pagado);
    });
  });

  it('ningún cliente supera el límite de capital pendiente', () => {
    db.clientes.forEach((c) => {
      const deuda = db.prestamos.filter((p) => p.clienteId === c.id).reduce((a, p) => a + resumen(p).capitalPend, 0);
      expect(deuda, c.id).toBeLessThanOrEqual(CFG.limite);
    });
  });

  it('hay variedad suficiente: todos los estados, 3 tipos de cliente, 2+ páginas y una cancelación anticipada', () => {
    const estados = new Set(db.prestamos.map((p) => resumen(p).estado));
    expect(estados).toEqual(new Set(['Vigente', 'Con cuotas vencidas', 'Cancelado']));
    expect(new Set(db.clientes.map((c) => c.tipo))).toEqual(new Set(['DNI', 'RUC 10', 'RUC 20']));
    expect(db.clientes.length).toBeGreaterThan(16);
    expect(db.prestamos.length).toBeGreaterThan(16);
    const anticipada = db.prestamos.find((p) => p.pagos.some((g) => g.tipo === 'Cancelación anticipada'));
    expect(anticipada).toBeDefined();
    expect(resumen(anticipada!).estado).toBe('Cancelado');
    expect(anticipada!.cronograma.some((c) => estadoCuota(c) === 'Cubierta por cancelación')).toBe(true);
  });

  it('la actividad reciente referencia registros que existen', () => {
    db.actividad.forEach((a) => {
      if (!a.ref) return;
      const lista = a.ref.entidad === 'cliente' ? db.clientes : db.prestamos;
      expect(lista.some((x) => x.id === a.ref!.id)).toBe(true);
    });
  });
});
