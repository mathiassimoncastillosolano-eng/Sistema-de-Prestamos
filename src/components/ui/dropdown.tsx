import * as D from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = D.Root;
export const DropdownTrigger = D.Trigger;

export function DropdownContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn('z-[70] min-w-56 animate-pop overflow-hidden rounded-card border border-line bg-surface p-1.5 text-ink shadow-pop', className)}
        {...props}
      />
    </D.Portal>
  );
}

export function DropdownItem({ className, ...props }: ComponentProps<typeof D.Item>) {
  return (
    <D.Item
      className={cn('flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50', className)}
      {...props}
    />
  );
}

export const DropdownLabel = ({ className, ...props }: ComponentProps<typeof D.Label>) => (
  <D.Label className={cn('px-2.5 py-1.5 text-xs font-medium text-ink-muted', className)} {...props} />
);
export const DropdownSeparator = ({ className, ...props }: ComponentProps<typeof D.Separator>) => (
  <D.Separator className={cn('-mx-1.5 my-1.5 h-px bg-line', className)} {...props} />
);
