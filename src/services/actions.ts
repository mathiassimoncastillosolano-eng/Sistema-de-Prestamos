/* =========================================================
   ACCIONES / SERVICIOS SIMULADOS — escriben en el store reglas financieras incluidas.
   Cada acción revalida (nunca confía solo en el formulario) y devuelve un resultado explícito.
   ========================================================= */
import { CFG, USUARIO_DEMO } from '@/lib/config';
import { money } from '@/lib/format';
import { aplicarPagoAPrestamo, capitalPendienteCliente, generarCronograma, validarPago, validarSolicitud } from '@/lib/finance';
import type { Actividad, ActividadRef, Cliente, Db, MedioPago, Pago, Prestamo, TipoPago } from '@/types';
import { commit, getDb } from './store';

const siguienteNumero = (ids: string[], prefijo: string) =>
  ids.reduce((max, id) => Math.max(max, Number(id.replace(prefijo, '')) || 0), 0) + 1;

function marcaDeTiempo() {
  const d = new Date();
  return `${CFG.hoy} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const conActividad = (db: Db, tipo: string, desc: string, ref?: ActividadRef): Actividad[] =>
  [{ t: marcaDeTiempo(), usuario: USUARIO_DEMO.nombre, tipo, desc, ref }, ...db.actividad].slice(0, 40);

/* ---------- Clientes ---------- */
export type NuevoCliente = Omit<Cliente, 'id' | 'agencia' | 'asesor' | 'alta'>;

export type ResultadoCliente = { ok: true; cliente: Cliente } | { ok: false; error: string };

export function registrarCliente(datos: NuevoCliente): ResultadoCliente {
  const db = getDb();
  if (db.clientes.some((c) => c.doc === datos.doc)) {
    return { ok: false, error: 'Este documento ya está registrado. Búscalo en la lista para no crear un duplicado.' };
  }
  const cliente: Cliente = {
    id: 'C' + String(siguienteNumero(db.clientes.map((c) => c.id), 'C')).padStart(3, '0'),
    agencia: USUARIO_DEMO.agencia, asesor: USUARIO_DEMO.nombre, alta: CFG.hoy, ...datos
  };
  commit({ ...db, clientes: [...db.clientes, cliente], actividad: conActividad(db, 'Cliente registrado', 'Alta de ' + cliente.nombre, { entidad: 'cliente', id: cliente.id }) });
  return { ok: true, cliente };
}

/* ---------- Préstamos ---------- */
export interface NuevaSolicitud {
  clienteId: string;
  monto: number;
  plazo: number;
  desembolso: string;
  observaciones?: string;
}

export type ResultadoPrestamo = { ok: true; prestamo: Prestamo } | { ok: false; error: string };

export function crearPrestamo(s: NuevaSolicitud): ResultadoPrestamo {
  const db = getDb();
  const cliente = db.clientes.find((c) => c.id === s.clienteId);
  if (!cliente) return { ok: false, error: 'El cliente seleccionado no existe.' };
  const v = validarSolicitud({ ...s, deudaActual: capitalPendienteCliente(db.prestamos, s.clienteId) });
  const fallo = v.checks.find((c) => !c.ok);
  if (fallo) return { ok: false, error: fallo.ayuda };

  const prestamo: Prestamo = {
    id: 'PR-' + siguienteNumero(db.prestamos.map((p) => p.id), 'PR-').toString().padStart(4, '0'),
    clienteId: cliente.id, agencia: USUARIO_DEMO.agencia, capital: s.monto, plazo: s.plazo, tea: CFG.tea,
    desembolso: s.desembolso, asesor: USUARIO_DEMO.nombre,
    cronograma: generarCronograma(s.monto, s.plazo, s.desembolso), pagos: [], observaciones: s.observaciones ?? ''
  };
  commit({
    ...db, prestamos: [...db.prestamos, prestamo],
    actividad: conActividad(db, 'Préstamo desembolsado', `${prestamo.id} por ${money(s.monto)} a ${cliente.nombre}`, { entidad: 'prestamo', id: prestamo.id })
  });
  return { ok: true, prestamo };
}

/* ---------- Pagos y cancelación anticipada ---------- */
export interface NuevoPago {
  prestamoId: string;
  monto: number;
  fecha: string;
  medio: MedioPago;
  ref?: string;
  tipo: TipoPago;
}

export type ResultadoPago = { ok: true; operacion: Pago; prestamo: Prestamo } | { ok: false; error: string; campo?: string };

/** Registra un pago simulado. No hay cobro real ni conexión bancaria. */
export function registrarPago(n: NuevoPago): ResultadoPago {
  const db = getDb();
  const actual = db.prestamos.find((p) => p.id === n.prestamoId);
  if (!actual) return { ok: false, error: 'El préstamo no existe.', campo: 'prestamoId' };
  const v = validarPago(actual, n);
  if (!v.ok) return v;

  const operacion: Pago = { op: 'OP-' + db.contador, fecha: n.fecha, monto: v.monto, tipo: n.tipo, usuario: USUARIO_DEMO.nombre, medio: n.medio, ref: n.ref ?? '' };
  const prestamo = aplicarPagoAPrestamo(actual, operacion);
  const anticipada = n.tipo === 'Cancelación anticipada';
  commit({
    ...db, contador: db.contador + 1,
    prestamos: db.prestamos.map((p) => (p.id === prestamo.id ? prestamo : p)),
    actividad: conActividad(db, anticipada ? 'Cancelación anticipada' : 'Pago registrado', `${operacion.op} por ${money(v.monto)} en ${prestamo.id}`, { entidad: 'prestamo', id: prestamo.id })
  });
  return { ok: true, operacion, prestamo };
}
