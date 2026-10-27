import { Check } from 'lucide-react';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  children?: ReactNode;
}

/** Casilla con el estilo del sistema (input nativo oculto visualmente: conserva teclado, foco y lectores de pantalla). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, children, disabled, ...props }, ref) {
  return (
    <label className={cn('group inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative grid size-[1.125rem] shrink-0 place-items-center">
        <input ref={ref} type="checkbox" disabled={disabled} className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-[0.3rem] border border-line-strong bg-surface transition-colors hover:border-ink-subtle checked:border-teal checked:bg-teal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/30" {...props} />
        <Check className="pointer-events-none relative size-3 scale-50 text-on-teal opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3.5} aria-hidden />
      </span>
      {children}
    </label>
  );
});
