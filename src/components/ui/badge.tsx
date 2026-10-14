import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      success: 'bg-success-soft text-success-ink',
      warning: 'bg-warning-soft text-warning-ink',
      danger: 'bg-danger-soft text-danger-ink',
      info: 'bg-info-soft text-info-ink',
      neutral: 'bg-neutral-soft text-neutral-ink',
      teal: 'bg-teal-soft text-teal-ink',
      copper: 'bg-copper-soft text-copper-ink'
    }
  },
  defaultVariants: { tone: 'neutral' }
});

const dotColor: Record<string, string> = {
  success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-neutral', teal: 'bg-teal', copper: 'bg-copper'
};

interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn('size-1.5 rounded-full', dotColor[tone ?? 'neutral'])} aria-hidden />}
      {children}
    </span>
  );
}
