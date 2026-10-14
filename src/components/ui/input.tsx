import { Lock } from 'lucide-react';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const controlBase =
  'w-full rounded-control border border-line-strong bg-surface text-sm text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle hover:border-ink-subtle focus-visible:border-teal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted read-only:bg-surface-2';

interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  /** Se muestra dentro del campo, a la izquierda (p. ej. «S/»). */
  prefix?: ReactNode;
  /** Se muestra dentro del campo, a la derecha (p. ej. «meses»). */
  suffix?: ReactNode;
  /** Valor calculado por reglas de negocio: no editable, con borde discontinuo e icono de candado. */
  derived?: boolean;
}

/** Ancho reservado para el prefijo según su longitud (el símbolo «S/» no debe pisar el texto). */
const padPrefijo = (p: ReactNode) => (typeof p === 'string' && p.length > 2 ? 'pl-14' : 'pl-9');

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, prefix, suffix, derived, readOnly, ...props }, ref) {
  const sufijo = derived ? <Lock className="size-3.5" aria-hidden /> : suffix;
  const input = (
    <input
      ref={ref}
      readOnly={readOnly || derived}
      className={cn(controlBase, 'h-11 px-3 sm:h-10', prefix && padPrefijo(prefix), sufijo && (derived ? 'pr-9' : 'pr-14'), derived && 'cursor-default border-dashed bg-surface-2 text-ink focus-visible:border-line-strong', className)}
      {...props}
    />
  );
  if (!prefix && !sufijo) return input;
  return (
    <div className="relative">
      {prefix && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-ink-muted">{prefix}</span>}
      {input}
      {sufijo && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">{sufijo}</span>}
    </div>
  );
});

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(controlBase, 'min-h-20 resize-y px-3 py-2.5', className)} {...props} />;
}
