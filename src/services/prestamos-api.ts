/* =========================================================
   CLIENTE DE LA API DE PRÉSTAMOS (US-04, US-05, US-06).
   - Misma sesión por cookie HttpOnly y protección CSRF que auth-api.ts.
   - El servidor fija fecha, tasa, asesor, agencia y estado: aquí solo se envían cliente, capital, plazo y observaciones.
   - El navegador NO calcula cuotas, fechas ni saldos: simulación, listado y detalle vienen del servidor (misma fórmula
     y misma fecha de Lima que el registro).
   ========================================================= */

export type CodigoPrestamo =
  | 'DATOS_INVALIDOS'
  | 'SIN_PERMISO'
  | 'CLIENTE_NO_ENCONTRADO'
  | 'PRESTAMO_NO_ENCONTRADO'
  | 'CLIENTE_NO_APTO'
  | 'CAPITAL_BAJO_MINIMO'
  | 'PLAZO_FUERA_DE_RANGO'
  | 'MONEDA_NO_PERMITIDA'
  | 'LIMITE_EXCEDIDO'
  | 'CONDICIONES_DESACTUALIZADAS'
  | 'NO_AUTENTICADO'
  | 'RED'
  | 'DESCONOCIDO';

/** Estados permitidos (CHECK de la BD). Los de cuota se muestran tal cual. */
export type EstadoPrestamoApi = 'Vigente' | 'En mora' | 'Cancelado';
export type EstadoCuotaApi = 'PENDIENTE' | 'PAGADA' | 'VENCIDA';

export interface CuotaApi {
  numero: number;
  fechaVencimiento: string; // yyyy-MM-dd
  capital: number;
  interes: number;
  importeCuota: number;
  saldo: number;
}

export interface PrestamoApi {
  id: string;
  numero: number;
  clienteId: string;
  agenciaId: string;
  asesorId: string;
  moneda: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
  estado: EstadoPrestamoApi;
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  cuotas: CuotaApi[];
}

/** Fila de GET /api/prestamos?clienteId=… (mismos saldos y estados que el listado y el detalle). */
export interface PrestamoResumenApi {
  id: string;
  numero: number;
  capital: number;
  plazoMeses: number;
  fechaDesembolso: string; // yyyy-MM-dd
  estado: PrestamoApi['estado'];
  totalContractual: number;
  capitalPendiente: number;
  totalPendiente: number;
  proximoVencimiento: string | null;
}

export interface SolicitudPrestamoApi {
  clienteId: string;
  capital: number;
  plazoMeses: number;
  observaciones?: string;
  /** Lo que el asesor revisó: si el servidor calcula otra cosa, rechaza el registro (CONDICIONES_DESACTUALIZADAS). */
  fechaDesembolsoEsperada?: string;
  totalContractualEsperado?: number;
}

/** GET /api/prestamos/condiciones: reglas vigentes y fechas de una solicitud nueva (fecha de Lima). */
export interface CondicionesApi {
  moneda: string;
  tea: number;
  capitalMinimo: number;
  limiteEndeudamiento: number;
  plazoMinimoMeses: number;
  plazoMaximoMeses: number;
  zonaHoraria: string;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
}

/** POST /api/prestamos/simulacion: cronograma que se guardaría hoy. No se persiste nada. */
export interface SimulacionApi {
  moneda: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  cuotas: CuotaApi[];
}

/** Fila de GET /api/prestamos (alcance de la sesión). */
export interface PrestamoListadoApi {
  id: string;
  numero: number;
  clienteId: string;
  clienteNombre: string;
  clienteTipoDocumento: string;
  clienteNumeroDocumento: string;
  agenciaNombre: string;
  asesorNombre: string;
  propio: boolean;
  capital: number;
  plazoMeses: number;
  fechaDesembolso: string;
  estado: EstadoPrestamoApi;
  totalContractual: number;
  capitalPendiente: number;
  totalPendiente: number;
  proximoVencimiento: string | null;
  cuotasVencidas: number;
}

export interface CuotaDetalleApi extends CuotaApi {
  estado: EstadoCuotaApi;
  /** Parte de la cuota que aún no figura como pagada. */
  importePendiente: number;
  diasAtraso: number;
}

export interface EventoHistorialApi {
  /** yyyy-MM-dd HH:mm (America/Lima) */
  fechaHora: string;
  tipo: string;
  descripcion: string;
  usuario: string;
}

/** GET /api/prestamos/{id}. */
export interface PrestamoDetalleApi {
  id: string;
  numero: number;
  clienteId: string;
  clienteNombre: string;
  clienteTipoDocumento: string;
  clienteNumeroDocumento: string;
  agenciaNombre: string;
  asesorNombre: string;
  moneda: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
  fechaUltimoVencimiento: string;
  estado: EstadoPrestamoApi;
  observaciones: string | null;
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  capitalPendiente: number;
  totalPendiente: number;
  proximoVencimiento: string | null;
  cuotasVencidas: number;
  cuotas: CuotaDetalleApi[];
  historial: EventoHistorialApi[];
}

/** Detalle que acompaña a LIMITE_EXCEDIDO. */
export interface DetalleLimite {
  acumulado: number;
  limite: number;
  excedente: number;
}

