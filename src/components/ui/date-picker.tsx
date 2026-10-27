import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { controlBase } from './input';

/*
 * Selector de fecha propio (Radix Popover, igual que el Select del sistema): el calendario nativo del navegador no
 * se puede estilizar y se ve distinto en cada sistema. Valor de texto compatible con <input type="date">
 * («yyyy-MM-dd») o, con `conHora`, con <input type="datetime-local"> («yyyy-MM-ddTHH:mm»).
 * Teclado: flechas mueven el día, AvPág/RePág el mes, Inicio/Fin la semana, Enter/Espacio eligen, Esc cierra.
 */

const DIAS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n: number) => String(n).padStart(2, '0');
const aClave = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mismoDia = (a: Date, b: Date) => aClave(a) === aClave(b);
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sumarMeses = (d: Date, n: number) => {
  const dia = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  return new Date(r.getFullYear(), r.getMonth(), Math.min(dia, ultimo));
};

function leer(valor: string | undefined): { fecha: Date | null; hora: number; minuto: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(valor ?? '');
  if (!m) return { fecha: null, hora: 0, minuto: 0 };
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(fecha.getTime())) return { fecha: null, hora: 0, minuto: 0 };
  return { fecha, hora: Number(m[4] ?? 0), minuto: Number(m[5] ?? 0) };
}

interface DatePickerProps extends Omit<ComponentProps<'button'>, 'value' | 'onChange' | 'type' | 'children' | 'defaultValue' | 'min' | 'max'> {
  value?: string;
  /** Recibe el valor en texto («yyyy-MM-dd» o «yyyy-MM-ddTHH:mm»); cadena vacía al borrar. */
  onChange?: (valor: string) => void;
  /** Límites inclusivos («yyyy-MM-dd»; si trae hora se ignora). */
  min?: string;
  max?: string;
  conHora?: boolean;
  placeholder?: string;
}

