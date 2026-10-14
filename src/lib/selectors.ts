/* Consultas derivadas sobre el estado (puras, sin React). Reutilizables por vistas, búsqueda y analíticas. */
import type { Cliente, Cuota, Db, EstadoCuota, EstadoPrestamo, Prestamo } from '@/types';
import { CFG } from './config';
import { capacidadDisponible, capitalPendienteCliente, estadoCuota, resumen } from './finance';
import { normalizar } from './utils';

export const getCliente = (db: Db, id: string) => db.clientes.find((c) => c.id === id);
export const getPrestamo = (db: Db, id: string) => db.prestamos.find((p) => p.id === id);
export const prestamosDe = (db: Db, clienteId: string) => db.prestamos.filter((p) => p.clienteId === clienteId);
export const deudaCliente = (db: Db, clienteId: string) => capitalPendienteCliente(db.prestamos, clienteId);
export const usoLimite = (deuda: number) => (deuda / CFG.limite) * 100;

export type EstadoCliente = 'Con cuotas vencidas' | 'Cerca del límite' | 'Al día' | 'Sin préstamos activos';

/** Estado derivado del cliente (no existe como campo: se calcula desde sus préstamos). */
export function estadoCliente(db: Db, c: Cliente): EstadoCliente {
  const ps = prestamosDe(db, c.id).map(resumen);
  if (ps.some((r) => r.estado === 'Con cuotas vencidas')) return 'Con cuotas vencidas';
  if (!ps.some((r) => r.estado !== 'Finalizado')) return 'Sin préstamos activos';
  if (deudaCliente(db, c.id) >= CFG.limite * CFG.alertaLimite) return 'Cerca del límite';
  return 'Al día';
}

export interface FilaCliente {
  cliente: Cliente;
  deuda: number;
  uso: number;
  disponible: number;
  estado: EstadoCliente;
  prestamosActivos: number;
}

export const filasClientes = (db: Db): FilaCliente[] =>
  db.clientes.map((cliente) => {
    const deuda = deudaCliente(db, cliente.id);
    return {
      cliente, deuda, uso: usoLimite(deuda), disponible: capacidadDisponible(deuda), estado: estadoCliente(db, cliente),
      prestamosActivos: prestamosDe(db, cliente.id).filter((p) => resumen(p).estado !== 'Finalizado').length
    };
  });

export interface FilaPrestamo {
  prestamo: Prestamo;
  cliente: Cliente | undefined;
  resumen: ReturnType<typeof resumen>;
  estado: EstadoPrestamo;
}

export const filasPrestamos = (db: Db): FilaPrestamo[] =>
  db.prestamos.map((prestamo) => {
    const r = resumen(prestamo);
    return { prestamo, cliente: getCliente(db, prestamo.clienteId), resumen: r, estado: r.estado };
  });

/* ---------- Cuotas (solo consulta) ---------- */
export interface FilaCuota {
  prestamo: Prestamo;
  cliente: Cliente | undefined;
  cuota: Cuota;
  estado: EstadoCuota;
}

/** Todas las cuotas programadas de la cartera, con su estado informativo calculado. Es una vista de consulta. */
export const filasCuotas = (db: Db): FilaCuota[] =>
  db.prestamos.flatMap((prestamo) => {
    const cliente = getCliente(db, prestamo.clienteId);
    return prestamo.cronograma.map((cuota) => ({ prestamo, cliente, cuota, estado: estadoCuota(cuota) }));
  });

/** Historial administrativo (altas y registros) vinculado a una entidad. */
export const actividadDe = (db: Db, entidad: 'cliente' | 'prestamo', id: string) =>
  db.actividad.filter((a) => a.ref?.entidad === entidad && a.ref.id === id);

/* ---------- Búsqueda global ---------- */
export type ResultadoBusqueda =
  | { tipo: 'cliente'; id: string; titulo: string; detalle: string; ruta: string }
  | { tipo: 'prestamo'; id: string; titulo: string; detalle: string; ruta: string };

export function buscar(db: Db, consulta: string, limite = 6): { clientes: ResultadoBusqueda[]; prestamos: ResultadoBusqueda[] } {
  const q = normalizar(consulta);
  if (q.length < 2) return { clientes: [], prestamos: [] };
  const clientes = db.clientes
    .filter((c) => normalizar([c.nombre, c.doc, c.id, c.representante?.nombre ?? '', c.negocio ?? ''].join(' ')).includes(q))
    .slice(0, limite)
    .map<ResultadoBusqueda>((c) => ({ tipo: 'cliente', id: c.id, titulo: c.nombre, detalle: `${c.tipo} ${c.doc} · ${c.agencia}`, ruta: `/clientes/${c.id}` }));
  const prestamos = db.prestamos
    .map((p) => ({ p, c: getCliente(db, p.clienteId) }))
    .filter(({ p, c }) => normalizar([p.id, c?.nombre ?? '', c?.doc ?? ''].join(' ')).includes(q))
    .slice(0, limite)
    .map<ResultadoBusqueda>(({ p, c }) => ({ tipo: 'prestamo', id: p.id, titulo: p.id, detalle: `${c?.nombre ?? p.clienteId} · ${resumen(p).estado}`, ruta: `/prestamos/${p.id}` }));
  return { clientes, prestamos };
}

export const rutaDeActividad = (ref: { entidad: 'cliente' | 'prestamo'; id: string }) =>
  ref.entidad === 'cliente' ? `/clientes/${ref.id}` : `/prestamos/${ref.id}`;
