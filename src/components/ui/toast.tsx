import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Tipo = 'success' | 'error' | 'info';
interface ToastItem { id: number; tipo: Tipo; mensaje: string }

let items: ToastItem[] = [];
let seq = 0;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((l) => l());

function quitar(id: number) {
  items = items.filter((t) => t.id !== id);
  emitir();
}

function agregar(tipo: Tipo, mensaje: string) {
  const id = ++seq;
  items = [...items.slice(-3), { id, tipo, mensaje }];
  emitir();
  setTimeout(() => quitar(id), tipo === 'error' ? 6000 : 3800);
}

/** API imperativa: toast.success('Guardado') desde cualquier parte (servicios, handlers…). */
export const toast = {
  success: (m: string) => agregar('success', m),
  error: (m: string) => agregar('error', m),
  info: (m: string) => agregar('info', m)
};

const suscribir = (l: () => void) => { oyentes.add(l); return () => { oyentes.delete(l); }; };
const instantanea = () => items;

const estilos: Record<Tipo, { icono: typeof Info; clase: string }> = {
  success: { icono: CircleCheck, clase: 'text-success-ink' },
  error: { icono: CircleAlert, clase: 'text-danger-ink' },
  info: { icono: Info, clase: 'text-info-ink' }
};

export function Toaster() {
  const lista = useSyncExternalStore(suscribir, instantanea, instantanea);
  return (
    <div role="region" aria-label="Notificaciones" className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end">
      <AnimatePresence initial={false}>
        {lista.map((t) => {
          const { icono: Icono, clase } = estilos[t.tipo];
          return (
            <motion.div
              key={t.id}
              layout
              role={t.tipo === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-surface p-3.5 text-sm text-ink shadow-pop"
            >
              <Icono className={cn('mt-0.5 size-5 shrink-0', clase)} aria-hidden />
              <p className="min-w-0 flex-1 pt-0.5">{t.mensaje}</p>
              <button type="button" onClick={() => quitar(t.id)} aria-label="Cerrar notificación" className="-m-1 rounded-md p-1 text-ink-muted hover:bg-surface-2 hover:text-ink">
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
