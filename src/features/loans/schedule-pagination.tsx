import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TAMANOS_PAGINA, paginasVisibles, type PaginaCronograma } from './loan-utils';

interface Props {
  pg: PaginaCronograma<unknown>;
  tamano: number;
  onPagina: (n: number) => void;
  onTamano: (n: number) => void;
  /** Etiqueta del cronograma para lectores de pantalla. */
  etiqueta?: string;
  className?: string;
}

/**
 * Paginador compacto del cronograma: rango visible a la izquierda; tamaño de página, Anterior, páginas numeradas y Siguiente
 * a la derecha. Se opera con teclado (son botones y un select nativo). Con una sola página muestra solo el rango.
 */
export function SchedulePagination({ pg, tamano, onPagina, onTamano, etiqueta = 'Cronograma de cuotas', className }: Props) {
  const idTamano = useId();
  const unaPagina = pg.paginas <= 1 && pg.total <= Math.min(...TAMANOS_PAGINA);
  return (
    <nav aria-label={`Paginación de ${etiqueta.toLowerCase()}`} className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3', className)}>
      <p className="num text-[0.8125rem] text-ink-muted" aria-live="polite">
        {pg.total === 0 ? 'Sin cuotas' : <>Mostrando cuotas {pg.desde}–{pg.hasta} de {pg.total}</>}
      </p>
      {!unaPagina && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-muted">
            <label htmlFor={idTamano}>Por página</label>
            <select id={idTamano} value={tamano} onChange={(e) => onTamano(Number(e.target.value))}
              className="h-8 rounded-control border border-line-strong bg-surface px-2 text-[0.8125rem] text-ink focus-visible:border-teal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-teal/25">
              {TAMANOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => onPagina(pg.pagina - 1)} disabled={pg.pagina <= 1} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden /><span className="hidden sm:inline">Anterior</span></Button>
            <ul className="flex items-center gap-1" aria-label="Páginas">
              {paginasVisibles(pg.pagina, pg.paginas).map((n, i) => (
                <li key={`${n}-${i}`}>
                  {n === '…'
                    ? <span aria-hidden className="px-1 text-ink-muted">…</span>
                    : <Button size="sm" variant={n === pg.pagina ? 'primary' : 'ghost'} onClick={() => onPagina(n)} aria-label={`Página ${n}`} aria-current={n === pg.pagina ? 'page' : undefined} className="num min-w-8 px-2">{n}</Button>}
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={() => onPagina(pg.pagina + 1)} disabled={pg.pagina >= pg.paginas} aria-label="Página siguiente"><span className="hidden sm:inline">Siguiente</span><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
        </div>
      )}
    </nav>
  );
}
