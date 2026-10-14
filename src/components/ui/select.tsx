import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { controlBase } from './input';

/** Select nativo con estilo del sistema: accesible, con teclado y selector del sistema en móvil. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(controlBase, 'h-11 appearance-none pl-3 pr-9 sm:h-10')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  );
}
