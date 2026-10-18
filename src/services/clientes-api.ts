
import type { TipoCliente } from '@/types';

/** Fila que devuelve GET /api/clientes. */
export interface ClienteListado {
  id: string;
  numero: number;
  tipoDocumento: TipoCliente;
  numeroDocumento: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
}

/** Ficha que devuelve GET /api/clientes/{id}. */
export interface ClienteDetalle extends ClienteListado {
  dniTitular: string | null;
  domicilio: string | null;
  estadoSunat: string | null;
  condicionSunat: string | null;
  representanteNombre: string | null;
  representanteDni: string | null;
  agenciaId: string;
  nombreAgencia: string | null;
  /** Asesor que registró al cliente. */
  nombreAsesor: string | null;
  creadoEn: string;
}


export interface ConsultaDocumento {
  tipoDocumento: TipoCliente;
  numeroDocumento: string;
  nombre: string;
  dniTitular: string | null;
  domicilio: string | null;
  estadoSunat: string | null;
  condicionSunat: string | null;
  representanteNombre: string | null;
  representanteDni: string | null;
  habilitado: boolean;
  motivo: string | null;
}


export interface ClienteRegistrado {
  id: string;
  numero: number | null;
  tipoDocumento: TipoCliente;
  numeroDocumento: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  dniTitular: string | null;
  domicilio: string | null;
  estadoSunat: string | null;
  condicionSunat: string | null;
  representanteNombre: string | null;
  representanteDni: string | null;
  agenciaId: string;
  nombreAgencia: string;
  creadoEn: string | null;
}


export class ClientesApiError extends Error {
  constructor(readonly codigo: string, mensaje: string, readonly status = 0) {
    super(mensaje);
    this.name = 'ClientesApiError';
  }
}

const BASE = '/api/clientes';

const MENSAJE_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.';
const MENSAJE_DESCONOCIDO = 'No se pudo completar la operación. Inténtalo nuevamente.';

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
    throw new ClientesApiError('RED', MENSAJE_RED);
  }

  if (r.ok) {
    try { return (await r.json()) as T; } catch { throw new ClientesApiError('DESCONOCIDO', MENSAJE_DESCONOCIDO, r.status); }
  }

  if (r.status === 401) throw new ClientesApiError('NO_AUTENTICADO', 'Tu sesión ha expirado. Inicia sesión nuevamente.', 401);
  // 403 sin cuerpo propio: el servidor rechazó el token CSRF (p. ej. la página quedó abierta tras cerrar sesión).
  let codigo = 'DESCONOCIDO';
  let mensaje = r.status === 403 ? 'No se pudo validar la solicitud. Recarga la página e inténtalo nuevamente.' : MENSAJE_DESCONOCIDO;
  try {
    const j = (await r.json()) as { codigo?: string; mensaje?: string };
    if (j.codigo) codigo = j.codigo;
    if (j.mensaje) mensaje = j.mensaje;
  } catch { /* cuerpo no JSON (servidor caído o proxy) */ }
  throw new ClientesApiError(codigo, mensaje, r.status);
}

export const clientesApi = {

  consultar(tipo: TipoCliente, numero: string) {
    // encodeURIComponent: «RUC 10» viaja como RUC%2010 (no con «+»).
    return llamar<ConsultaDocumento>(`/consulta?tipo=${encodeURIComponent(tipo)}&numero=${encodeURIComponent(numero)}`, { method: 'GET' });
  },

  registrar(tipo: TipoCliente, numero: string, telefono: string, correo: string) {
    return llamar<ClienteRegistrado>('', {
      method: 'POST',
      body: { tipoDocumento: tipo, numeroDocumento: numero, telefono, correo }
    });
  }
};

export function listarClientes(): Promise<ClienteListado[]> {
  return llamar<ClienteListado[]>('', { method: 'GET' });
}

export async function consultarCliente(id: string): Promise<ClienteDetalle | null> {
  try {
    return await llamar<ClienteDetalle>(`/${encodeURIComponent(id)}`, { method: 'GET' });
  } catch (error) {
    if (error instanceof ClientesApiError && error.status === 404) return null;
    throw error;
  }
}
