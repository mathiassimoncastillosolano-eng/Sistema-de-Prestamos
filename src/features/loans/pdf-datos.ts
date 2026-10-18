import type { DatosPdf } from '@/lib/pdf';
import type { PrestamoDetalleApi, SimulacionApi } from '@/services/prestamos-api';
import { codigoPrestamo } from './loan-utils';

interface ExtrasSimulacion {
  clienteNombre?: string;
  clienteDocumento?: string;
  asesor?: string;
  agencia?: string;
}

/** PDF de una simulación: «no registrada», sin código de préstamo. Usa exactamente lo que devolvió el servidor. */
export const datosPdfSimulacion = (s: SimulacionApi, e: ExtrasSimulacion = {}): DatosPdf => ({
  tipo: 'simulacion',
  clienteNombre: e.clienteNombre,
  clienteDocumento: e.clienteDocumento,
  asesor: e.asesor,
  agencia: e.agencia,
  capital: s.capital,
  plazoMeses: s.plazoMeses,
  tea: s.tea,
  fechaDesembolso: s.fechaDesembolso,
  fechaPrimerVencimiento: s.fechaPrimerVencimiento,
  cuotaMensual: s.cuotaMensual,
  totalIntereses: s.totalIntereses,
  totalContractual: s.totalContractual,
  cuotas: s.cuotas
});

/** PDF del préstamo registrado, con los datos persistidos (los mismos del listado y del detalle). */
export const datosPdfRegistrado = (p: PrestamoDetalleApi): DatosPdf => ({
  tipo: 'registrado',
  codigo: codigoPrestamo(p.numero),
  clienteNombre: p.clienteNombre,
  clienteDocumento: `${p.clienteTipoDocumento} ${p.clienteNumeroDocumento}`,
  agencia: p.agenciaNombre,
  asesor: p.asesorNombre,
  capital: p.capital,
  plazoMeses: p.plazoMeses,
  tea: p.tea,
  fechaDesembolso: p.fechaDesembolso,
  fechaPrimerVencimiento: p.fechaPrimerVencimiento,
  cuotaMensual: p.cuotaMensual,
  totalIntereses: p.totalIntereses,
  totalContractual: p.totalContractual,
  estado: p.estado,
  capitalPendiente: p.capitalPendiente,
  totalPendiente: p.totalPendiente,
  cuotas: p.cuotas
});
