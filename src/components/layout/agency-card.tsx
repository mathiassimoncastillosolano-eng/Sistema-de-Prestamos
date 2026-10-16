import * as Popover from '@radix-ui/react-popover';
import { MapPin } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, etiquetaAgencia } from '@/lib/utils';
import type { Agencia } from '@/types/auth';

const RETRASO_ABRIR_MS = 90;
const RETRASO_CERRAR_MS = 150; // permite cruzar el hueco entre el activador y la tarjeta sin cierres accidentales

const limpio = (v: string | null | undefined) => (v ?? '').trim();

/**
 * Nombre de la agencia en la cabecera + tarjeta flotante con su ubicación REAL (public.ubicaciones).
 * - Ratón: se abre al pasar el cursor y se cierra al salir (con margen para llegar a la tarjeta).
 * - Táctil / teclado: clic, toque, Enter o Espacio la abren y la fijan; otro toque, clic fuera, Escape o perder el foco la cierran.
 */
export function AgencyCard({ agencia, className }: { agencia: Agencia; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const fijada = useRef(false);
  const devolverFoco = useRef(false);
  const temporizador = useRef<number | undefined>(undefined);

  const cancelar = () => { window.clearTimeout(temporizador.current); temporizador.current = undefined; };
  const abrirConRetraso = () => { cancelar(); temporizador.current = window.setTimeout(() => setAbierto(true), RETRASO_ABRIR_MS); };
  const cerrarConRetraso = () => {
    cancelar();
    if (fijada.current) return;
    temporizador.current = window.setTimeout(() => setAbierto(false), RETRASO_CERRAR_MS);
  };
  // El hover solo aplica a ratón/lápiz; en táctil el gesto es el toque (clic).
  const soloRaton = (e: React.PointerEvent) => e.pointerType !== 'touch';

  const cambiar = (o: boolean) => {
    cancelar();
    if (!o) { devolverFoco.current = fijada.current; fijada.current = false; }
    setAbierto(o);
  };

  const alternar = (e: React.MouseEvent) => {
    e.preventDefault(); // sustituye al alternado interno de Radix: aquí «abrir con el cursor» y «fijar» son estados distintos
    cancelar();
    if (abierto && fijada.current) cambiar(false);
    else { fijada.current = true; setAbierto(true); }
  };

  const { ubicacion } = agencia;
  const direccion = limpio(ubicacion.direccion);
  const campos = [
    { etiqueta: 'Distrito', valor: limpio(ubicacion.distrito) },
    { etiqueta: 'Provincia', valor: limpio(ubicacion.provincia) },
    { etiqueta: 'Departamento', valor: limpio(ubicacion.departamento) }
  ].filter((c) => c.valor);

  return (
    <Popover.Root open={abierto} onOpenChange={cambiar}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={alternar}
          onPointerEnter={(e) => soloRaton(e) && abrirConRetraso()}
          onPointerLeave={(e) => soloRaton(e) && cerrarConRetraso()}
          aria-label={`${etiquetaAgencia(agencia.nombre)}. Ver ubicación`}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-soft px-3 text-xs font-medium text-neutral-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand data-[state=open]:bg-surface-2', className)}
        >
          <MapPin className="size-3.5" aria-hidden />
          <span className="max-w-[14rem] truncate">{etiquetaAgencia(agencia.nombre)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          aria-label={`Ubicación de ${etiquetaAgencia(agencia.nombre)}`}
          onPointerEnter={(e) => soloRaton(e) && cancelar()}
          onPointerLeave={(e) => soloRaton(e) && cerrarConRetraso()}
          // Abierta con el cursor no debe robar el foco (p. ej. de un campo que se esté escribiendo).
          onOpenAutoFocus={(e) => { if (!fijada.current) e.preventDefault(); }}
          onCloseAutoFocus={(e) => { if (!devolverFoco.current) e.preventDefault(); devolverFoco.current = false; }}
          className="z-[75] w-[min(22rem,calc(100vw-1.5rem))] origin-[var(--radix-popover-content-transform-origin)] animate-pop overflow-hidden rounded-card border border-line bg-surface text-ink shadow-pop outline-none"
        >
          <div className="flex items-start gap-3 p-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-teal-soft text-teal-ink"><MapPin className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-muted">Ubicación registrada</p>
              <p className="mt-0.5 break-words text-[0.9375rem] font-semibold leading-snug text-ink">{etiquetaAgencia(agencia.nombre)}</p>
            </div>
            <Badge tone={agencia.activa ? 'success' : 'neutral'} dot className="shrink-0">{agencia.activa ? 'Activa' : 'Inactiva'}</Badge>
          </div>
          <div className="space-y-3.5 border-t border-line bg-surface-2/60 p-4">
            <div>
              <p className="text-xs font-medium text-ink-muted">Dirección</p>
              <p className={cn('mt-0.5 break-words text-sm', direccion ? 'text-ink' : 'italic text-ink-muted')}>{direccion || 'Dirección no registrada'}</p>
            </div>
            {campos.length > 0 && (
              <dl className="grid gap-x-4 gap-y-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(campos.length, 3)}, minmax(0, 1fr))` }}>
                {campos.map((c) => (
                  <div key={c.etiqueta} className="min-w-0">
                    <dt className="text-xs font-medium text-ink-muted">{c.etiqueta}</dt>
                    <dd className="mt-0.5 break-words text-sm text-ink">{c.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
