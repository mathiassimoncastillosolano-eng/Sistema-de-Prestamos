import { Badge } from '@/components/ui/badge';
import type { EstadoCliente } from '@/lib/selectors';
import type { EstadoPrestamo } from '@/types';

type Estado = EstadoPrestamo | EstadoCliente;
type Tono = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Significado de color único para toda la app: verde = al día, ámbar = atención, rojo = vencido, azul = informativo, gris = inactivo. */
const TONOS: Record<Estado, Tono> = {
  Vigente: 'success', 'Al día': 'success',
  'Con cuotas vencidas': 'danger',
  'Cerca del límite': 'warning',
  Finalizado: 'neutral', 'Sin préstamos activos': 'neutral'
};

export const tonoDeEstado = (e: Estado): Tono => TONOS[e];

export function StatusBadge({ estado }: { estado: Estado }) {
  return <Badge tone={TONOS[estado]} dot>{estado}</Badge>;
}
