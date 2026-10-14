import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={250} skipDelayDuration={150}>{children}</T.Provider>
);

interface Props {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
}

/** Tooltip accesible: aparece con foco de teclado y con el cursor. */
export function Tip({ label, children, side = 'top', disabled }: Props) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="z-[80] max-w-xs animate-pop rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-canvas shadow-pop">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
