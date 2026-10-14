import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  className?: string;
  /** Oculta visualmente el título (sigue disponible para lectores de pantalla). */
  hideHeader?: boolean;
}

/** Panel lateral (drawer) accesible. Se usa para el menú móvil y los formularios extensos. */
export function Sheet({ open, onOpenChange, title, description, children, footer, side = 'right', className, hideHeader }: SheetProps) {
  const dx = side === 'right' ? 36 : -36;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#0a141f]/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn('fixed inset-y-0 z-50 flex w-full max-w-xl flex-col bg-surface shadow-pop outline-none', side === 'right' ? 'right-0 border-l border-line' : 'left-0', className)}
                initial={{ x: dx, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dx, opacity: 0 }} transition={{ duration: DUR.slow, ease: EASE }}
              >
                <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', hideHeader && 'sr-only')}>
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
                    {description ? <Dialog.Description className="mt-0.5 text-sm text-ink-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="iconSm" aria-label="Cerrar" className="-mr-2"><X className="size-4" /></Button>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
