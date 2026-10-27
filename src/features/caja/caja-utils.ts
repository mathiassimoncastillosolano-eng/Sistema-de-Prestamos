import type { CajaResumenApi, EstadoReposicionApi } from '@/services/caja-api';

export type Tono = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal' | 'navy';

export const ETIQUETA_ESTADO: Record<EstadoReposicionApi, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  OBSERVADA: 'Observada por gerencia',
  APROBADA: 'Aprobada, pendiente de envío',
  EN_TRANSITO: 'En tránsito',
  RECEPCION_PARCIAL: 'Recepción parcial',
  RECIBIDA: 'Recibida, pendiente de conciliación',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada'
};

export const TONO_ESTADO: Record<EstadoReposicionApi, Tono> = {
  PENDIENTE_APROBACION: 'warning',
  OBSERVADA: 'info',
  APROBADA: 'teal',
  EN_TRANSITO: 'navy',
  RECEPCION_PARCIAL: 'warning',
  RECIBIDA: 'teal',
  COMPLETADA: 'success',
  RECHAZADA: 'danger',
  CANCELADA: 'neutral'
};

/** Estados con una reposición «en trámite» (el servidor no deja abrir otra mientras exista alguna). */
export const ESTADOS_ABIERTOS: readonly EstadoReposicionApi[] = ['PENDIENTE_APROBACION', 'OBSERVADA', 'APROBADA', 'EN_TRANSITO', 'RECEPCION_PARCIAL'];

export const ESTADOS_TODOS = Object.keys(ETIQUETA_ESTADO) as EstadoReposicionApi[];

const ZONA = 'America/Lima';
const fmtFechaHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA });
const fmtFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: ZONA });

/** Instante ISO del servidor → «26 oct 2026, 10:15 a. m.» en hora de Lima. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtFechaHora.format(d);
}

export function soloFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtFecha.format(d);
}

/** Para <input type="datetime-local">: ahora en hora local del navegador, sin segundos. */
export function ahoraLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export const codigoRep = (numero: number) => `REP-${String(numero).padStart(4, '0')}`;

/** Umbral de «efectivo bajo»: orienta la pantalla, no decide nada (el servidor valida cada operación). */
export const SALDO_BAJO = 10_000;

export type EstadoCaja = 'cerrada' | 'llena' | 'vacia' | 'baja' | 'normal';

export function estadoCaja(c: Pick<CajaResumenApi, 'estado' | 'saldo' | 'limite'>): EstadoCaja {
  if (c.estado !== 'ABIERTA') return 'cerrada';
  if (c.saldo >= c.limite) return 'llena';
  if (c.saldo <= 0) return 'vacia';
  if (c.saldo < SALDO_BAJO) return 'baja';
  return 'normal';
}

/** Con menos del monto mínimo de un préstamo no hay ningún desembolso posible. */
export const puedeDesembolsar = (c: Pick<CajaResumenApi, 'estado' | 'saldo'>, capitalMinimo: number) =>
  c.estado === 'ABIERTA' && c.saldo >= capitalMinimo;

export const ETIQUETA_ACCION: Record<string, string> = {
  APROBAR: 'Aprobar',
  OBSERVAR: 'Pedir aclaración',
  RECHAZAR: 'Rechazar',
  DESPACHAR: 'Registrar envío',
  CERRAR_REMANENTE: 'Cerrar saldo pendiente',
  CONCILIAR: 'Conciliar',
  RESOLVER_INCIDENCIA: 'Resolver incidencia',
  REPORTAR_INCIDENCIA: 'Reportar incidencia',
  CANCELAR: 'Cancelar solicitud',
  RESPONDER: 'Responder aclaración',
  REGISTRAR_RECEPCION: 'Registrar recepción'
};
