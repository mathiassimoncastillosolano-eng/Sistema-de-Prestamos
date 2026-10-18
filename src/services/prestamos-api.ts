/* =========================================================
   CLIENTE DE LA API DE PRÉSTAMOS (US-04, US-05, US-06).
   - Misma sesión por cookie HttpOnly y protección CSRF que auth-api.ts.
   - El servidor fija fecha, tasa, asesor, agencia y estado: aquí solo se envían cliente, capital, plazo y observaciones.
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
  | 'NO_AUTENTICADO'
  | 'RED'
  | 'DESCONOCIDO';

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
  estado: 'activo' | 'cerrado';
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  cuotas: CuotaApi[];
}

export interface SolicitudPrestamoApi {
  clienteId: string;
  capital: number;
  plazoMeses: number;
  observaciones?: string;
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
  'CAPITAL_BAJO_MINIMO', 'PLAZO_FUERA_DE_RANGO', 'MONEDA_NO_PERMITIDA', 'LIMITE_EXCEDIDO'
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
  /** US-06: consulta el préstamo con el cronograma guardado. */
  consultar(id: string): Promise<PrestamoApi> {
    return llamar<PrestamoApi>(`/${encodeURIComponent(id)}`, { method: 'GET' });
  }
};