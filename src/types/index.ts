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
 * Estados informativos de una cuota. Se CALCULAN desde las fechas y desde el registro histórico importado;
 * nunca se asignan a mano. 'Cubierta (histórico)' solo aparece si el registro histórico lo respalda.
 */
export type EstadoCuota = 'Vencida' | 'Próxima a vencer' | 'Pendiente' | 'Cubierta (histórico)';
export type EstadoPrestamo = 'Vigente' | 'Con cuotas vencidas' | 'Finalizado';

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
  /** Registro histórico importado: respalda las cuotas 'Cubierta (histórico)'. Solo lectura. */
  historico: RegistroHistorico[];
  observaciones: string;
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
  v: 5;
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
