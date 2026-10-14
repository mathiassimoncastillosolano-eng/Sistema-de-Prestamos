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

export type EstadoCuota = 'Pagada' | 'Vencida' | 'Próxima a vencer' | 'Pendiente' | 'Cubierta por cancelación';
export type EstadoPrestamo = 'Vigente' | 'Con cuotas vencidas' | 'Cancelado';

export interface Cuota {
  n: number;
  fecha: string;
  capital: number;
  interes: number;
  /** Importe contractual de la cuota (capital + interés). */
  cuota: number;
  abonado: number;
  /** Saldo de capital tras esta cuota, según el cronograma original. */
  saldo: number;
  /** true si fue cubierta por una cancelación anticipada (el cronograma original se conserva). */
  cubierta: boolean;
}

export type TipoPago = 'Pago de cuota' | 'Cancelación anticipada';
export const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Yape', 'Plin', 'Depósito en ventanilla'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export interface Pago {
  op: string;
  fecha: string;
  monto: number;
  tipo: TipoPago;
  usuario: string;
  medio: MedioPago;
  ref: string;
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
  pagos: Pago[];
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
  v: 4;
  clientes: Cliente[];
  prestamos: Prestamo[];
  actividad: Actividad[];
  /** Contador de operaciones (OP-n). */
  contador: number;
}

export interface ResumenPrestamo {
  /** Total contractual: capital + intereses pactados. */
  total: number;
  abonado: number;
  /** Pendiente contractual: total − abonado. */
  pendiente: number;
  /** Intereses pactados: total − capital. */
  interes: number;
  /** Capital de las cuotas aún abiertas (base del límite de endeudamiento). */
  capitalPend: number;
  vencidas: number;
  proxima: Cuota | null;
  estado: EstadoPrestamo;
}
