import { Badge } from '@/components/ui/badge';
import type { EstadoCliente } from '@/lib/selectors';
import type { EstadoCuota, EstadoPrestamo } from '@/types';

type Estado = EstadoCuota | EstadoPrestamo | EstadoCliente;
type Tono = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Significado de color único para toda la app: verde = al día, ámbar = atención, rojo = vencido, azul = informativo, gris = inactivo. */
const TONOS: Record<Estado, Tono> = {
  Vigente: 'success', 'Al día': 'success',
  'Con cuotas vencidas': 'danger', Vencida: 'danger',
  'Próxima a vencer': 'warning', 'Cerca del límite': 'warning',
  Pendiente: 'neutral', Finalizado: 'neutral', 'Sin préstamos activos': 'neutral',
  'Cubierta (histórico)': 'info'
};

export const tonoDeEstado = (e: Estado): Tono => TONOS[e];

export function StatusBadge({ estado }: { estado: Estado }) {
  return <Badge tone={TONOS[estado]} dot>{estado}</Badge>;
}
