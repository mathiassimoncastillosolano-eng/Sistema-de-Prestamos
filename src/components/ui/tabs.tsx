import * as Tabs from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Item<T extends string> { value: T; label: ReactNode }

interface Props<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  items: Item<T>[];
  panels: Record<T, ReactNode>;
  className?: string;
  'aria-label': string;
}

/** Pestañas accesibles con indicador animado (layout animation de Motion). */
export function TabsNav<T extends string>({ value, onValueChange, items, panels, className, ...rest }: Props<T>) {
  const layoutId = useId();
  return (
    <Tabs.Root value={value} onValueChange={(v) => onValueChange(v as T)} className={className}>
      <Tabs.List aria-label={rest['aria-label']} className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-4">
        {items.map((it) => (
          <Tabs.Trigger
            key={it.value}
            value={it.value}
            className={cn('relative -mb-px h-11 shrink-0 px-3 text-sm font-medium transition-colors', value === it.value ? 'text-ink' : 'text-ink-muted hover:text-ink')}
          >
            {it.label}
            {value === it.value && (
              <motion.span layoutId={layoutId} className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal" transition={{ duration: DUR.base, ease: EASE }} />
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {items.map((it) => (
        <Tabs.Content key={it.value} value={it.value} className="outline-none">{panels[it.value]}</Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
