import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from './button';

const anchos = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof anchos;
}

/**
 * Modal accesible (Radix Dialog): foco atrapado, Escape, retorno de foco y scroll bloqueado.
 * Motion solo anima la entrada/salida; sin animación sigue funcionando igual.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 grid place-items-center bg-[#0a141f]/55 p-4 backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }}
              >
                <Dialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
                  <motion.div
                    className={cn('flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-pop', anchos[size])}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.99 }}
                    transition={{ duration: DUR.base, ease: EASE }}
                  >
                    <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                      <div className="min-w-0">
                        <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
                        {description && <Dialog.Description className="mt-1 text-sm text-ink-muted">{description}</Dialog.Description>}
                      </div>
                      <Dialog.Close asChild>
                        <Button variant="ghost" size="iconSm" aria-label="Cerrar" className="-mr-2 -mt-1"><X className="size-4" /></Button>
                      </Dialog.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
                    {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
                  </motion.div>
                </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
