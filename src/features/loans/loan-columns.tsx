import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/data-display/status-badge';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { PrestamoListadoApi } from '@/services/prestamos-api';
import { MenuAccionesPrestamo } from './loan-actions';
import { ESTADOS_PRESTAMO, codigoPrestamo } from './loan-utils';
import type { useAccionesPrestamo } from './use-contrato';

const sinDato = <span className="text-ink-subtle" aria-label="No aplica">—</span>;
const plural = (n: number) => `${n} ${n === 1 ? 'cuota vencida' : 'cuotas vencidas'}`;

/** Texto en el que busca el listado: código (PR-1001 o 1001), nombre del cliente y su documento. */
export const textoBusquedaPrestamo = (p: PrestamoListadoApi) =>
  [codigoPrestamo(p.numero), String(p.numero), p.clienteNombre, p.clienteNumeroDocumento].join(' ');

/**
 * Columnas del listado de préstamos (datos reales del servidor). La fila completa es clicable y se activa con teclado; el
 * código es además un enlace real. No hay icono de ojo. Código y fecha, cliente y documento, agencia y asesor comparten celda
 * para que la tabla quepa sin scroll horizontal; el total pendiente aparece desde pantallas anchas.
 */
export function columnasPrestamo(acciones: ReturnType<typeof useAccionesPrestamo>): ColumnDef<PrestamoListadoApi>[] {
  return [
    {
      id: 'codigo', header: 'Préstamo', accessorFn: (p) => p.numero, meta: { className: 'w-[7.5rem]' },
      cell: ({ row: { original: p } }) => (
        <div>
          <Link to={`/prestamos/${p.id}`} className="num font-medium text-teal-ink hover:underline">{codigoPrestamo(p.numero)}</Link>
          <p className="num whitespace-nowrap text-xs text-ink-muted" title="Fecha de desembolso">{fecha(p.fechaDesembolso)}</p>
        </div>
      )
    },
    {
      id: 'cliente', header: 'Cliente', accessorFn: (p) => p.clienteNombre,
      cell: ({ row: { original: p } }) => (
        <div className="min-w-[10rem] max-w-[18rem]">
          <p className="truncate font-medium text-ink" title={p.clienteNombre}>{p.clienteNombre}</p>
          <p className="num truncate text-xs text-ink-muted">{p.clienteTipoDocumento} {p.clienteNumeroDocumento}</p>
        </div>
      )
    },
    {
      id: 'responsable', header: 'Agencia / asesor', accessorFn: (p) => `${p.agenciaNombre} ${p.asesorNombre}`, meta: { className: 'hidden lg:table-cell' },
      cell: ({ row: { original: p } }) => (
        <div className="min-w-[8rem] max-w-[13rem]">
          <p className="truncate text-ink" title={p.agenciaNombre}>{p.agenciaNombre}</p>
          <p className="truncate text-xs text-ink-muted" title={p.asesorNombre}>{p.asesorNombre}</p>
        </div>
      )
    },
    { id: 'capital', header: 'Capital', accessorFn: (p) => p.capital, meta: { derecha: true }, cell: ({ row: { original: p } }) => money(p.capital) },
    { id: 'capitalPend', header: 'Cap. pend.', accessorFn: (p) => p.capitalPendiente, meta: { derecha: true, descripcion: 'Capital que aún no figura como pagado' }, cell: ({ row: { original: p } }) => money(p.capitalPendiente) },
    {
      id: 'pendiente', header: 'Total pend.', accessorFn: (p) => p.totalPendiente,
      meta: { derecha: true, className: 'hidden xl:table-cell', descripcion: 'Importe contractual pendiente (capital + intereses)' }, cell: ({ row: { original: p } }) => money(p.totalPendiente)
    },
    {
      id: 'proxima', header: 'Próx. venc.', accessorFn: (p) => p.proximoVencimiento ?? '9999-12-31',
      cell: ({ row: { original: p } }) => <span className="whitespace-nowrap">{p.proximoVencimiento ? fecha(p.proximoVencimiento) : sinDato}</span>
    },
    {
      id: 'estado', header: 'Estado', accessorFn: (p) => p.estado, filterFn: 'equalsString',
      sortingFn: (a, b) => ESTADOS_PRESTAMO.indexOf(a.original.estado) - ESTADOS_PRESTAMO.indexOf(b.original.estado),
      cell: ({ row: { original: p } }) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge estado={p.estado} />
          {p.cuotasVencidas > 0 && <span className="num text-xs text-ink-muted">{plural(p.cuotasVencidas)}</span>}
        </div>
      )
    },
    {
      id: 'acciones', header: () => <span className="sr-only">Acciones</span>, enableSorting: false, meta: { className: 'w-14' },
      cell: ({ row: { original: p } }) => <MenuAccionesPrestamo id={p.id} numero={p.numero} acciones={acciones} />
    }
  ];
}

/** Tarjeta móvil: toda la tarjeta es un enlace al detalle. */
export function TarjetaPrestamo({ p, acciones }: { p: PrestamoListadoApi; acciones: ReturnType<typeof useAccionesPrestamo> }) {
  return (
    <div className="relative">
    <Link to={`/prestamos/${p.id}`} className="block space-y-2.5 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num font-medium text-teal-ink">{codigoPrestamo(p.numero)}</p>
          <p className="truncate text-sm text-ink">{p.clienteNombre}</p>
          <p className="num truncate text-xs text-ink-muted">{p.clienteTipoDocumento} {p.clienteNumeroDocumento}</p>
        </div>
        <StatusBadge estado={p.estado} className="shrink-0" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><dt className="text-xs text-ink-muted">Capital</dt><dd className="num text-ink">{money(p.capital)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Cap. pendiente</dt><dd className="num text-ink">{money(p.capitalPendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Total pendiente</dt><dd className="num font-medium text-ink">{money(p.totalPendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Próx. vencimiento</dt><dd className="text-ink">{p.proximoVencimiento ? fecha(p.proximoVencimiento) : '—'}</dd></div>
      </dl>
      {p.cuotasVencidas > 0 && <p className="num text-xs font-medium text-danger-ink">{plural(p.cuotasVencidas)}</p>}
    </Link>
    <div className="absolute bottom-2 right-2"><MenuAccionesPrestamo id={p.id} numero={p.numero} acciones={acciones} /></div>
    </div>
  );
}
