import type { ColumnDef } from '@tanstack/react-table';
import { Receipt } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { MovimientoPago } from '@/lib/selectors';

const ORDEN_OP = [{ id: 'op', desc: true }];

function columnas(mostrarPrestamo: boolean): ColumnDef<MovimientoPago>[] {
  const c: ColumnDef<MovimientoPago>[] = [
    { id: 'op', header: 'Operación', accessorFn: (m) => Number(m.op.slice(3)), cell: ({ row: { original: m } }) => <span className="num font-medium text-ink">{m.op}</span> },
    { id: 'fecha', header: 'Fecha', accessorFn: (m) => m.fecha, cell: ({ row: { original: m } }) => <span className="whitespace-nowrap">{fecha(m.fecha)}</span> }
  ];
  if (mostrarPrestamo) c.push({ id: 'prestamo', header: 'Préstamo', accessorFn: (m) => m.prestamoId, cell: ({ row: { original: m } }) => <div><Link to={`/prestamos/${m.prestamoId}`} className="num font-medium text-teal-ink hover:underline">{m.prestamoId}</Link><p className="truncate text-xs text-ink-muted">{m.clienteNombre}</p></div> });
  c.push(
    { id: 'tipo', header: 'Tipo', accessorFn: (m) => m.tipo, cell: ({ row: { original: m } }) => <Badge tone={m.tipo === 'Cancelación anticipada' ? 'info' : 'neutral'}>{m.tipo}</Badge> },
    { id: 'medio', header: 'Medio', accessorFn: (m) => m.medio, enableSorting: false, cell: ({ row: { original: m } }) => m.medio },
    { id: 'ref', header: 'Referencia', accessorFn: (m) => m.ref, enableSorting: false, cell: ({ row: { original: m } }) => <span className="num text-ink-muted">{m.ref || '—'}</span> },
    { id: 'monto', header: 'Importe', accessorFn: (m) => m.monto, meta: { derecha: true }, cell: ({ row: { original: m } }) => <span className="font-semibold text-ink">{money(m.monto)}</span> }
  );
  return c;
}

/** Historial de operaciones (pagos y cancelaciones) con presentación en tarjetas en móvil. */
export function PaymentHistory({ pagos, mostrarPrestamo = false, tamanoPagina = 8, vacioTexto = 'Todavía no se registran pagos.', etiqueta = 'Historial de pagos' }: { pagos: MovimientoPago[]; mostrarPrestamo?: boolean; tamanoPagina?: number; vacioTexto?: string; etiqueta?: string }) {
  const cols = useMemo(() => columnas(mostrarPrestamo), [mostrarPrestamo]);
  return (
    <DataTable data={pagos} columns={cols} getRowId={(m) => m.op} textoBusqueda={() => ''} tamanoPagina={tamanoPagina}
      ordenInicial={ORDEN_OP} etiqueta={etiqueta} unidad="operaciones"
      vacio={<EmptyState icon={Receipt} title="Sin pagos" description={vacioTexto} />}
      tarjeta={(m) => (
        <div className="space-y-1.5 p-4">
          <div className="flex items-center justify-between gap-3"><p className="num font-medium text-ink">{m.op}</p><p className="num font-semibold text-ink">{money(m.monto)}</p></div>
          <p className="text-xs text-ink-muted">{fecha(m.fecha)} · {m.medio}{m.ref ? ` · ${m.ref}` : ''}</p>
          <div className="flex items-center gap-2"><Badge tone={m.tipo === 'Cancelación anticipada' ? 'info' : 'neutral'}>{m.tipo}</Badge>{mostrarPrestamo && <Link to={`/prestamos/${m.prestamoId}`} className="num text-xs font-medium text-teal-ink">{m.prestamoId}</Link>}</div>
        </div>
      )} />
  );
}
