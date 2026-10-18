import { Hash, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ClienteListado } from '@/services/clientes-api';

/** Los únicos datos que se muestran: los reales que entrega la API de clientes. */
export type ClienteResumen = Pick<ClienteListado, 'nombre' | 'tipoDocumento' | 'numeroDocumento'> & Partial<Pick<ClienteListado, 'numero' | 'telefono'>>;

interface Props {
  cliente: ClienteResumen;
  /** Texto pequeño sobre el nombre. */
  etiqueta?: string;
  /** `destacada` agranda el avatar y el nombre (confirmación); `compacta` es la de condiciones y cronograma. */
  variante?: 'compacta' | 'destacada';
  className?: string;
}

/**
 * Identificación del cliente: avatar con iniciales, nombre, tipo y número de documento y, si existen, código y celular.
 * Un único componente para condiciones, cronograma y confirmación. Recibe el cliente ya elegido, así que cambiarlo en el paso 1
 * lo refleja de inmediato en todas partes.
 */
export function ClienteCard({ cliente, etiqueta = 'Cliente seleccionado', variante = 'compacta', className }: Props) {
  const grande = variante === 'destacada';
  return (
    <section aria-label={etiqueta} className={cn('flex items-center gap-3 rounded-control border border-line bg-surface-2/60', grande ? 'p-4' : 'px-3 py-2.5', className)}>
      <Avatar nombre={cliente.nombre} tipo={cliente.tipoDocumento} size={grande ? 'lg' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{etiqueta}</p>
        <p className={cn('truncate font-semibold text-ink', grande ? 'text-base' : 'text-sm')} title={cliente.nombre}>{cliente.nombre}</p>
        <p className="num mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
          <span>{cliente.tipoDocumento} {cliente.numeroDocumento}</span>
          {cliente.numero != null && <span className="inline-flex items-center gap-1"><Hash className="size-3" aria-hidden /><span className="sr-only">Código de cliente </span>{cliente.numero}</span>}
          {cliente.telefono && <span className="inline-flex items-center gap-1"><Phone className="size-3" aria-hidden /><span className="sr-only">Celular </span>{cliente.telefono}</span>}
        </p>
      </div>
    </section>
  );
}
