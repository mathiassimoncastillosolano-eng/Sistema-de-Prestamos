import { Badge } from '@/components/ui/badge';
import type { EstadoCliente } from '@/lib/selectors';
import type { EstadoCuotaApi } from '@/services/prestamos-api';
import type { EstadoCuota, EstadoPrestamo } from '@/types';

type Estado = EstadoPrestamo | EstadoCliente | EstadoCuota | EstadoCuotaApi;
type Tono = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal';

/**
 * Significado de color único para toda la app: verde = al día / vigente / pagada, ámbar = atención, rojo = mora o vencida,
 * azul = en proceso, turquesa = aprobado (aún sin desembolsar), gris = inactivo o cerrado.
 */
const TONOS: Record<Estado, Tono> = {
  // Préstamos
  'En evaluación': 'info', Aprobado: 'teal', Vigente: 'success', 'En mora': 'danger', Cancelado: 'neutral', Rechazado: 'warning',
  // Clientes
  'Al día': 'success', 'Con cuotas vencidas': 'danger', 'Cerca del límite': 'warning', 'Sin préstamos activos': 'neutral',
  // Cuotas
  Pendiente: 'neutral', 'Próxima a vencer': 'warning', Vencida: 'danger', Pagada: 'success',
  // Cuotas según la base de datos (únicos estados permitidos en el módulo de cuotas)
  PENDIENTE: 'neutral', PAGADA: 'success', VENCIDA: 'danger'
};

export const tonoDeEstado = (e: Estado): Tono => TONOS[e];

/** Etiqueta compacta de estado (texto + punto de color; el color nunca es el único portador del significado). */
export function StatusBadge({ estado, className }: { estado: Estado; className?: string }) {
  return <Badge tone={TONOS[estado]} dot className={className}>{estado}</Badge>;
}
