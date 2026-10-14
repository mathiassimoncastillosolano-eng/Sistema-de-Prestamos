import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const controlBase =
  'w-full rounded-control border border-line-strong bg-surface text-sm text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle hover:border-ink-subtle focus-visible:border-teal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted read-only:bg-surface-2';

interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ className, prefix, suffix, ...props }: InputProps) {
  const input = (
    <input
      className={cn(controlBase, 'h-11 px-3 sm:h-10', prefix && 'pl-10', suffix && 'pr-10', className)}
      {...props}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-ink-muted">{prefix}</span>}
      {input}
      {suffix && <span className="absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">{suffix}</span>}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(controlBase, 'min-h-20 resize-y px-3 py-2.5', className)} {...props} />;
}
