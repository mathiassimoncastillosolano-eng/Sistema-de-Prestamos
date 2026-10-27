/* =========================================================
   CLIENTE DE LA API DE CAJA Y REPOSICIONES.
   - Misma sesión por cookie HttpOnly y protección CSRF que prestamos-api.ts.
   - El navegador NO calcula saldos, capacidad ni estados: todo viene del servidor. Aquí solo se envía lo que el usuario
     escribe (monto, motivo, comentarios, código Hermes) y una clave de idempotencia por operación.
   - El código Hermes viaja solo en el cuerpo de la aprobación: no se guarda en estado persistente, ni en la URL, ni en
     el almacenamiento del navegador.
   ========================================================= */

export type CodigoCaja =
  | 'DATOS_INVALIDOS' | 'SIN_PERMISO' | 'CAJA_NO_ENCONTRADA' | 'REPOSICION_NO_ENCONTRADA' | 'INCIDENCIA_NO_ENCONTRADA'
  | 'CAJA_CERRADA' | 'REPOSICION_EN_TRAMITE' | 'MONTO_EXCEDE_CAPACIDAD' | 'ESTADO_INVALIDO' | 'VERSION_DESACTUALIZADA'
  | 'CONFLICTO_CONCURRENCIA' | 'CODIGO_HERMES_FORMATO' | 'CODIGO_HERMES_INVALIDO' | 'CODIGO_HERMES_REUTILIZADO'
  | 'HERMES_NO_CONFIGURADO' | 'HERMES_NO_DISPONIBLE' | 'HERMES_BLOQUEADO' | 'EXCEDE_AUTORIZADO' | 'EXCEDE_LIMITE_CAJA'
  | 'FECHA_RECEPCION_INVALIDA' | 'INCIDENCIAS_ABIERTAS' | 'NADA_PENDIENTE' | 'INCONSISTENCIA_DATOS'
  | 'NO_AUTENTICADO' | 'RED' | 'DESCONOCIDO';

export type EstadoReposicionApi =
  | 'PENDIENTE_APROBACION' | 'OBSERVADA' | 'APROBADA' | 'EN_TRANSITO' | 'RECEPCION_PARCIAL'
  | 'RECIBIDA' | 'COMPLETADA' | 'RECHAZADA' | 'CANCELADA';

export type MotivoReposicionApi = 'DESEMBOLSOS_PROGRAMADOS' | 'ALTA_DEMANDA' | 'RECUPERACION_CAPACIDAD' | 'OTRO';

export const MOTIVOS: readonly { valor: MotivoReposicionApi; etiqueta: string }[] = [
  { valor: 'DESEMBOLSOS_PROGRAMADOS', etiqueta: 'Desembolsos programados' },
  { valor: 'ALTA_DEMANDA', etiqueta: 'Alta demanda de operaciones' },
  { valor: 'RECUPERACION_CAPACIDAD', etiqueta: 'Recuperación de capacidad operativa' },
  { valor: 'OTRO', etiqueta: 'Otro motivo' }
];

export type AccionReposicion =
  | 'APROBAR' | 'OBSERVAR' | 'RECHAZAR' | 'DESPACHAR' | 'CERRAR_REMANENTE' | 'CONCILIAR' | 'RESOLVER_INCIDENCIA'
  | 'REPORTAR_INCIDENCIA' | 'CANCELAR' | 'RESPONDER' | 'REGISTRAR_RECEPCION';

/** Límites de texto que el servidor también exige (se repiten aquí solo para guiar al usuario). */
export const LIMITES_TEXTO = { comentarioMin: 10, justificacionMin: 10, max: 1000, referenciaMax: 120 } as const;
export const CODIGO_HERMES_LARGO = 8;

export interface CajaResumenApi {
  cajaId: string;
  asesorId: string;
  asesor: string;
  agenciaId: string;
  agencia: string;
  estado: 'ABIERTA' | 'CERRADA';
  limite: number;
  /** Efectivo físico contabilizado. Lo autorizado o enviado que aún no se recibió NO está aquí. */
  saldo: number;
  saldoInicial: number;
  capacidadHastaLimite: number;
  autorizadoPendienteRecepcion: number;
  /** Lo máximo que se puede solicitar ahora. */
  capacidadLibre: number;
  saldoProyectado: number;
  reposicionAbierta: ReposicionFilaApi | null;
  ultimaRecepcion: { importe: number; registradoEn: string; reposicionNumero: number } | null;
  incidenciasAbiertas: number;
  abiertaEn: string;
  ahora: string;
}

