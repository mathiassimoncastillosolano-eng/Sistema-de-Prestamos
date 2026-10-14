import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CFG, STORAGE_KEYS } from '@/lib/config';
import * as acciones from '@/services/actions';
import { crearPrestamo, registrarCliente } from '@/services/actions';
import { salud } from '@/services/storage';
import { getDb, restaurarDb } from '@/services/store';
import { deudaCliente } from '@/lib/selectors';

beforeEach(() => { localStorage.clear(); restaurarDb(); });

describe('clientes', () => {
  it('registra un cliente nuevo con ID correlativo, lo persiste y deja huella en la actividad', () => {
    const antes = getDb().clientes.length;
    const r = registrarCliente({ nombre: 'Cliente Nuevo Prueba', tipo: 'DNI', doc: '12345678', telefono: '' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cliente.id).toBe('C' + String(antes + 1).padStart(3, '0'));
    expect(getDb().clientes).toHaveLength(antes + 1);
    expect(getDb().actividad[0]?.ref).toEqual({ entidad: 'cliente', id: r.cliente.id });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.db)!).clientes).toHaveLength(antes + 1);
  });

  it('rechaza documentos duplicados', () => {
    const doc = getDb().clientes[0]!.doc;
    expect(registrarCliente({ nombre: 'Duplicado', tipo: 'DNI', doc, telefono: '' })).toMatchObject({ ok: false });
  });
});

describe('solicitudes de préstamo', () => {
  const cliente = () => getDb().clientes.find((c) => c.id === 'C005')!;

  it('crea el préstamo con cronograma, sin cobertura histórica y con la primera cuota un mes después', () => {
    const r = crearPrestamo({ clienteId: cliente().id, monto: 2000, plazo: 6, desembolso: CFG.hoy });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prestamo.cronograma).toHaveLength(6);
    expect(r.prestamo.cronograma[0]?.fecha).toBe('2026-11-13');
    expect(r.prestamo.historico).toEqual([]);
    expect(r.prestamo.cronograma.every((c) => c.cubierto === 0)).toBe(true);
    expect(getDb().prestamos.some((p) => p.id === r.prestamo.id)).toBe(true);
  });

  it('bloquea préstamos que superan el límite de S/ 10,000 de capital pendiente', () => {
    const c = cliente();
    const capacidad = CFG.limite - deudaCliente(getDb(), c.id);
    const n = getDb().prestamos.length;
    expect(crearPrestamo({ clienteId: c.id, monto: capacidad + 1, plazo: 12, desembolso: CFG.hoy })).toMatchObject({ ok: false });
    expect(getDb().prestamos).toHaveLength(n);
    expect(crearPrestamo({ clienteId: c.id, monto: Math.floor(capacidad), plazo: 12, desembolso: CFG.hoy }).ok).toBe(true);
  });

  it('rechaza monto mínimo, plazo fuera de rango y cliente inexistente', () => {
    const id = cliente().id;
    expect(crearPrestamo({ clienteId: id, monto: 500, plazo: 12, desembolso: CFG.hoy }).ok).toBe(false);
    expect(crearPrestamo({ clienteId: id, monto: 2000, plazo: 61, desembolso: CFG.hoy }).ok).toBe(false);
    expect(crearPrestamo({ clienteId: 'C999', monto: 2000, plazo: 12, desembolso: CFG.hoy }).ok).toBe(false);
  });
});

describe('alcance: el sistema no ejecuta ni registra pagos', () => {
  it('el servicio de acciones no expone ninguna operación de pago, abono, cancelación o liquidación', () => {
    expect(Object.keys(acciones).join(' ')).not.toMatch(/pago|pagar|abono|cancelaci|anticipad|liquid|amortiz/i);
  });

  it('crear préstamos no altera lo ya registrado de otros préstamos (el estado de las cuotas no se modifica a mano)', () => {
    const antes = JSON.stringify(getDb().prestamos);
    const r = crearPrestamo({ clienteId: 'C005', monto: 1000, plazo: 6, desembolso: CFG.hoy });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(getDb().prestamos.slice(0, -1))).toBe(antes);
  });

  it('la actividad registrada habla de registros, no de operaciones de pago', () => {
    crearPrestamo({ clienteId: 'C005', monto: 1000, plazo: 6, desembolso: CFG.hoy });
    expect(getDb().actividad[0]?.tipo).toBe('Préstamo registrado');
  });
});

describe('persistencia', () => {
  it('restaurar devuelve los datos de demostración', () => {
    registrarCliente({ nombre: 'Temporal', tipo: 'DNI', doc: '99999999', telefono: '' });
    restaurarDb();
    expect(getDb().clientes.some((c) => c.doc === '99999999')).toBe(false);
  });

  it('un fallo de localStorage no rompe la operación y se notifica', () => {
    const antes = salud.getSnapshot();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    expect(() => registrarCliente({ nombre: 'Sin disco', tipo: 'DNI', doc: '88888888', telefono: '' })).not.toThrow();
    expect(getDb().clientes.some((c) => c.doc === '88888888')).toBe(true);
    expect(salud.getSnapshot()).toBeGreaterThan(antes);
    spy.mockRestore();
  });
});
