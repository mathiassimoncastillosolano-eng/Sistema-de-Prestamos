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

/* ---------- Paginación del cronograma (solo presentación: el conjunto completo nunca se altera) ---------- */
export const TAMANOS_PAGINA = [10, 20, 30] as const;
export const TAMANO_PAGINA_INICIAL = 10;

export interface PaginaCronograma<T> {
  /** Subconjunto visible (misma referencia de cada fila: no se copian ni se modifican). */
  visibles: T[];
  /** Página efectiva, ya acotada a [1, paginas]. */
  pagina: number;
  paginas: number;
  total: number;
  /** Rango visible, 1-based e inclusivo (0–0 si no hay filas). */
  desde: number;
  hasta: number;
}

/** Calcula índices inicial/final y extrae la página. Tolera listas vacías y páginas fuera de rango. */
export function paginar<T>(filas: readonly T[], pagina: number, tamano: number): PaginaCronograma<T> {
  const t = Math.max(1, Math.floor(tamano) || TAMANO_PAGINA_INICIAL);
  const total = filas.length;
  const paginas = Math.max(1, Math.ceil(total / t));
  const actual = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  const inicio = (actual - 1) * t;
  const fin = Math.min(inicio + t, total);
  return { visibles: filas.slice(inicio, fin), pagina: actual, paginas, total, desde: total === 0 ? 0 : inicio + 1, hasta: fin };
}

/** Botones numerados: todas si son pocas; si no, primera, última y la vecindad de la actual con puntos suspensivos. */
export function paginasVisibles(actual: number, paginas: number): Array<number | '…'> {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const set = new Set<number>([1, paginas, actual - 1, actual, actual + 1]);
  if (actual <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (actual >= paginas - 2) [paginas - 1, paginas - 2, paginas - 3].forEach((n) => set.add(n));
  const orden = [...set].filter((n) => n >= 1 && n <= paginas).sort((a, b) => a - b);
  const salida: Array<number | '…'> = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - (orden[i - 1] as number) > 1) salida.push('…');
    salida.push(n);
  });
  return salida;
}
