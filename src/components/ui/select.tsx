import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, LoaderCircle } from 'lucide-react';
import { Children, Fragment, isValidElement, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { controlBase } from './input';

/*
 * Selector desplegable propio (patrón «select-only combobox» de WAI-ARIA).
 * - Mismo uso que el <select> anterior: se declaran <option value="…">…</option> como hijos y
 *   `onChange` recibe `e.target.value` (siempre texto), de modo que los módulos y los valores enviados no cambian.
 * - El menú es propio (Radix Popover, ya presente en el proyecto): se pinta en un portal, así que no lo recortan
 *   tablas, tarjetas ni paneles laterales, y su aspecto es el mismo en todos los sistemas operativos.
 * - Teclado: ↑ ↓ Inicio Fin, Enter/Espacio para elegir, Esc para cerrar, escribir para saltar a una opción.
 */

export interface OpcionSelect { value: string; label: string; disabled?: boolean }

/** Evento mínimo que reciben los `onChange` (compatible con `e.target.value` del <select> nativo). */
export interface CambioSelect { target: { value: string; name: string } }

interface SelectProps extends Omit<ComponentProps<'button'>, 'value' | 'onChange' | 'children' | 'type' | 'defaultValue'> {
  value?: string | number;
  onChange?: (e: CambioSelect) => void;
  /** Hijos <option>. */
  children?: ReactNode;
  /** Texto cuando el valor no coincide con ninguna opción. */
  placeholder?: string;
  /** Muestra «Cargando…» en lugar de las opciones. */
  loading?: boolean;
  /** Texto cuando no hay opciones. */
  emptyText?: string;
}

const textoDe = (n: ReactNode): string => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (isValidElement(n)) return textoDe((n.props as { children?: ReactNode }).children);
  return '';
};

function leerOpciones(hijos: ReactNode): OpcionSelect[] {
  const salida: OpcionSelect[] = [];
  Children.forEach(hijos, (h) => {
    if (!isValidElement(h)) return;
    const p = h.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    if (h.type === 'option') {
      const label = textoDe(p.children);
      salida.push({ value: p.value !== undefined ? String(p.value) : label, label, disabled: p.disabled });
    } else if (h.type === 'optgroup' || h.type === Fragment) {
      salida.push(...leerOpciones(p.children));
    }
  });
  return salida;
}

export function Select({ className, children, value, onChange, name, disabled, placeholder = 'Seleccionar…', loading, emptyText = 'No hay opciones disponibles', id, ...resto }: SelectProps) {
  const uid = useId();
  const listaId = `${uid}-lista`;
  const opciones = useMemo(() => leerOpciones(children), [children]);
  const actual = value === undefined || value === null ? '' : String(value);
  const elegida = opciones.find((o) => o.value === actual);

  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const lista = useRef<HTMLDivElement>(null);
  const escrito = useRef({ texto: '', t: 0 });

  const primeraHabilitada = (desde = 0, paso: 1 | -1 = 1) => {
    for (let i = desde; i >= 0 && i < opciones.length; i += paso) if (!opciones[i].disabled) return i;
    return -1;
  };

  const alCambiarApertura = (o: boolean) => {
    setAbierto(o);
    if (o) setActivo(elegida && !elegida.disabled ? opciones.indexOf(elegida) : primeraHabilitada());
  };

  useEffect(() => {
    if (abierto) lista.current?.querySelector('[data-activo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo]);

  const elegir = (o: OpcionSelect | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== actual) onChange?.({ target: { value: o.value, name: name ?? '' } });
    setAbierto(false);
  };

  const mover = (desde: number, paso: 1 | -1) => {
    const i = primeraHabilitada(desde + paso, paso);
    if (i >= 0) setActivo(i);
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); mover(activo, 1); return;
      case 'ArrowUp': e.preventDefault(); mover(activo, -1); return;
      case 'Home': e.preventDefault(); setActivo(primeraHabilitada(0, 1)); return;
      case 'End': e.preventDefault(); setActivo(primeraHabilitada(opciones.length - 1, -1)); return;
      case 'Enter': e.preventDefault(); elegir(opciones[activo]); return;
      case ' ':
        if (!escrito.current.texto) { e.preventDefault(); elegir(opciones[activo]); return; }
        break;
      case 'Tab': setAbierto(false); return;
    }
    // Escritura rápida: salta a la primera opción que empieza por lo escrito.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      window.clearTimeout(escrito.current.t);
      escrito.current.texto += e.key.toLowerCase();
      escrito.current.t = window.setTimeout(() => { escrito.current.texto = ''; }, 600);
      const i = opciones.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(escrito.current.texto));
      if (i >= 0) setActivo(i);
    }
  };

  const alTeclearBoton = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || abierto) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); alCambiarApertura(true); }
  };

  return (
    <div className={cn('relative', className)}>
      <Popover.Root open={abierto} onOpenChange={alCambiarApertura}>
        <Popover.Trigger asChild>
          <button
            {...resto}
            id={id}
            type="button"
            role="combobox"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={abierto}
            aria-controls={abierto ? listaId : undefined}
            onKeyDown={(e) => { resto.onKeyDown?.(e); alTeclearBoton(e); }}
            className={cn(controlBase, 'flex h-11 items-center gap-2 pl-3 pr-9 text-left shadow-[0_1px_0_rgb(0_0_0/0.02)] sm:h-10', abierto && 'border-teal ring-[3px] ring-teal/25')}
          >
            <span className={cn('min-w-0 flex-1 truncate', !elegida && 'text-ink-subtle')}>{elegida ? elegida.label : placeholder}</span>
          </button>
        </Popover.Trigger>
        <ChevronDown className={cn('pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted transition-transform duration-150', abierto && 'rotate-180 text-teal')} aria-hidden />

        <Popover.Portal>
          <Popover.Content
            align="start" sideOffset={6} collisionPadding={12}
            onOpenAutoFocus={(e) => { e.preventDefault(); lista.current?.focus({ preventScroll: true }); }}
            className="z-[70] min-w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[calc(100vw-1.5rem)] animate-pop rounded-card border border-line bg-surface p-1.5 text-ink shadow-pop outline-none"
          >
            <div
              ref={lista}
              id={listaId}
              role="listbox"
              tabIndex={-1}
              aria-label={resto['aria-label']}
              aria-activedescendant={activo >= 0 ? `${listaId}-${activo}` : undefined}
              onKeyDown={alTeclear}
              className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height,18rem)-0.75rem))] overflow-y-auto overscroll-contain outline-none [scrollbar-width:thin]"
            >
              {loading ? (
                <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink-muted" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden />Cargando…</p>
              ) : opciones.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-muted">{emptyText}</p>
              ) : opciones.map((o, i) => {
                const sel = o.value === actual;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    id={`${listaId}-${i}`}
                    role="option"
                    aria-selected={sel}
                    aria-disabled={o.disabled || undefined}
                    data-activo={i === activo}
                    onMouseMove={() => { if (!o.disabled && i !== activo) setActivo(i); }}
                    onClick={() => elegir(o)}
                    className={cn(
                      'flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors sm:min-h-9',
                      i === activo && 'bg-surface-2',
                      sel && 'bg-teal-soft font-medium text-teal-ink',
                      sel && i === activo && 'bg-teal-soft',
                      o.disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {sel && <Check className="size-4 shrink-0 text-teal" aria-hidden />}
                  </div>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {name && <input type="hidden" name={name} value={actual} disabled={disabled} />}
    </div>
  );
}
