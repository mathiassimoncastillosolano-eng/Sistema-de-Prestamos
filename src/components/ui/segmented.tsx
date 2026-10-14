import * as RG from '@radix-ui/react-radio-group';
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  'aria-label': string;
  className?: string;
  size?: 'sm' | 'md';
  /** Ocupa todo el ancho y reparte las opciones por igual. */
  fill?: boolean;
}

/** Selector segmentado (grupo de radios accesible, navegable con flechas). */
export function Segmented<T extends string>({ value, onValueChange, options, className, size = 'md', fill, ...rest }: Props<T>) {
  const layoutId = useId();
  return (
    <RG.Root value={value} onValueChange={(v) => onValueChange(v as T)} aria-label={rest['aria-label']} className={cn('inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-control bg-surface-2 p-1', !fill && 'sm:w-auto', className)}>
      {options.map((o) => (
        <RG.Item
          key={o.value}
          value={o.value}
          className={cn('relative flex-1 whitespace-nowrap rounded-[0.45rem] px-3 text-sm font-medium transition-colors', !fill && 'sm:flex-none', size === 'sm' ? 'h-8' : 'h-9', value === o.value ? 'text-ink' : 'text-ink-muted hover:text-ink')}
        >
          {value === o.value && (
            <motion.span layoutId={layoutId} className="absolute inset-0 rounded-[0.45rem] border border-line bg-surface shadow-card" transition={{ duration: DUR.base, ease: EASE }} />
          )}
          <span className="relative">{o.label}</span>
        </RG.Item>
      ))}
    </RG.Root>
  );
}
