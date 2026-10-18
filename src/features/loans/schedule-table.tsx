import { useEffect, useState, type KeyboardEvent } from 'react';
import { StatusBadge } from '@/components/data-display/status-badge';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TAMANO_PAGINA_INICIAL, paginar, type FilaCronograma, type TotalesCronograma } from './loan-utils';
import { SchedulePagination } from './schedule-pagination';

interface Props {
  filas: FilaCronograma[];
  /** Totales entregados por el servidor (capital, intereses, total contractual): aquí no se recalcula nada. */
  totales: TotalesCronograma;
  /** Si se indica, cada fila es clicable y accesible por teclado (Enter o Espacio). */
  onSelect?: (numero: number) => void;
  /** Muestra la columna de estado (solo en préstamos registrados; una simulación no tiene estados). */
  conEstado?: boolean;
  /** Etiqueta accesible del cronograma. */
  etiqueta?: string;
  /** Pagina la tabla (10 por página, con selector 10/20/30). Los totales y el PDF siempre usan el cronograma completo. */
  paginada?: boolean;
  className?: string;
}

/** Acciones de teclado de una fila clicable. */
const teclaFila = (accion: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    accion();
  }
};

/**
 * Cronograma de cuotas: N.º, vencimiento, capital, interés, cuota, saldo de capital y (opcional) estado.
 * Sirve para la simulación, la revisión previa al registro y el detalle del préstamo. Los datos llegan ya calculados por el
 * servidor. Las filas son clicables (sin icono de ojo) y se pueden activar con teclado. En móvil se presenta como tarjetas.
 */
export function ScheduleTable({ filas, totales, onSelect, conEstado = false, etiqueta = 'Cronograma de cuotas', paginada = true, className }: Props) {
  const escritorio = useMediaQuery('(min-width: 768px)');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(TAMANO_PAGINA_INICIAL);
  // Un cronograma distinto (otro préstamo o nuevas condiciones) vuelve siempre a la primera página.
  const firma = `${filas.length}|${filas[0]?.importeCuota}|${filas[filas.length - 1]?.saldo}|${totales.total}`;
  useEffect(() => { setPagina(1); }, [firma]);
  const pg = paginar(filas, paginada ? pagina : 1, paginada ? tamano : Math.max(filas.length, 1));
  const visibles = pg.visibles;
  const paginador = paginada
    ? <SchedulePagination pg={pg} tamano={tamano} etiqueta={etiqueta} onPagina={setPagina} onTamano={(n) => { setTamano(n); setPagina(1); }} />
    : null;

  if (!escritorio) {
    return (
      <div className={className}>
      <ol className="divide-y divide-line" aria-label={etiqueta}>
        {visibles.map((c) => {
          const contenido = (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">Cuota {c.numero} · {fecha(c.fechaVencimiento)}</p>
                {conEstado && c.estado && <StatusBadge estado={c.estado} className="shrink-0" />}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-ink-muted">Capital</dt><dd className="num text-sm text-ink">{money(c.capital)}</dd></div>
                <div><dt className="text-ink-muted">Interés</dt><dd className="num text-sm text-ink">{money(c.interes)}</dd></div>
                <div><dt className="text-ink-muted">Cuota</dt><dd className="num text-sm font-semibold text-ink">{money(c.importeCuota)}</dd></div>
              </dl>
              <p className="num text-xs text-ink-muted">Saldo de capital {money(c.saldo)}</p>
            </>
          );
          return (
            <li key={c.numero}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(c.numero)} aria-label={`Ver detalle de la cuota ${c.numero}`} className="block w-full space-y-2 p-4 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-offset-[-2px]">{contenido}</button>
                : <div className="space-y-2 p-4">{contenido}</div>}
            </li>
          );
        })}
        <li className="num space-y-1 bg-surface-2/60 p-4 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Capital</span><b>{money(totales.capital)}</b></div>
          <div className="flex justify-between"><span className="text-ink-muted">Intereses</span><b>{money(totales.intereses)}</b></div>
          <div className="flex justify-between"><span className="text-ink-muted">Importe contractual total</span><b>{money(totales.total)}</b></div>
        </li>
      </ol>
      {paginador}
      </div>
    );
  }

  const celda = 'whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4';
  return (
    <div className={className}>
    <table className="w-full border-collapse text-sm" aria-label={etiqueta}>
      <thead className="bg-surface-2/70 text-left text-xs font-medium text-ink-muted">
        <tr>
          <th scope="col" className={celda}>N.º</th><th scope="col" className={celda}>Vence</th>
          {[['Capital', 'Capital de la cuota'], ['Interés', 'Interés de la cuota'], ['Cuota', 'Importe de la cuota'], ['Saldo cap.', 'Saldo de capital tras esta cuota']].map(([h, t]) => <th key={h} scope="col" title={t} className={cn(celda, 'text-right')}>{h}</th>)}
          {conEstado && <th scope="col" className={celda}>Estado</th>}
        </tr>
      </thead>
      <tbody>
        {visibles.map((c) => {
          const abrir = onSelect ? () => onSelect(c.numero) : undefined;
          return (
            <tr
              key={c.numero}
              onClick={abrir}
              onKeyDown={abrir ? teclaFila(abrir) : undefined}
              tabIndex={abrir ? 0 : undefined}
              aria-label={abrir ? `Ver detalle de la cuota ${c.numero}` : undefined}
              className={cn('border-t border-line transition-colors', abrir && 'cursor-pointer hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-offset-[-2px]')}
            >
              <td className={cn(celda, 'num font-medium text-ink')}>{c.numero}</td>
              <td className={celda}>{fecha(c.fechaVencimiento)}</td>
              <td className={cn(celda, 'num text-right')}>{money(c.capital)}</td>
              <td className={cn(celda, 'num text-right')}>{money(c.interes)}</td>
              <td className={cn(celda, 'num text-right font-semibold text-ink')}>{money(c.importeCuota)}</td>
              <td className={cn(celda, 'num text-right text-ink-muted')}>{money(c.saldo)}</td>
              {conEstado && <td className={celda}>{c.estado ? <StatusBadge estado={c.estado} /> : null}</td>}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="num border-t-2 border-line-strong bg-surface-2/60 font-semibold text-ink">
          <td colSpan={2} className={celda}>Totales</td>
          <td className={cn(celda, 'text-right')}>{money(totales.capital)}</td>
          <td className={cn(celda, 'text-right')}>{money(totales.intereses)}</td>
          <td className={cn(celda, 'text-right')}>{money(totales.total)}</td>
          <td colSpan={conEstado ? 2 : 1} />
        </tr>
      </tfoot>
    </table>
    {paginador}
    </div>
  );
}
