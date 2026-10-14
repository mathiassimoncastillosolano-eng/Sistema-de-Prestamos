import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Agrupa campos relacionados de un formulario con un encabezado discreto (sin tarjeta adicional). */
export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('border-t border-line pt-5 first:border-t-0 first:pt-0', className)}>
      <h3 id={id} className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{description}</p>}
      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