export interface MovimientoApi {
  id: string;
  numero: number;
  tipo: 'APERTURA' | 'DESEMBOLSO' | 'REPOSICION' | 'AJUSTE';
  sentido: 'ENTRADA' | 'SALIDA';
  importe: number;
  saldoAntes: number;
  saldoDespues: number;
  prestamoNumero: number | null;
  reposicionNumero: number | null;
  referencia: string | null;
  registradoPor: string;
  creadoEn: string;
}

/** `pagina` empieza en 1. */
export interface PaginaApi<T> { items: T[]; total: number; pagina: number; tamano: number; ahora: string }

export interface ReposicionFilaApi {
  id: string;
  numero: number;
  codigo: string;
  asesorId: string;
  asesor: string;
  agenciaId: string;
  agencia: string;
  estado: EstadoReposicionApi;
  estadoEtiqueta: string;
  motivo: MotivoReposicionApi;
  montoSolicitado: number;
  montoAutorizado: number | null;
  montoEnviado: number | null;
  totalRecibido: number;
  remanenteCerrado: number;
  pendienteRecepcion: number;
  saldoAlSolicitar: number;
  capacidadAlSolicitar: number;
  incidenciasAbiertas: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface RecepcionApi {
  id: string;
  importe: number;
  recibidoEnDeclarado: string | null;
  registradoEn: string;
  registradoPor: string;
  referencia: string | null;
  comentarios: string | null;
}

export interface IncidenciaApi {
  id: string;
  tipo: string;
  importe: number;
  descripcion: string;
  estado: 'ABIERTA' | 'RESUELTA';
  reportadaPor: string;
  reportadaEn: string;
  resueltaPor: string | null;
  resueltaEn: string | null;
  resolucion: string | null;
}

export interface EventoLineaApi {
  accion: string;
  etiqueta: string;
  actor: string;
  importe: number | null;
  detalle: string | null;
  creadoEn: string;
}

export interface ReposicionDetalleApi {
  fila: ReposicionFilaApi;
  motivoEtiqueta: string;
  comentarios: string;
  justificacionDecision: string | null;
  decididoPor: string | null;
  decididoEn: string | null;
  enviadoPor: string | null;
  enviadoEn: string | null;
  referenciaEnvio: string | null;
  cierreRemanenteMotivo: string | null;
  cierreRemanentePor: string | null;
  cierreRemanenteEn: string | null;
  conciliadoPor: string | null;
  conciliadoEn: string | null;
  conciliacionNota: string | null;
  version: number;
  hermesVerificada: boolean;
  caja: { saldoActual: number; limite: number; autorizadoPendienteOtras: number; capacidadLibre: number; capacidadHastaLimite: number };
  recepciones: RecepcionApi[];
  incidencias: IncidenciaApi[];
  linea: EventoLineaApi[];
  acciones: AccionReposicion[];
  ahora: string;
}

export interface PendientesApi {
  solicitudesPorRevisar: number;
  recepcionesPorRegistrar: number;
  observadas: number;
  porConciliar: number;
  incidenciasAbiertas: number;
  enTransito: number;
  ahora: string;
}

export interface CajaSupervisionApi {
  cajaId: string;
  asesorId: string;
  asesor: string;
  agenciaId: string;
  agencia: string;
  estado: string;
  saldo: number;
  limite: number;
  autorizadoPendiente: number;
  enTransito: number;
  recepcionesParciales: number;
  reposicionesPorRevisar: number;
  diferenciasPendientes: number;
  incidenciasAbiertas: number;
  saldoCoincideConLibro: boolean;
  alertas: string[];
}

export interface SupervisionApi {
  cajas: CajaSupervisionApi[];
  agencias: { agenciaId: string; agencia: string; cajas: number; saldoTotal: number; autorizadoPendiente: number }[];
  saldoTotal: number;
  autorizadoPendienteTotal: number;
  enTransitoTotal: number;
  diferenciasPendientesTotal: number;
  alertasTotal: number;
  ahora: string;
}

export interface ReporteApi {
  desde: string | null;
  hasta: string | null;
  saldoInicial: number;
  entradas: number;
  salidas: number;
  saldoActual: number;
  totalSolicitado: number;
  totalAutorizado: number;
  totalEnviado: number;
  totalRecibido: number;
  totalConciliado: number;
  diferenciasPendientes: number;
  reposiciones: number;
  ahora: string;
}

export interface FiltroReposiciones {
  estados?: EstadoReposicionApi[];
  q?: string;
  agenciaId?: string;
  asesorId?: string;
  desde?: string;
  hasta?: string;
  orden?: string;
  pagina?: number;
  tamano?: number;
}

export class CajaApiError extends Error {
  constructor(
    readonly codigo: CodigoCaja,
    mensaje: string,
    readonly status = 0,
    readonly detalle: Record<string, unknown> | null = null
  ) {
    super(mensaje);
    this.name = 'CajaApiError';
  }
}

const CODIGOS = new Set<string>([
  'DATOS_INVALIDOS', 'SIN_PERMISO', 'CAJA_NO_ENCONTRADA', 'REPOSICION_NO_ENCONTRADA', 'INCIDENCIA_NO_ENCONTRADA',
  'CAJA_CERRADA', 'REPOSICION_EN_TRAMITE', 'MONTO_EXCEDE_CAPACIDAD', 'ESTADO_INVALIDO', 'VERSION_DESACTUALIZADA',
  'CONFLICTO_CONCURRENCIA', 'CODIGO_HERMES_FORMATO', 'CODIGO_HERMES_INVALIDO', 'CODIGO_HERMES_REUTILIZADO',
  'HERMES_NO_CONFIGURADO', 'HERMES_NO_DISPONIBLE', 'HERMES_BLOQUEADO', 'EXCEDE_AUTORIZADO', 'EXCEDE_LIMITE_CAJA',
  'FECHA_RECEPCION_INVALIDA', 'INCIDENCIAS_ABIERTAS', 'NADA_PENDIENTE', 'INCONSISTENCIA_DATOS'
]);

const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.';
const MSG_SESION = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
const MSG_GENERICO = 'No se pudo completar la operación. Inténtalo nuevamente.';

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split('; ').find((c) => c.startsWith(nombre + '='));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

async function asegurarCsrf(): Promise<void> {
  if (leerCookie('XSRF-TOKEN')) return;
  try {
    await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    /* si es un fallo de red, la llamada principal informará del suyo */
  }
}

async function enviar(ruta: string, init: { method: 'GET' | 'POST'; body?: unknown; aceptar?: string }): Promise<Response> {
  const cabeceras: Record<string, string> = { Accept: init.aceptar ?? 'application/json' };
  if (init.body !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (init.method !== 'GET') {
    await asegurarCsrf();
    const xsrf = leerCookie('XSRF-TOKEN');
    if (xsrf) cabeceras['X-XSRF-TOKEN'] = xsrf;
  }
  let r: Response;
  try {
    r = await fetch(ruta, {
      method: init.method,
      headers: cabeceras,
      credentials: 'same-origin',
      cache: 'no-store',
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch {
    throw new CajaApiError('RED', MSG_RED);
  }
  if (r.ok) return r;
  if (r.status === 401) throw new CajaApiError('NO_AUTENTICADO', MSG_SESION, 401);
  let codigo: CodigoCaja = 'DESCONOCIDO';
  let mensaje = MSG_GENERICO;
  let detalle: Record<string, unknown> | null = null;
  try {
    const j = (await r.json()) as { codigo?: string; mensaje?: string; detalle?: unknown };
    if (j.codigo && CODIGOS.has(j.codigo)) codigo = j.codigo as CodigoCaja;
    if (r.status < 500 && typeof j.mensaje === 'string' && j.mensaje) mensaje = j.mensaje;
    if (j.detalle && typeof j.detalle === 'object') detalle = j.detalle as Record<string, unknown>;
  } catch {
    /* cuerpo no JSON */
  }
  throw new CajaApiError(codigo, mensaje, r.status, detalle);
}

async function llamar<T>(ruta: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const r = await enviar(ruta, init);
  try {
    return (await r.json()) as T;
  } catch {
    throw new CajaApiError('DESCONOCIDO', MSG_GENERICO, r.status);
  }
}

function consulta(f: FiltroReposiciones): string {
  const p = new URLSearchParams();
  if (f.estados?.length) p.set('estados', f.estados.join(','));
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.agenciaId) p.set('agenciaId', f.agenciaId);
  if (f.asesorId) p.set('asesorId', f.asesorId);
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  if (f.orden) p.set('orden', f.orden);
  if (f.pagina !== undefined) p.set('pagina', String(f.pagina));
  if (f.tamano !== undefined) p.set('tamano', String(f.tamano));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Clave que identifica UNA intención del usuario: un reintento o un doble clic la repite y el servidor no duplica. */
export function nuevaClaveIdempotencia(): string {
  const u = globalThis.crypto?.randomUUID?.();
  return u ?? `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** El código Hermes son exactamente 8 dígitos. Que tenga el formato correcto NO significa que sea válido: lo decide Hermes. */
export const formatoCodigoHermes = (c: string) => /^[0-9]{8}$/.test(c);

export const cajaApi = {
  resumen: () => llamar<CajaResumenApi>('/api/caja', { method: 'GET' }),
  /** `pagina` empieza en 1, como el servidor. */
  movimientos: (pagina = 1, tamano = 20) =>
    llamar<PaginaApi<MovimientoApi>>(`/api/caja/movimientos?pagina=${pagina}&tamano=${tamano}`, { method: 'GET' }),
  pendientes: () => llamar<PendientesApi>('/api/caja/pendientes', { method: 'GET' }),
  reporte: (f: FiltroReposiciones = {}) => llamar<ReporteApi>(`/api/caja/reportes/resumen${consulta(f)}`, { method: 'GET' }),
  async descargarCsv(f: FiltroReposiciones = {}): Promise<Blob> {
    const r = await enviar(`/api/caja/reportes/reposiciones.csv${consulta(f)}`, { method: 'GET', aceptar: 'text/csv' });
    return r.blob();
  },
  supervision: () => llamar<SupervisionApi>('/api/supervision/cajas', { method: 'GET' }),

  listar: (f: FiltroReposiciones = {}) => llamar<PaginaApi<ReposicionFilaApi>>(`/api/reposiciones${consulta(f)}`, { method: 'GET' }),
  detalle: (id: string) => llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}`, { method: 'GET' }),
  solicitar: (cuerpo: { monto: number; motivo: MotivoReposicionApi; comentarios: string; claveIdempotencia: string }) =>
    llamar<ReposicionDetalleApi>('/api/reposiciones', { method: 'POST', body: cuerpo }),
  aprobar: (id: string, cuerpo: { montoAutorizado: number; justificacion?: string; codigoHermes: string; version: number }) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/aprobar`, { method: 'POST', body: cuerpo }),
  rechazar: (id: string, texto: string, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/rechazar`, { method: 'POST', body: { texto, version } }),
  observar: (id: string, texto: string, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/observar`, { method: 'POST', body: { texto, version } }),
  responder: (id: string, texto: string, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/responder`, { method: 'POST', body: { texto, version } }),
  cancelar: (id: string, texto: string | undefined, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/cancelar`, { method: 'POST', body: { texto, version } }),
  despachar: (id: string, cuerpo: { montoEnviado: number; referencia?: string; comentarios?: string; version: number }) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/despachar`, { method: 'POST', body: cuerpo }),
  recibir: (id: string, cuerpo: { importe: number; recibidoEn?: string; referencia?: string; comentarios?: string; claveIdempotencia: string }) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/recepciones`, { method: 'POST', body: cuerpo }),
  reportarIncidencia: (id: string, cuerpo: { tipo: 'EXCEDENTE' | 'FALTANTE' | 'OTRO'; importe: number; descripcion: string }) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/incidencias`, { method: 'POST', body: cuerpo }),
  resolverIncidencia: (incidenciaId: string, resolucion: string) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/incidencias/${incidenciaId}/resolver`, { method: 'POST', body: { resolucion } }),
  cerrarRemanente: (id: string, texto: string, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/cerrar-remanente`, { method: 'POST', body: { texto, version } }),
  conciliar: (id: string, texto: string | undefined, version: number) =>
    llamar<ReposicionDetalleApi>(`/api/reposiciones/${id}/conciliar`, { method: 'POST', body: { texto, version } })
};

/** Mensaje para el usuario: el del servidor si lo hay; si no, uno genérico. */
export const mensajeError = (e: unknown, defecto = MSG_GENERICO) => (e instanceof Error && e.message ? e.message : defecto);