export function DatePicker({ className, value, onChange, min, max, conHora, placeholder = 'Elegir fecha', disabled, id, ...resto }: DatePickerProps) {
  const { fecha: elegida, hora, minuto } = useMemo(() => leer(value), [value]);
  const minD = useMemo(() => leer(min).fecha, [min]);
  const maxD = useMemo(() => leer(max).fecha, [max]);
  const hoy = new Date();
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Date>(elegida ?? hoy); // mes visible
  const [foco, setFoco] = useState<Date>(elegida ?? hoy); // día con foco de teclado
  const [verMeses, setVerMeses] = useState(false);
  const rejilla = useRef<HTMLDivElement>(null);
  const pedirFoco = useRef(false);

  const fueraDeRango = (d: Date) => (minD !== null && aClave(d) < aClave(minD)) || (maxD !== null && aClave(d) > aClave(maxD));

  const alCambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (a) {
      const base = elegida ?? hoy;
      setVista(base);
      setFoco(base);
      setVerMeses(false);
      pedirFoco.current = true;
    }
  };

  useEffect(() => {
    if (!abierto || verMeses || !pedirFoco.current) return;
    pedirFoco.current = false;
    rejilla.current?.querySelector<HTMLButtonElement>('button[data-foco="true"]')?.focus();
  });

  const emitir = (d: Date, h = hora, mi = minuto) => onChange?.(conHora ? `${aClave(d)}T${pad(h)}:${pad(mi)}` : aClave(d));

  const elegir = (d: Date) => {
    if (fueraDeRango(d)) return;
    emitir(d);
    if (!conHora) setAbierto(false);
    else {
      setFoco(d);
      setVista(d);
    }
  };

  const mover = (d: Date) => {
    setFoco(d);
    if (d.getMonth() !== vista.getMonth() || d.getFullYear() !== vista.getFullYear()) setVista(d);
    pedirFoco.current = true;
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const mapa: Record<string, Date | undefined> = {
      ArrowLeft: sumarDias(foco, -1),
      ArrowRight: sumarDias(foco, 1),
      ArrowUp: sumarDias(foco, -7),
      ArrowDown: sumarDias(foco, 7),
      PageUp: sumarMeses(foco, -1),
      PageDown: sumarMeses(foco, 1),
      Home: sumarDias(foco, -((foco.getDay() + 6) % 7)),
      End: sumarDias(foco, 6 - ((foco.getDay() + 6) % 7))
    };
    const destino = mapa[e.key];
    if (destino) {
      e.preventDefault();
      mover(destino);
    }
  };

  // Celdas del mes visible: lunes a domingo, con los días de los meses vecinos atenuados.
  const celdas = useMemo(() => {
    const primero = new Date(vista.getFullYear(), vista.getMonth(), 1);
    const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  }, [vista]);
  const filas = celdas[35].getMonth() === vista.getMonth() ? 6 : 5;

  const texto = elegida
    ? `${elegida.getDate()} ${MESES_CORTOS[elegida.getMonth()]} ${elegida.getFullYear()}${conHora ? ` · ${pad(hora)}:${pad(minuto)}` : ''}`
    : '';

  const ponerHora = (h: number, mi: number) => emitir(elegida ?? (fueraDeRango(hoy) ? (minD ?? hoy) : hoy), h, mi);

  return (
    <div className={cn('relative', className)}>
      <Popover.Root open={abierto} onOpenChange={alCambiarApertura}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={abierto}
            className={cn(controlBase, 'flex h-11 items-center gap-2 pl-3 pr-9 text-left shadow-[0_1px_0_rgb(0_0_0/0.02)] sm:h-10', abierto && 'border-teal ring-[3px] ring-teal/25')}
            {...resto}
          >
            <span className={cn('min-w-0 flex-1 truncate', !texto && 'text-ink-subtle')}>{texto || placeholder}</span>
          </button>
        </Popover.Trigger>
        <CalendarDays className={cn('pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted transition-colors', abierto && 'text-teal')} aria-hidden />

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label="Calendario"
            className="z-[70] w-[19rem] max-w-[calc(100vw-1.5rem)] animate-pop rounded-card border border-line bg-surface p-3 text-ink shadow-pop outline-none"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setVerMeses((v) => !v)}
                className="rounded-control px-2 py-1 text-sm font-semibold capitalize transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25"
                aria-live="polite"
              >
                {verMeses ? vista.getFullYear() : `${MESES[vista.getMonth()]} ${vista.getFullYear()}`}
              </button>
              <div className="flex items-center gap-0.5">
                <BotonNav etiqueta={verMeses ? 'Año anterior' : 'Mes anterior'} onClick={() => setVista(sumarMeses(vista, verMeses ? -12 : -1))}><ChevronLeft className="size-4" aria-hidden /></BotonNav>
                <BotonNav etiqueta={verMeses ? 'Año siguiente' : 'Mes siguiente'} onClick={() => setVista(sumarMeses(vista, verMeses ? 12 : 1))}><ChevronRight className="size-4" aria-hidden /></BotonNav>
              </div>
            </div>

            {verMeses ? (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {MESES_CORTOS.map((m, i) => {
                  const actual = i === vista.getMonth();
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const v = new Date(vista.getFullYear(), i, 1);
                        setVista(v);
                        setFoco(new Date(v.getFullYear(), v.getMonth(), Math.min(foco.getDate(), new Date(v.getFullYear(), i + 1, 0).getDate())));
                        setVerMeses(false);
                        pedirFoco.current = true;
                      }}
                      className={cn(
                        'h-10 rounded-control text-sm font-medium capitalize transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25',
                        actual && 'bg-teal-soft text-teal-ink'
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium uppercase text-ink-muted" aria-hidden>
                  {DIAS.map((d) => <span key={d} className="py-1">{d}</span>)}
                </div>
                <div ref={rejilla} role="grid" aria-label={`${MESES[vista.getMonth()]} ${vista.getFullYear()}`} onKeyDown={alTeclear} className="grid grid-cols-7 gap-y-0.5">
                  {celdas.slice(0, filas * 7).map((d) => {
                    const delMes = d.getMonth() === vista.getMonth();
                    const sel = elegida !== null && mismoDia(d, elegida);
                    const esHoy = mismoDia(d, hoy);
                    const bloqueado = fueraDeRango(d);
                    const conFoco = mismoDia(d, foco);
                    return (
                      <button
                        key={aClave(d)}
                        type="button"
                        role="gridcell"
                        data-foco={conFoco}
                        tabIndex={conFoco ? 0 : -1}
                        disabled={bloqueado}
                        aria-selected={sel}
                        aria-current={esHoy ? 'date' : undefined}
                        aria-label={`${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`}
                        onClick={() => elegir(d)}
                        className={cn(
                          'num mx-auto grid size-9 place-items-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/30',
                          delMes ? 'text-ink' : 'text-ink-subtle',
                          !sel && !bloqueado && 'hover:bg-surface-2',
                          esHoy && !sel && 'font-semibold text-teal-ink ring-1 ring-inset ring-teal/50',
                          sel && 'bg-teal font-semibold text-on-teal shadow-sm',
                          bloqueado && 'cursor-not-allowed text-ink-subtle/50 line-through decoration-transparent'
                        )}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {conHora && (
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                <span className="text-sm text-ink-muted">Hora</span>
                <CampoNumero etiqueta="Hora" valor={hora} max={23} onCambio={(h) => ponerHora(h, minuto)} />
                <span aria-hidden className="text-ink-muted">:</span>
                <CampoNumero etiqueta="Minuto" valor={minuto} max={59} onCambio={(mi) => ponerHora(hora, mi)} />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-sm">
              <button
                type="button"
                onClick={() => { onChange?.(''); setAbierto(false); }}
                className="rounded-control px-2 py-1 font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25"
              >
                Borrar
              </button>
              <div className="flex items-center gap-1">
                {conHora && (
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    disabled={!elegida}
                    className="rounded-control bg-teal px-3 py-1 font-semibold text-on-teal transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/30"
                  >
                    Listo
                  </button>
                )}
                <button
                  type="button"
                  disabled={fueraDeRango(hoy)}
                  onClick={() => {
                    const h = new Date();
                    if (conHora) { emitir(h, h.getHours(), h.getMinutes()); setVista(h); setFoco(h); } else elegir(h);
                  }}
                  className="rounded-control px-2 py-1 font-semibold text-teal-ink transition-colors hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25"
                >
                  Hoy
                </button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function BotonNav({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25"
    >
      {children}
    </button>
  );
}

function CampoNumero({ etiqueta, valor, max, onCambio }: { etiqueta: string; valor: number; max: number; onCambio: (n: number) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={etiqueta}
      value={pad(valor)}
      maxLength={2}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, '').slice(-2));
        onCambio(Math.min(max, Number.isNaN(n) ? 0 : n));
      }}
      className={cn(controlBase, 'num h-9 w-14 px-0 text-center')}
    />
  );
}
