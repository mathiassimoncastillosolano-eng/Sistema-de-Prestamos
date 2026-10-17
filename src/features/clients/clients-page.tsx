import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, SearchX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useDb } from '@/hooks/use-db';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { filasClientes, type FilaCliente } from '@/lib/selectors';
import type { TipoCliente } from '@/types';
import { ClientFormSheet } from './client-form-sheet';

const TONO_TIPO: Record<TipoCliente, 'teal' | 'navy' | 'neutral'> = { DNI: 'neutral', 'RUC 10': 'teal', 'RUC 20': 'navy' };

const columnas: ColumnDef<FilaCliente>[] = [
  {
    id: 'nombre', header: 'Cliente', accessorFn: (f) => f.cliente.nombre,
    cell: ({ row: { original: f } }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={f.cliente.nombre} tipo={f.cliente.tipo} />
        <div className="min-w-0">
          <Link to={`/clientes/${f.cliente.id}`} className="block truncate font-medium text-ink hover:text-teal-ink hover:underline">{f.cliente.nombre}</Link>
          <p className="truncate text-xs text-ink-muted">{f.cliente.id} · alta {fecha(f.cliente.alta)}</p>
        </div>
      </div>
    )
  },
  {
    id: 'documento', header: 'Documento', accessorFn: (f) => f.cliente.doc, enableSorting: false,
    cell: ({ row: { original: f } }) => <div className="flex items-center gap-2"><Badge tone={TONO_TIPO[f.cliente.tipo]}>{f.cliente.tipo}</Badge><span className="num text-ink">{f.cliente.doc}</span></div>
  },
  {
    id: 'contacto', header: 'Contacto', enableSorting: false, meta: { className: 'hidden xl:table-cell' },
    cell: ({ row: { original: f } }) => (
      <div className="min-w-0">
        <p className="num text-ink">{f.cliente.telefono || '—'}</p>
        {f.cliente.representante && <p className="truncate text-xs text-ink-muted">Rep. {f.cliente.representante.nombre}</p>}
        {f.cliente.negocio && <p className="truncate text-xs text-ink-muted">{f.cliente.negocio}</p>}
      </div>
    )
  },
  { id: 'deuda', header: 'Capital pendiente', accessorFn: (f) => f.deuda, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.deuda) },
  { id: 'uso', header: 'Uso del límite', accessorFn: (f) => f.uso, cell: ({ row: { original: f } }) => <div className="w-44 max-w-full"><LimitMeter deuda={f.deuda} label={`Uso del límite de ${f.cliente.nombre}`} /></div> }
];

function TarjetaCliente({ f }: { f: FilaCliente }) {
  return (
    <Link to={`/clientes/${f.cliente.id}`} className="block space-y-3 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-center gap-3">
        <Avatar nombre={f.cliente.nombre} tipo={f.cliente.tipo} size="lg" />
        <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{f.cliente.nombre}</p><p className="num text-xs text-ink-muted">{f.cliente.tipo} · {f.cliente.doc}</p></div>
      </div>
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs text-ink-muted">Capital pendiente</p><p className="num font-semibold text-ink">{money(f.deuda)}</p></div><div className="w-36"><LimitMeter deuda={f.deuda} label={`Uso del límite de ${f.cliente.nombre}`} /></div></div>
    </Link>
  );
}

export default function ClientsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const cargando = useSimulatedLoading(260);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'todos' | TipoCliente>('todos');
  const [registrar, setRegistrar] = useState(false);
  const filas = useMemo(() => filasClientes(db), [db]);

  const datos = useMemo(() => (tipo === 'todos' ? filas : filas.filter((f) => f.cliente.tipo === tipo)), [filas, tipo]);
  const hayFiltros = !!q || tipo !== 'todos';
  const limpiar = () => { setQ(''); setTipo('todos'); };

  return (
    <>
      <PageHeader title="Clientes" description="Consulta expedientes y registra personas naturales o jurídicas sin duplicados."
        actions={<Button variant="primary" onClick={() => setRegistrar(true)}><Plus className="size-4" />Registrar cliente</Button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-sm"><Input type="search" aria-label="Buscar clientes" placeholder="Buscar por nombre, DNI, RUC o representante" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented aria-label="Tipo de cliente" value={tipo} onValueChange={setTipo} options={[{ value: 'todos', label: 'Todos' }, { value: 'DNI', label: 'DNI' }, { value: 'RUC 10', label: 'RUC 10' }, { value: 'RUC 20', label: 'RUC 20' }]} />
      </div>

      <Card className="overflow-hidden">
        <DataTable data={datos} columns={columnas} getRowId={(f) => f.cliente.id} busqueda={q} cargando={cargando}
          textoBusqueda={(f) => [f.cliente.nombre, f.cliente.doc, f.cliente.id, f.cliente.representante?.nombre ?? '', f.cliente.negocio ?? '', f.cliente.telefono].join(' ')}
          ordenInicial={[{ id: 'nombre', desc: false }]} alAbrir={(f) => navigate(`/clientes/${f.cliente.id}`)} tarjeta={(f) => <TarjetaCliente f={f} />}
          etiqueta="Listado de clientes" unidad="clientes"
          vacio={hayFiltros
            ? <EmptyState icon={SearchX} title="Sin resultados" description="Prueba con otro nombre o documento, o quita algún filtro." action={<Button onClick={limpiar}>Limpiar filtros</Button>} />
            : <EmptyState icon={Users} title="Aún no hay clientes" description="Registra al primer cliente para comenzar." action={<Button variant="primary" onClick={() => setRegistrar(true)}>Registrar cliente</Button>} />} />
      </Card>
      <ClientFormSheet open={registrar} onOpenChange={setRegistrar} />
    </>
  );
}
