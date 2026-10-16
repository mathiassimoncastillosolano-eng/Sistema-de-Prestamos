/* =========================================================
   CLIENTE DE LA API DE AUTENTICACIÓN.
   - Sesión por cookie HttpOnly emitida por el servidor: el navegador no ve ni guarda ningún token.
   - Protección CSRF: el servidor emite la cookie XSRF-TOKEN y aquí se reenvía en la cabecera X-XSRF-TOKEN.
   - Las credenciales viajan solo en el cuerpo de un POST; nunca se registran ni se guardan.
   ========================================================= */
import type { Sesion } from '@/types/auth';

export type CodigoError =
  | 'CREDENCIALES_INVALIDAS'
  | 'CUENTA_DESACTIVADA'
  | 'AGENCIA_INACTIVA'
  | 'AGENCIA_NO_ASIGNADA'
  | 'ROL_NO_RECONOCIDO'
  | 'DEMASIADOS_INTENTOS'
  | 'NO_AUTENTICADO'
  | 'RED'
  | 'DESCONOCIDO';

export class ApiError extends Error {
  constructor(readonly codigo: CodigoError, mensaje: string, readonly status = 0) {
    super(mensaje);
    this.name = 'ApiError';
  }
}

/** Mensajes en español. El servidor envía un código estable; el texto visible se decide aquí. */
const MENSAJES: Record<CodigoError, string> = {
  CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
  CUENTA_DESACTIVADA: 'Tu cuenta está desactivada. Contacta con el administrador.',
  AGENCIA_INACTIVA: 'Tu agencia está inactiva. Contacta con el administrador.',
  AGENCIA_NO_ASIGNADA: 'Tu cuenta no tiene una agencia asignada. Contacta con el administrador.',
  ROL_NO_RECONOCIDO: 'Tu cuenta tiene un rol no reconocido. Contacta con el administrador.',
  DEMASIADOS_INTENTOS: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  NO_AUTENTICADO: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
  RED: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.',
  DESCONOCIDO: 'No se pudo iniciar sesión. Inténtalo nuevamente.'
};

const CODIGOS = new Set<string>(Object.keys(MENSAJES));
export const mensajeDe = (c: CodigoError) => MENSAJES[c];

const BASE = '/api/auth';

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split('; ').find((c) => c.startsWith(nombre + '='));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

async function llamar<T>(ruta: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (init.method !== 'GET') {
    const xsrf = leerCookie('XSRF-TOKEN');
    if (xsrf) cabeceras['X-XSRF-TOKEN'] = xsrf;
  }

  let r: Response;
  try {
    r = await fetch(BASE + ruta, {
      method: init.method,
      headers: cabeceras,
      credentials: 'same-origin',
      cache: 'no-store',
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch {
    throw new ApiError('RED', MENSAJES.RED);
  }

  if (r.ok) {
    if (r.status === 204) return undefined as T;
    try { return (await r.json()) as T; } catch { throw new ApiError('DESCONOCIDO', MENSAJES.DESCONOCIDO, r.status); }
  }

  // El cuerpo de error es { codigo, mensaje }. Si el servidor está caído o un proxy devuelve HTML, se trata como desconocido.
  let codigo: CodigoError = r.status === 401 ? 'NO_AUTENTICADO' : 'DESCONOCIDO';
  try {
    const j = (await r.json()) as { codigo?: string };
    if (j.codigo && CODIGOS.has(j.codigo)) codigo = j.codigo as CodigoError;
  } catch { /* cuerpo no JSON */ }
  if (r.status >= 500) codigo = 'DESCONOCIDO';
  throw new ApiError(codigo, MENSAJES[codigo], r.status);
}

/**
 * Al cerrar sesión, Spring Security borra la cookie XSRF-TOKEN. El siguiente POST /login saldría sin la cabecera
 * X-XSRF-TOKEN, el servidor lo rechazaría (y el rechazo llega al navegador como 401 → «sesión expirada») y solo el
 * segundo clic funcionaría, porque aquella respuesta ya traía una cookie nueva. Si no hay cookie, se obtiene ANTES
 * de enviar las credenciales con una consulta GET inofensiva (el servidor la emite incluso en sus respuestas 401).
 * No es un reintento del login: las credenciales se envían una sola vez.
 */
async function asegurarCsrf(): Promise<void> {
  if (leerCookie('XSRF-TOKEN')) return;
  try {
    await llamar<Sesion>('/me', { method: 'GET' });
  } catch {
    /* 401 esperado (no hay sesión); si fue un fallo de red, el login informará del suyo */
  }
}

export const authApi = {
  /** Devuelve la sesión vigente o `null` si no hay sesión. Cualquier otro fallo (red, 5xx) se propaga. */
  async sesionActual(): Promise<Sesion | null> {
    try {
      return await llamar<Sesion>('/me', { method: 'GET' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  async login(correo: string, clave: string) {
    await asegurarCsrf();
    return llamar<Sesion>('/login', { method: 'POST', body: { correo, clave } });
  },
  /** Solo resuelve cuando el servidor confirma el cierre. */
  async logout(): Promise<void> {
    await llamar<void>('/logout', { method: 'POST' });
  }
};
