import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Dato informativo de primera clase (NO es un campo de formulario): etiqueta en mayúsculas, valor destacado y texto auxiliar.
 * Se usa para fechas calculadas, tasa fijada por política y responsable, que el usuario no edita.
 * Va dentro de un `InfoPanel`, que comparte una única superficie sin tarjetas anidadas.
 */
export function InfoFact({ icon: Icon, label, value, helper, className }: { icon: LucideIcon; label: string; value: ReactNode; helper?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-start gap-3 p-4', className)}>
      <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-ink"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
        <dd className="num mt-0.5 truncate text-lg font-semibold leading-snug text-ink">{value}</dd>
        {helper && <dd className="mt-0.5 text-xs text-ink-muted">{helper}</dd>}
      </div>
    </div>
  );
}

/** Superficie compartida de dos datos informativos, separados por una línea sutil (vertical en escritorio, horizontal en móvil). */
export function InfoPanel({ children, className, ...rest }: { children: ReactNode; className?: string; 'aria-label'?: string }) {
  return (
    <dl {...rest} className={cn('grid divide-y divide-line rounded-control bg-surface-2/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0', className)}>
      {children}
    </dl>
  );
}