export class PrestamoApiError extends Error {
  constructor(
    readonly codigo: CodigoPrestamo,
    mensaje: string,
    readonly status = 0,
    readonly detalle: unknown = null
  ) {
    super(mensaje);
    this.name = 'PrestamoApiError';
  }
}

const CODIGOS = new Set<string>([
  'DATOS_INVALIDOS', 'SIN_PERMISO', 'CLIENTE_NO_ENCONTRADO', 'PRESTAMO_NO_ENCONTRADO', 'CLIENTE_NO_APTO',
  'CAPITAL_BAJO_MINIMO', 'PLAZO_FUERA_DE_RANGO', 'MONEDA_NO_PERMITIDA', 'LIMITE_EXCEDIDO', 'CONDICIONES_DESACTUALIZADAS'
]);

const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.';
const MSG_SESION = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
const MSG_GENERICO = 'No se pudo completar la operación. Inténtalo nuevamente.';

/** Extrae el detalle del límite si el error es LIMITE_EXCEDIDO; si no, devuelve null. */
export function detalleLimite(e: unknown): DetalleLimite | null {
  if (!(e instanceof PrestamoApiError) || e.codigo !== 'LIMITE_EXCEDIDO') return null;
  const d = e.detalle as Partial<DetalleLimite> | null;
  if (!d || typeof d.acumulado !== 'number' || typeof d.limite !== 'number' || typeof d.excedente !== 'number') return null;
  return { acumulado: d.acumulado, limite: d.limite, excedente: d.excedente };
}

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split('; ').find((c) => c.startsWith(nombre + '='));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

/** Si no hay cookie XSRF-TOKEN, el servidor la emite en una consulta GET inofensiva. */
async function asegurarCsrf(): Promise<void> {
  if (leerCookie('XSRF-TOKEN')) return;
  try {
    await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    /* si es un fallo de red, la llamada principal informará del suyo */
  }
}

async function llamar<T>(ruta: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (init.method !== 'GET') {
    await asegurarCsrf();
    const xsrf = leerCookie('XSRF-TOKEN');
    if (xsrf) cabeceras['X-XSRF-TOKEN'] = xsrf;
  }

  let r: Response;
  try {
    r = await fetch('/api/prestamos' + ruta, {
      method: init.method,
      headers: cabeceras,
      credentials: 'same-origin',
      cache: 'no-store',
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch {
    throw new PrestamoApiError('RED', MSG_RED);
  }

  if (r.ok) {
    try {
      return (await r.json()) as T;
    } catch {
      throw new PrestamoApiError('DESCONOCIDO', MSG_GENERICO, r.status);
    }
  }

  if (r.status === 401) throw new PrestamoApiError('NO_AUTENTICADO', MSG_SESION, 401);

  // Cuerpo de error del servidor: { codigo, mensaje, detalle }
  let codigo: CodigoPrestamo = 'DESCONOCIDO';
  let mensaje = MSG_GENERICO;
  let detalle: unknown = null;
  try {
    const j = (await r.json()) as { codigo?: string; mensaje?: string; detalle?: unknown };
    if (j.codigo && CODIGOS.has(j.codigo)) codigo = j.codigo as CodigoPrestamo;
    if (r.status < 500 && typeof j.mensaje === 'string' && j.mensaje) mensaje = j.mensaje;
    detalle = j.detalle ?? null;
  } catch {
    /* cuerpo no JSON */
  }
  throw new PrestamoApiError(codigo, mensaje, r.status, detalle);
}

export const prestamosApi = {
  /** US-04/05/06: registra el préstamo y su cronograma de forma atómica. */
  registrar(solicitud: SolicitudPrestamoApi): Promise<PrestamoApi> {
    return llamar<PrestamoApi>('', { method: 'POST', body: solicitud });
  },
  /** Reglas vigentes y fechas de desembolso / primera cuota (fecha de Lima, calculadas por el servidor). */
  condiciones(): Promise<CondicionesApi> {
    return llamar<CondicionesApi>('/condiciones', { method: 'GET' });
  },
  /** Cronograma que se guardaría hoy con ese capital y plazo. No registra nada. */
  simular(solicitud: { capital: number; plazoMeses: number }): Promise<SimulacionApi> {
    return llamar<SimulacionApi>('/simulacion', { method: 'POST', body: solicitud });
  },
  /** Listado de préstamos de la sesión (gerencia: todos; asesor: su agencia). */
  listar(): Promise<PrestamoListadoApi[]> {
    return llamar<PrestamoListadoApi[]>('', { method: 'GET' });
  },
  /** Préstamos de un cliente en todas las agencias, del más reciente al más antiguo. */
  listarPorCliente(clienteId: string): Promise<PrestamoResumenApi[]> {
    return llamar<PrestamoResumenApi[]>(`?clienteId=${encodeURIComponent(clienteId)}`, { method: 'GET' });
  },
  /** US-06: consulta el préstamo con el cronograma guardado. */
  consultar(id: string): Promise<PrestamoDetalleApi> {
    return llamar<PrestamoDetalleApi>(`/${encodeURIComponent(id)}`, { method: 'GET' });
  }
};