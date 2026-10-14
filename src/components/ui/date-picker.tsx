import * as Popover from '@radix-ui/react-popover';
import { addDays, addMonths, addYears, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { forwardRef, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CFG } from '@/lib/config';
import { fecha, toISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { controlBase } from './input';

/*
 * Selector de fecha. El valor es siempre `yyyy-MM-dd` (igual que <input type="date">): se interpreta y se
 * formatea en calendario LOCAL, nunca con `toISOString()`, así una fecha no se desplaza un día por la zona horaria.
 */

interface DatePickerProps {
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Fecha de referencia para el botón «Hoy» y el marcador del día actual. */
  hoy?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  className?: string;
}

type Vista = 'dias' | 'meses' | 'anios';

const parse = (s: string | undefined) => { if (!s) return null; const d = parseISO(s); return isValid(d) ? d : null; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DIAS_SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const MESES = Array.from({ length: 12 }, (_, i) => cap(format(new Date(2026, i, 1), 'MMM', { locale: es }).replace('.', '')));

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onChange, onBlur, id, name, min, max, disabled, placeholder = 'Selecciona una fecha', hoy = CFG.hoy, className, ...aria },
  ref
) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>('dias');
  const seleccion = parse(value);
  const hoyD = parse(hoy) ?? new Date();
  const minD = parse(min);
  const maxD = parse(max);
  const [mostrado, setMostrado] = useState<Date>(seleccion ?? hoyD); // mes visible
  const [foco, setFoco] = useState<Date>(seleccion ?? hoyD); // día con foco de teclado
  const rejilla = useRef<HTMLDivElement>(null);

  const bloqueado = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);

  // Al abrir: vuelve a la vista de días y posiciona el mes/foco en la fecha elegida (o en hoy).
  useEffect(() => {
    if (!abierto) return;
    const base = seleccion ?? hoyD;
    setVista('dias'); setMostrado(base); setFoco(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Mueve el foco real al día enfocado cuando cambia (teclado) dentro de la vista de días.
  useEffect(() => {
    if (!abierto || vista !== 'dias') return;
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-iso="${toISO(foco)}"]`)?.focus({ preventScroll: true });
  }, [foco, abierto, vista, mostrado]);

  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mostrado), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(mostrado), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = ini; d <= fin; d = addDays(d, 1)) out.push(d);
    return out;
  }, [mostrado]);

  const elegir = (d: Date) => {
    if (bloqueado(d)) return;
    onChange(toISO(d));
    setAbierto(false);
  };

  const mover = (d: Date) => { setFoco(d); if (!isSameMonth(d, mostrado)) setMostrado(d); };
  const teclas = (e: KeyboardEvent) => {
    const mapa: Record<string, Date> = {
      ArrowLeft: addDays(foco, -1), ArrowRight: addDays(foco, 1), ArrowUp: addDays(foco, -7), ArrowDown: addDays(foco, 7),
      PageUp: e.shiftKey ? addYears(foco, -1) : addMonths(foco, -1), PageDown: e.shiftKey ? addYears(foco, 1) : addMonths(foco, 1),
      Home: startOfWeek(foco, { weekStartsOn: 1 }), End: endOfWeek(foco, { weekStartsOn: 1 })
    };
    const destino = mapa[e.key];
    if (destino) { e.preventDefault(); mover(destino); }
  };

  const anioBase = Math.floor(mostrado.getFullYear() / 12) * 12;
  const titulo = vista === 'dias' ? cap(format(mostrado, 'MMMM yyyy', { locale: es })) : vista === 'meses' ? String(mostrado.getFullYear()) : `${anioBase} – ${anioBase + 11}`;
  const paso = (dir: 1 | -1) => setMostrado((m) => (vista === 'dias' ? addMonths(m, dir) : vista === 'meses' ? addYears(m, dir) : addYears(m, 12 * dir)));
  const etiquetaPaso = vista === 'dias' ? 'mes' : vista === 'meses' ? 'año' : 'rango de años';

  return (
    <Popover.Root open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) onBlur?.(); }}>
      <Popover.Trigger asChild>
        <button
          ref={ref}
          id={id}
          name={name}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          className={cn(controlBase, 'flex h-11 items-center gap-2.5 px-3 text-left read-only:bg-surface sm:h-10', className)}
          {...aria}
        >
          <CalendarDays className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <span className={cn('num min-w-0 flex-1 truncate', !seleccion && 'text-ink-subtle')}>{seleccion ? fecha(value) : placeholder}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start" sideOffset={6} collisionPadding={12}
          aria-label="Calendario"
          onOpenAutoFocus={(e) => { e.preventDefault(); rejilla.current?.querySelector<HTMLButtonElement>(`[data-iso="${toISO(foco)}"]`)?.focus(); }}
          className="z-[70] w-[min(20rem,calc(100vw-1.5rem))] animate-pop rounded-panel border border-line bg-surface p-3 text-ink shadow-pop outline-none"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" onClick={() => paso(-1)} aria-label={`${cap(etiquetaPaso)} anterior`} className="grid size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"><ChevronLeft className="size-4" aria-hidden /></button>
            <button
              type="button" aria-live="polite"
              onClick={() => setVista(vista === 'dias' ? 'meses' : vista === 'meses' ? 'anios' : 'dias')}
              aria-label={`${titulo}. Cambiar vista`}
              className="h-9 rounded-control px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
            >{titulo}</button>
            <button type="button" onClick={() => paso(1)} aria-label={`${cap(etiquetaPaso)} siguiente`} className="grid size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"><ChevronRight className="size-4" aria-hidden /></button>
          </div>

          {vista === 'dias' && (
            <div ref={rejilla} role="grid" aria-label={titulo} onKeyDown={teclas}>
              <div role="row" className="mb-1 grid grid-cols-7">
                {DIAS_SEMANA.map((d) => <span key={d} role="columnheader" className="grid h-8 place-items-center text-xs font-medium uppercase text-ink-muted">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {dias.map((d) => {
                  const fuera = !isSameMonth(d, mostrado);
                  const sel = !!seleccion && isSameDay(d, seleccion);
                  const esHoy = isSameDay(d, hoyD);
                  const off = bloqueado(d);
                  return (
                    <div key={toISO(d)} role="gridcell" aria-selected={sel} className="grid place-items-center">
                      <button
                        type="button" data-iso={toISO(d)} disabled={off}
                        tabIndex={isSameDay(d, foco) ? 0 : -1}
                        aria-label={`${format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}${esHoy ? ', hoy' : ''}`}
                        aria-current={esHoy ? 'date' : undefined}
                        onClick={() => elegir(d)}
                        className={cn(
                          'num relative grid size-10 place-items-center rounded-control text-sm transition-colors',
                          sel ? 'bg-brand font-semibold text-brand-ink' : fuera ? 'text-ink-subtle hover:bg-surface-2' : 'text-ink hover:bg-surface-2',
                          esHoy && !sel && 'font-semibold text-teal-ink ring-1 ring-inset ring-teal/60',
                          off && 'cursor-not-allowed text-ink-subtle/60 line-through hover:bg-transparent'
                        )}
                      >{d.getDate()}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {vista === 'meses' && (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Meses">
              {MESES.map((m, i) => {
                const activo = i === mostrado.getMonth();
                return (
                  <button key={m} type="button" aria-pressed={activo} onClick={() => { setMostrado(new Date(mostrado.getFullYear(), i, 1)); setFoco(new Date(mostrado.getFullYear(), i, 1)); setVista('dias'); }}
                    className={cn('h-11 rounded-control text-sm transition-colors', activo ? 'bg-brand font-semibold text-brand-ink' : 'text-ink hover:bg-surface-2')}>{m}</button>
                );
              })}
            </div>
          )}

          {vista === 'anios' && (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Años">
              {Array.from({ length: 12 }, (_, i) => anioBase + i).map((y) => {
                const activo = y === mostrado.getFullYear();
                return (
                  <button key={y} type="button" aria-pressed={activo} onClick={() => { setMostrado(new Date(y, mostrado.getMonth(), 1)); setVista('meses'); }}
                    className={cn('num h-11 rounded-control text-sm transition-colors', activo ? 'bg-brand font-semibold text-brand-ink' : 'text-ink hover:bg-surface-2')}>{y}</button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="text-xs text-ink-muted">Esc para cerrar</span>
            <button type="button" disabled={bloqueado(hoyD)} onClick={() => elegir(hoyD)} className="h-8 rounded-control px-3 text-[0.8125rem] font-medium text-teal-ink transition-colors hover:bg-teal-soft disabled:opacity-50">Hoy</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
