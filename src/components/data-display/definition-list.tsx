import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  items: { label: ReactNode; value: ReactNode; strong?: boolean }[];
  className?: string;
  compact?: boolean;
}

/** Pares etiqueta/valor (resúmenes, expedientes). */
export function DefinitionList({ items, className, compact }: Props) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('flex items-baseline justify-between gap-4', compact ? 'py-2' : 'py-2.5')}>
          <dt className="text-sm text-ink-muted">{it.label}</dt>
          <dd className={cn('num text-right text-sm text-ink', it.strong && 'font-semibold')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
