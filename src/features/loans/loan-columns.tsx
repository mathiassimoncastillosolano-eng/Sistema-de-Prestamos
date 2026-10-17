import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { FilaPrestamo } from '@/lib/selectors';

export function columnasPrestamo({ mostrarCliente = true }: { mostrarCliente?: boolean } = {}): ColumnDef<FilaPrestamo>[] {
  const cols: ColumnDef<FilaPrestamo>[] = [
    {
      id: 'id', header: 'Código', accessorFn: (f) => f.prestamo.id,
      cell: ({ row: { original: f } }) => <Link to={`/prestamos/${f.prestamo.id}`} className="num font-medium text-teal-ink hover:underline">{f.prestamo.id}</Link>
    }
  ];
  if (mostrarCliente) {
    cols.push({
      id: 'cliente', header: 'Cliente', accessorFn: (f) => f.cliente?.nombre ?? '',
      cell: ({ row: { original: f } }) => (
        <div className="min-w-0"><p className="truncate font-medium text-ink">{f.cliente?.nombre ?? f.prestamo.clienteId}</p><p className="truncate text-xs text-ink-muted">{f.prestamo.asesor} · {f.prestamo.agencia}</p></div>
      )
    });
  }
  cols.push(
    { id: 'capital', header: 'Capital', accessorFn: (f) => f.prestamo.capital, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.prestamo.capital) },
    { id: 'capitalPend', header: 'Cap. pendiente', accessorFn: (f) => f.resumen.capitalPend, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.resumen.capitalPend) },
    { id: 'pendiente', header: 'Contractual pend.', accessorFn: (f) => f.resumen.pendiente, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.resumen.pendiente) },
    { id: 'proxima', header: 'Próx. venc.', accessorFn: (f) => f.resumen.proxima?.fecha ?? '9999', cell: ({ row: { original: f } }) => <span className="whitespace-nowrap">{f.resumen.proxima ? fecha(f.resumen.proxima.fecha) : '—'}</span> },
    { id: 'desembolso', header: 'Desembolso', accessorFn: (f) => f.prestamo.desembolso, cell: ({ row: { original: f } }) => <span className="whitespace-nowrap">{fecha(f.prestamo.desembolso)}</span> }
  );
  return cols;
}

export function TarjetaPrestamo({ f, mostrarCliente = true }: { f: FilaPrestamo; mostrarCliente?: boolean }) {
  return (
    <Link to={`/prestamos/${f.prestamo.id}`} className="block space-y-2.5 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="num font-medium text-teal-ink">{f.prestamo.id}</p>{mostrarCliente && <p className="truncate text-sm text-ink">{f.cliente?.nombre}</p>}</div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div><dt className="text-xs text-ink-muted">Capital</dt><dd className="num text-ink">{money(f.prestamo.capital)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Cap. pendiente</dt><dd className="num text-ink">{money(f.resumen.capitalPend)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Contractual pend.</dt><dd className="num font-medium text-ink">{money(f.resumen.pendiente)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Próx. vencimiento</dt><dd className="text-ink">{f.resumen.proxima ? fecha(f.resumen.proxima.fecha) : '—'}</dd></div>
      </dl>
    </Link>
  );
}
