import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: 'neutral' | 'danger';
}

/** Estado vacío / error: explica qué pasó y qué hacer. */
export function EmptyState({ icon: Icon, title, description, action, className, tone = 'neutral' }: Props) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className={cn('mb-4 grid size-12 place-items-center rounded-full', tone === 'danger' ? 'bg-danger-soft text-danger-ink' : 'bg-tint text-tint-ink')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
