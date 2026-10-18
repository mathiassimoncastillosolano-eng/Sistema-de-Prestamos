import type { Cuota } from '@/types';
import type { CuotaApi } from './prestamos-api';

/** Convierte las cuotas del backend al formato que espera ScheduleTable. No hay pagos: cubierto siempre 0. */
export const aCuotas = (cuotas: CuotaApi[]): Cuota[] =>
  cuotas.map((c) => ({
    n: c.numero,
    fecha: c.fechaVencimiento,
    capital: c.capital,
    interes: c.interes,
    cuota: c.importeCuota,
    cubierto: 0,
    saldo: c.saldo
  }));