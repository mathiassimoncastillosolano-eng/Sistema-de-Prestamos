import { TriangleAlert } from 'lucide-react';
import { Meter } from '@/components/ui/meter';
import { CFG } from '@/lib/config';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CapacidadApi } from '@/services/prestamos-api';

interface Props {
  capacidad: CapacidadApi | null;
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  className?: string;
}

/** Versión compacta de los indicadores del perfil del cliente: límite, capital pendiente y capacidad disponible. */
export function CapacidadCliente({ capacidad, cargando, error, onReintentar, className }: Props) {
  const caja = cn('rounded-control border border-line bg-surface-2/60 px-3 py-2.5', className);

  if (error) {
    return (
      <section aria-label="Capacidad de endeudamiento" role="alert" className={cn(caja, 'border-danger/40 bg-danger-soft text-sm text-danger-ink')}>
        <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4" aria-hidden />No se pudo consultar la capacidad del cliente</p>
        <p className="mt-0.5 text-[0.8125rem]">{error}</p>
        <button type="button" onClick={onReintentar} className="mt-1 text-[0.8125rem] font-medium underline">Reintentar</button>
      </section>
    );
  }

  if (cargando || !capacidad) {
    return <p role="status" aria-label="Capacidad de endeudamiento" className={cn(caja, 'text-sm text-ink-muted')}>Consultando la capacidad del cliente…</p>;
  }

  const uso = (capacidad.capitalPendiente / capacidad.limite) * 100;
  const tono = uso >= 100 ? 'danger' : uso >= CFG.alertaLimite * 100 ? 'warning' : 'teal';
  return (
    <section aria-label="Capacidad de endeudamiento" className={caja}>
      <dl className="num grid gap-1.5 sm:grid-cols-3 sm:gap-3">
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Límite máximo</dt>
          <dd className="text-sm sm:mt-0.5 font-semibold text-ink">{money(capacidad.limite)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Capital pendiente</dt>
          <dd className="text-sm sm:mt-0.5 font-semibold text-ink">{money(capacidad.capitalPendiente)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Capacidad disponible</dt>
          <dd className="text-sm sm:mt-0.5 font-semibold text-teal-ink">{money(capacidad.disponible)}</dd>
        </div>
      </dl>
      <Meter value={uso} tone={tono} label={`Uso del límite: ${Math.round(uso)} %`} className="mt-2" />
    </section>
  );
}
