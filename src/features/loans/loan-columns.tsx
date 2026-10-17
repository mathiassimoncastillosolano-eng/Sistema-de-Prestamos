import type { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Button } from '@/components/ui/button';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { FilaPrestamo } from '@/lib/selectors';
import type { EstadoPrestamo } from '@/types';

/** Orden en que se ofrecen los filtros y se ordena la columna de estado (de la solicitud al cierre). */
export const ESTADOS_PRESTAMO: readonly EstadoPrestamo[] = ['En evaluación', 'Aprobado', 'Vigente', 'En mora', 'Cancelado', 'Rechazado'];

/** Importe o guion cuando no aplica (solicitudes sin desembolsar no tienen saldo). */
const importe = (f: FilaPrestamo, valor: number) => (f.prestamo.etapa ? <span className="text-ink-subtle" aria-label="No aplica">—</span> : money(valor));

/**
 * Columnas del listado de préstamos, pensadas para caber entre la barra lateral y el borde de la ventana sin scroll horizontal:
 * código y fecha de desembolso comparten celda, cliente y asesor también, y el total contractual pendiente solo aparece
 * desde pantallas anchas (en el detalle del préstamo está completo).
 */
export function columnasPrestamo({ mostrarCliente = true }: { mostrarCliente?: boolean } = {}): ColumnDef<FilaPrestamo>[] {
  const cols: ColumnDef<FilaPrestamo>[] = [
    {
      id: 'id', header: 'Préstamo', accessorFn: (f) => f.prestamo.id, meta: { className: 'w-[7rem]' },
      cell: ({ row: { original: f } }) => (
        <div>
          <Link to={`/prestamos/${f.prestamo.id}`} className="num font-medium text-teal-ink hover:underline">{f.prestamo.id}</Link>
          <p className="num whitespace-nowrap text-xs text-ink-muted" title={f.prestamo.etapa ? 'Fecha prevista de desembolso' : 'Fecha de desembolso'}>{f.prestamo.etapa ? 'Prev. ' : ''}{fecha(f.prestamo.desembolso)}</p>
        </div>
      )
    }
  ];
  if (mostrarCliente) {
    cols.push({
      id: 'cliente', header: 'Cliente', accessorFn: (f) => f.cliente?.nombre ?? '',
      cell: ({ row: { original: f } }) => (
        <div className="min-w-[9rem] max-w-[16rem]"><p className="truncate font-medium text-ink" title={f.cliente?.nombre}>{f.cliente?.nombre ?? f.prestamo.clienteId}</p><p className="truncate text-xs text-ink-muted">{f.prestamo.asesor} · {f.prestamo.agencia}</p></div>
      )
    });
  }
  cols.push(
    { id: 'capital', header: 'Capital', accessorFn: (f) => f.prestamo.capital, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.prestamo.capital) },
    { id: 'capitalPend', header: 'Cap. pend.', accessorFn: (f) => f.resumen.capitalPend, meta: { derecha: true, descripcion: 'Capital pendiente según el registro histórico' }, cell: ({ row: { original: f } }) => importe(f, f.resumen.capitalPend) },
    {
      id: 'pendiente', header: 'Total pend.', accessorFn: (f) => f.resumen.pendiente,
      meta: { derecha: true, className: 'hidden xl:table-cell', descripcion: 'Importe contractual pendiente (capital + intereses)' }, cell: ({ row: { original: f } }) => importe(f, f.resumen.pendiente)
    },
    { id: 'proxima', header: 'Próx. venc.', accessorFn: (f) => f.resumen.proxima?.fecha ?? '9999', cell: ({ row: { original: f } }) => <span className="whitespace-nowrap">{f.resumen.proxima ? fecha(f.resumen.proxima.fecha) : <span className="text-ink-subtle" aria-label="No aplica">—</span>}</span> },
    {
      id: 'estado', header: 'Estado', accessorFn: (f) => f.estado, filterFn: 'equalsString', sortingFn: (a, b) => ESTADOS_PRESTAMO.indexOf(a.original.estado) - ESTADOS_PRESTAMO.indexOf(b.original.estado),
      cell: ({ row: { original: f } }) => <StatusBadge estado={f.estado} />
    },
    {
      id: 'acciones', header: () => <span className="sr-only">Acciones</span>, enableSorting: false, meta: { className: 'w-12 text-right' },
      cell: ({ row: { original: f } }) => (
        <Button asChild variant="ghost" size="iconSm" className="-my-1"><Link to={`/prestamos/${f.prestamo.id}`} aria-label={`Ver detalle del préstamo ${f.prestamo.id}`} onClick={(e) => e.stopPropagation()}><Eye className="size-4" aria-hidden /></Link></Button>
      )
    }
  );
  return cols;
}

export function TarjetaPrestamo({ f, mostrarCliente = true }: { f: FilaPrestamo; mostrarCliente?: boolean }) {
  const sinDesembolso = !!f.prestamo.etapa;
  return (
    <Link to={`/prestamos/${f.prestamo.id}`} className="block space-y-2.5 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="num font-medium text-teal-ink">{f.prestamo.id}</p>{mostrarCliente && <p className="truncate text-sm text-ink">{f.cliente?.nombre}</p>}</div>
        <StatusBadge estado={f.estado} className="shrink-0" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><dt className="text-xs text-ink-muted">Capital</dt><dd className="num text-ink">{money(f.prestamo.capital)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Cap. pendiente</dt><dd className="num text-ink">{sinDesembolso ? '—' : money(f.resumen.capitalPend)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Total pendiente</dt><dd className="num font-medium text-ink">{sinDesembolso ? '—' : money(f.resumen.pendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">{sinDesembolso ? 'Desembolso previsto' : 'Próx. vencimiento'}</dt><dd className="text-ink">{sinDesembolso ? fecha(f.prestamo.desembolso) : f.resumen.proxima ? fecha(f.resumen.proxima.fecha) : '—'}</dd></div>
      </dl>
    </Link>
  );
}
