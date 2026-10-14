import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-ink shadow-card hover:bg-brand-hover',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger: 'border border-danger/40 bg-danger-soft text-danger-ink hover:bg-danger/20',
        link: 'h-auto rounded-sm p-0 text-teal-ink underline-offset-4 hover:underline'
      },
      size: {
        sm: 'h-9 px-3 text-[0.8125rem]',
        md: 'h-11 px-4 text-sm sm:h-10',
        lg: 'h-12 px-5 text-[0.9375rem] sm:h-11',
        icon: 'size-11 sm:size-10',
        iconSm: 'size-9'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Muestra un indicador de carga y bloquea el botón (evita envíos duplicados). */
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : type}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
