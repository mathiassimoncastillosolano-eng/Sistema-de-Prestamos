import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Props {
  pasos: { titulo: string; descripcion?: string }[];
  actual: number; // 1-based
  onIr?: (paso: number) => void;
}

/** Progreso de un flujo por pasos. Los pasos completados son navegables hacia atrás. */
export function Stepper({ pasos, actual, onIr }: Props) {
  return (
    <nav aria-label="Progreso de la solicitud" className="rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:px-5 sm:py-3.5">
      <ol className="flex items-center gap-2 sm:gap-4">
        {pasos.map((p, i) => {
          const n = i + 1;
          const hecho = n < actual;
          const activo = n === actual;
          const contenido = (
            <>
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-colors duration-200',
                  hecho && 'border-teal bg-teal text-on-teal',
                  activo && 'border-brand bg-brand text-brand-ink ring-4 ring-teal/20',
                  !hecho && !activo && 'border-line-strong bg-surface text-ink-muted'
                )}
              >
                {hecho ? <Check className="size-4" aria-hidden /> : n}
              </span>
              <span className={cn('min-w-0 text-left', !activo && 'hidden sm:block')}>
                <span className={cn('block truncate text-sm', activo ? 'font-semibold text-ink' : hecho ? 'font-medium text-ink' : 'font-medium text-ink-muted')}>{p.titulo}</span>
                {p.descripcion && <span className="hidden truncate text-xs text-ink-muted sm:block">{p.descripcion}</span>}
              </span>
            </>
          );
          return (
            <li key={p.titulo} className={cn('flex items-center gap-2 sm:gap-3', i < pasos.length - 1 && 'flex-1')} aria-current={activo ? 'step' : undefined}>
              {hecho && onIr ? (
                <button type="button" onClick={() => onIr(n)} className="flex items-center gap-3 rounded-md" aria-label={`Volver al paso ${n}: ${p.titulo}`}>{contenido}</button>
              ) : (
                <span className="flex items-center gap-3"><span className="sr-only">{`Paso ${n}${hecho ? ' completado' : activo ? ' actual' : ''}: ${p.titulo}`}</span><span aria-hidden className="flex items-center gap-3">{contenido}</span></span>
              )}
              {i < pasos.length - 1 && (
                <span aria-hidden className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span className="absolute inset-y-0 left-0 bg-teal" initial={false} animate={{ width: hecho ? '100%' : '0%' }} transition={{ duration: DUR.slow, ease: EASE }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
