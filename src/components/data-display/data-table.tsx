import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ColumnFiltersState, type SortingState
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn, normalizar } from '@/lib/utils';

/* Referencias estables: un `[]` nuevo en cada render haría que TanStack recalcule el estado y reinicie la paginación en bucle. */
const SIN_FILTROS: ColumnFiltersState = [];
const SIN_ORDEN: SortingState = [];

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (fila: T) => string;
  /** Texto en el que busca el filtro global (sin tildes). */
  textoBusqueda: (fila: T) => string;
  busqueda?: string;
  filtros?: ColumnFiltersState;
  ordenInicial?: SortingState;
  tamanoPagina?: number;
  cargando?: boolean;
  vacio: ReactNode;
  /** Presentación alternativa en pantallas pequeñas. */
  tarjeta: (fila: T) => ReactNode;
  alAbrir?: (fila: T) => void;
  etiqueta: string;
  /** Nombre en plural para el pie ("clientes"). */
  unidad: string;
}

/** Tabla profesional: ordenación, filtros, paginación, skeletons, estados vacíos y tarjetas en móvil. */
export function DataTable<T>({ data, columns, getRowId, textoBusqueda, busqueda = '', filtros = SIN_FILTROS, ordenInicial = SIN_ORDEN, tamanoPagina = 8, cargando, vacio, tarjeta, alAbrir, etiqueta, unidad }: Props<T>) {
  const [orden, setOrden] = useState<SortingState>(ordenInicial);
  const escritorio = useMediaQuery('(min-width: 768px)');

  const table = useReactTable({
    data, columns, getRowId,
    state: { sorting: orden, globalFilter: busqueda, columnFilters: filtros },
    onSortingChange: setOrden,
    globalFilterFn: (row, _id, valor: string) => normalizar(textoBusqueda(row.original)).includes(normalizar(valor)),
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: tamanoPagina } },
    autoResetPageIndex: true
  });

  // Al cambiar filtros o búsqueda se vuelve a la primera página.
  const { setPageIndex } = table;
  const claveFiltros = JSON.stringify(filtros) + busqueda;
  useEffect(() => { setPageIndex(0); }, [claveFiltros, setPageIndex]);

  const filas = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const desde = total ? pageIndex * pageSize + 1 : 0;
  const hasta = Math.min(total, (pageIndex + 1) * pageSize);

  if (cargando) {
    return (
      <div className="space-y-3 p-5" role="status" aria-label={`Cargando ${unidad}`}>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (!total) return <>{vacio}</>;

  return (
    <div>
      {escritorio ? (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={etiqueta}>
            <thead className="bg-surface-2/70 text-left">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sentido = h.column.getIsSorted();
                    const meta = h.column.columnDef.meta;
                    const derecha = meta?.derecha;
                    return (
                      <th key={h.id} scope="col" title={meta?.descripcion} aria-sort={sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : h.column.getCanSort() ? 'none' : undefined} className={cn('whitespace-nowrap border-b border-line px-3 py-2.5 text-xs font-medium text-ink-muted first:pl-4 last:pr-4', derecha && 'text-right', meta?.className)}>
                        {h.column.getCanSort() ? (
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-ink', sentido && 'text-ink')}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sentido === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : sentido === 'desc' ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />}
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {filas.map((row) => (
                <tr key={row.id} onClick={alAbrir ? () => alAbrir(row.original) : undefined}
                  tabIndex={alAbrir ? 0 : undefined}
                  onKeyDown={alAbrir ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alAbrir(row.original); } } : undefined}
                  className={cn('border-b border-line last:border-0 transition-colors', alAbrir && 'cursor-pointer hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-offset-[-2px]')}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return <td key={cell.id} className={cn('px-3 py-3 align-middle first:pl-4 last:pr-4', meta?.derecha && 'num whitespace-nowrap text-right', meta?.className)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-line" aria-label={etiqueta}>
          {filas.map((row) => <li key={row.id}>{tarjeta(row.original)}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="num text-[0.8125rem] text-ink-muted" aria-live="polite">{desde}–{hasta} de {total} {unidad}</p>
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Página anterior"><ChevronLeft className="size-4" />Anterior</Button>
            <span className="num px-1.5 text-[0.8125rem] text-ink-muted">{pageIndex + 1} / {table.getPageCount()}</span>
            <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Página siguiente">Siguiente<ChevronRight className="size-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
