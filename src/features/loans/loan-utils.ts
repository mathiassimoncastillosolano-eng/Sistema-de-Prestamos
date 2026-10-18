import type { EstadoCuotaApi, EstadoPrestamoApi } from '@/services/prestamos-api';

/** Los únicos estados de un préstamo formalizado (CHECK `prestamos_estado_ck`), en el orden de los filtros. */
export const ESTADOS_PRESTAMO: readonly EstadoPrestamoApi[] = ['Vigente', 'En mora', 'Cancelado'];
/** Los únicos estados de una cuota (CHECK `cuotas_estado_ck`). */
export const ESTADOS_CUOTA: readonly EstadoCuotaApi[] = ['PENDIENTE', 'PAGADA', 'VENCIDA'];

/** Código visible del préstamo: el número que genera la BD (arranca en 1001) → «PR-1001». */
export const codigoPrestamo = (numero: number) => `PR-${numero}`;

/** Fila de cronograma común a la simulación y al préstamo guardado (la simulación no tiene estado). */
export interface FilaCronograma {
  numero: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  importeCuota: number;
  saldo: number;
  estado?: EstadoCuotaApi;
  importePendiente?: number;
  diasAtraso?: number;
}

export interface TotalesCronograma {
  capital: number;
  intereses: number;
  total: number;
}

/** Adapta cuotas del servidor (simulación o detalle) a la fila que usan la tabla, el modal y el PDF. */
export const aFilas = (cuotas: Array<{ numero: number; fechaVencimiento: string; capital: number; interes: number; importeCuota: number; saldo: number; estado?: EstadoCuotaApi; importePendiente?: number; diasAtraso?: number }>): FilaCronograma[] =>
  cuotas.map((c) => ({ ...c }));
