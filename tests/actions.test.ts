import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CFG, STORAGE_KEYS } from '@/lib/config';
import { resumen, r2 } from '@/lib/finance';
import { crearPrestamo, registrarCliente, registrarPago } from '@/services/actions';
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

  it('crea el préstamo con cronograma, sin pagos y con la primera cuota un mes después', () => {
    const r = crearPrestamo({ clienteId: cliente().id, monto: 2000, plazo: 6, desembolso: CFG.hoy });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prestamo.cronograma).toHaveLength(6);
    expect(r.prestamo.cronograma[0]?.fecha).toBe('2026-11-13');
    expect(r.prestamo.pagos).toEqual([]);
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

describe('pagos', () => {
  const abierto = () => getDb().prestamos.find((p) => resumen(p).estado === 'Vigente')!;

  it('registrar el pago de una cuota actualiza saldo, historial, deuda del cliente y actividad', () => {
    const p = abierto();
    const antes = resumen(p);
    const cuota = p.cronograma.find((c) => c.abonado < c.cuota)!;
    const deudaAntes = deudaCliente(getDb(), p.clienteId);
    const r = registrarPago({ prestamoId: p.id, monto: cuota.cuota, fecha: CFG.hoy, medio: 'Yape', ref: 'T-1', tipo: 'Pago de cuota' });
    expect(r.ok).toBe(true);
    const despues = resumen(getDb().prestamos.find((x) => x.id === p.id)!);
    expect(despues.pendiente).toBe(r2(antes.pendiente - cuota.cuota));
    expect(despues.abonado).toBe(r2(antes.abonado + cuota.cuota));
    expect(getDb().prestamos.find((x) => x.id === p.id)!.pagos.at(-1)?.ref).toBe('T-1');
    expect(deudaCliente(getDb(), p.clienteId)).toBeLessThan(deudaAntes); // libera capacidad
    expect(getDb().actividad[0]?.tipo).toBe('Pago registrado');
  });

  it('cada operación recibe un número OP distinto', () => {
    const p = abierto();
    const a = registrarPago({ prestamoId: p.id, monto: 10, fecha: CFG.hoy, medio: 'Efectivo', tipo: 'Pago de cuota' });
    const b = registrarPago({ prestamoId: p.id, monto: 10, fecha: CFG.hoy, medio: 'Efectivo', tipo: 'Pago de cuota' });
    expect(a.ok && b.ok && a.operacion.op !== b.operacion.op).toBe(true);
  });

  it('rechaza sobrepagos y referencias duplicadas sin modificar los datos', () => {
    const p = abierto();
    const antes = JSON.stringify(getDb());
    expect(registrarPago({ prestamoId: p.id, monto: resumen(p).pendiente + 1, fecha: CFG.hoy, medio: 'Efectivo', tipo: 'Pago de cuota' })).toMatchObject({ ok: false, campo: 'monto' });
    expect(JSON.stringify(getDb())).toBe(antes);
    expect(registrarPago({ prestamoId: p.id, monto: 10, fecha: CFG.hoy, medio: 'Efectivo', ref: 'DUP', tipo: 'Pago de cuota' }).ok).toBe(true);
    expect(registrarPago({ prestamoId: p.id, monto: 10, fecha: CFG.hoy, medio: 'Efectivo', ref: 'DUP', tipo: 'Pago de cuota' })).toMatchObject({ ok: false, campo: 'ref' });
  });

  it('cancelación anticipada: total − abonado, cierra el préstamo y conserva el cronograma', () => {
    const p = abierto();
    const r0 = resumen(p);
    const original = JSON.stringify(p.cronograma.map((c) => [c.n, c.fecha, c.capital, c.interes, c.cuota, c.saldo]));
    expect(registrarPago({ prestamoId: p.id, monto: r0.pendiente - 1, fecha: CFG.hoy, medio: 'Efectivo', tipo: 'Cancelación anticipada' }).ok).toBe(false);
    const r = registrarPago({ prestamoId: p.id, monto: r0.pendiente, fecha: CFG.hoy, medio: 'Transferencia', tipo: 'Cancelación anticipada' });
    expect(r.ok).toBe(true);
    const nuevo = getDb().prestamos.find((x) => x.id === p.id)!;
    expect(resumen(nuevo).estado).toBe('Cancelado');
    expect(JSON.stringify(nuevo.cronograma.map((c) => [c.n, c.fecha, c.capital, c.interes, c.cuota, c.saldo]))).toBe(original);
    expect(getDb().actividad[0]?.tipo).toBe('Cancelación anticipada');
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
