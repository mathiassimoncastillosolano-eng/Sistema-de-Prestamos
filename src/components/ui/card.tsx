import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('print-card relative rounded-card border border-line bg-surface shadow-card', className)} {...props} />;
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, description, action, className, as: H = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pb-0 pt-5', className)}>
      <div className="min-w-0">
        <H className="text-[0.9375rem] font-semibold text-ink">{title}</H>
        {description && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const CardBody = ({ className, ...props }: ComponentProps<'div'>) => <div className={cn('p-5', className)} {...props} />;
