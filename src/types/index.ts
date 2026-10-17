/** Modelos de dominio. Todas las fechas son cadenas ISO `yyyy-MM-dd`. */

export type TipoCliente = 'DNI' | 'RUC 10' | 'RUC 20';

export interface Representante {
  nombre: string;
  dni: string;
}

export interface Cliente {
  id: string;
  /** Nombre completo, o razón social cuando es RUC 20. */
  nombre: string;
  tipo: TipoCliente;
  doc: string;
  agencia: string;
  telefono: string;
  asesor: string;
  alta: string;
  /** RUC 20 */
  domicilio?: string;
  representante?: Representante;
  /** RUC 10 */
  negocio?: string;
  dniTitular?: string;
}

/**
 * Estado del préstamo (demostración). Los estados «En evaluación», «Aprobado» y «Rechazado» corresponden a solicitudes
 * que aún NO están desembolsadas (campo `etapa`); «Vigente», «En mora» y «Cancelado» se derivan del cronograma y del
 * registro histórico importado de préstamos desembolsados.
 */
export type EstadoPrestamo = 'En evaluación' | 'Aprobado' | 'Vigente' | 'En mora' | 'Cancelado' | 'Rechazado';

/** Etapa de una solicitud todavía no desembolsada. Un préstamo sin `etapa` está desembolsado. */
export type EtapaSolicitud = 'evaluacion' | 'aprobado' | 'rechazado';

/** Estado visual de una cuota del cronograma (demostración, derivado de fechas e importes cubiertos). */
export type EstadoCuota = 'Pendiente' | 'Próxima a vencer' | 'Vencida' | 'Pagada';

export interface Cuota {
  n: number;
  fecha: string;
  capital: number;
  interes: number;
  /** Importe contractual de la cuota (capital + interés). */
  cuota: number;
  /**
   * Importe cubierto según el REGISTRO HISTÓRICO importado (solo lectura). La aplicación no
   * permite registrar pagos: este valor nunca se modifica desde la interfaz.
   */
  cubierto: number;
  /** Saldo de capital tras esta cuota, según el cronograma original. */
  saldo: number;
}

/** Movimiento histórico importado (solo lectura, informativo). No existe operativa de pagos en el sistema. */
export interface RegistroHistorico {
  op: string;
  fecha: string;
  monto: number;
  usuario: string;
}

export interface Prestamo {
  id: string;
  clienteId: string;
  agencia: string;
  capital: number;
  plazo: number;
  tea: number;
  desembolso: string;
  asesor: string;
  cronograma: Cuota[];
  /** Registro histórico importado: base del capital pendiente. Solo lectura. */
  historico: RegistroHistorico[];
  observaciones: string;
  /**
   * Solo en solicitudes no desembolsadas (en evaluación, aprobadas o rechazadas). En ellas `desembolso` es la fecha PREVISTA
   * y el cronograma es una proyección. Ausente = préstamo desembolsado.
   */
  etapa?: EtapaSolicitud;
}

export interface ActividadRef {
  entidad: 'cliente' | 'prestamo';
  id: string;
}

export interface Actividad {
  /** `yyyy-MM-dd HH:mm` */
  t: string;
  usuario: string;
  tipo: string;
  desc: string;
  ref?: ActividadRef;
}

export interface Db {
  v: 6;
  clientes: Cliente[];
  prestamos: Prestamo[];
  actividad: Actividad[];
}

export interface ResumenPrestamo {
  /** Total contractual: capital + intereses pactados. */
  total: number;
  /** Importe cubierto según el registro histórico importado. */
  cubierto: number;
  /** Pendiente contractual: total − cubierto histórico. */
  pendiente: number;
  /** Intereses pactados: total − capital. */
  interes: number;
  /** Capital de las cuotas aún abiertas (base del límite de endeudamiento). */
  capitalPend: number;
  vencidas: number;
  proxima: Cuota | null;
  estado: EstadoPrestamo;
}
