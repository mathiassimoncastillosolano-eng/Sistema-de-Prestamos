import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, SearchX, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { listarClientes, type ClienteListado } from '@/services/clientes-api';
import type { TipoCliente } from '@/types';
import { ClientFormSheet } from './client-form-sheet';

const TONO_TIPO: Record<TipoCliente, 'teal' | 'navy' | 'neutral'> = {
  DNI: 'neutral',
  'RUC 10': 'teal',
  'RUC 20': 'navy'
};

const columnas: ColumnDef<ClienteListado>[] = [
  {
    accessorKey: 'nombre',
    header: 'Cliente / razón social',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={row.original.nombre} tipo={row.original.tipoDocumento} />
        <Link to={`/clientes/${row.original.id}`} className="truncate font-medium text-ink hover:text-teal-ink hover:underline">{row.original.nombre}</Link>
      </div>
    )
  },
  {
    id: 'documento',
    header: 'Documento',
    accessorFn: (cliente) => cliente.numeroDocumento,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge tone={TONO_TIPO[row.original.tipoDocumento]}>{row.original.tipoDocumento}</Badge>
        <span className="num text-ink">{row.original.numeroDocumento}</span>
      </div>
    )
  },
  {
    accessorKey: 'telefono',
    header: 'Teléfono',
    cell: ({ row }) => row.original.telefono || '—'
  },
  {
    accessorKey: 'correo',
    header: 'Correo',
    cell: ({ row }) => row.original.correo
      ? <span className="block max-w-[16rem] truncate" title={row.original.correo}>{row.original.correo}</span>
      : '—'
  },
  {
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ row }) => <StatusBadge estado={row.original.estado} />
  },
  {
    id: 'detalle',
    header: 'Detalle',
    enableSorting: false,
    cell: ({ row }) => (
      <Button asChild size="sm" variant="secondary">
        <Link to={`/clientes/${row.original.id}`}>Ver detalle</Link>
      </Button>
    )
  }
];

function TarjetaCliente({ cliente }: { cliente: ClienteListado }) {
  return (
    <Link to={`/clientes/${cliente.id}`} className="flex items-center gap-3 p-4">
      <Avatar nombre={cliente.nombre} tipo={cliente.tipoDocumento} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{cliente.nombre}</p>
        <p className="num text-xs text-ink-muted">{cliente.tipoDocumento} · {cliente.numeroDocumento}</p>
        <p className="num text-xs text-ink-muted">{cliente.telefono || 'Sin teléfono'}</p>
        <p className="truncate text-xs text-ink-muted">{cliente.correo || 'Sin correo'}</p>
        <StatusBadge estado={cliente.estado} className="mt-1" />
        <p className="mt-1 text-xs font-medium text-teal-ink">Ver detalle</p>
      </div>
    </Link>
  );
}

export default function ClientsPage() {
  const [clientes, setClientes] = useState<ClienteListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'todos' | TipoCliente>('todos');
  const [registrar, setRegistrar] = useState(false);

  useEffect(() => {
    let activo = true;
    listarClientes()
      .then((datos) => { if (activo) setClientes(datos); })
      .catch((fallo: unknown) => {
        if (activo) setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los clientes.');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);

  const datos = useMemo(
    () => tipo === 'todos' ? clientes : clientes.filter((cliente) => cliente.tipoDocumento === tipo),
    [clientes, tipo]
  );
  const hayFiltros = !!q || tipo !== 'todos';
  const limpiar = () => { setQ(''); setTipo('todos'); };
  const reintentar = () => { setError(null); setCargando(true); setIntento((valor) => valor + 1); };

  return (
    <>
      <PageHeader title="Clientes" description="Consulta los clientes registrados en la base de datos." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-sm">
          <Input type="search" aria-label="Buscar clientes" placeholder="Buscar por nombre o documento" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented aria-label="Tipo de cliente" value={tipo} onValueChange={setTipo} options={[{ value: 'todos', label: 'Todos' }, { value: 'DNI', label: 'DNI' }, { value: 'RUC 10', label: 'RUC 10' }, { value: 'RUC 20', label: 'RUC 20' }]} />
        <Button className="lg:ml-auto" onClick={() => setRegistrar(true)}><Plus className="size-4" />Registrar cliente</Button>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <div className="space-y-3 p-5" role="alert">
            <p>{error}</p>
            <Button onClick={reintentar}>Reintentar</Button>
          </div>
        ) : (
          <DataTable
            data={datos}
            columns={columnas}
            getRowId={(cliente) => cliente.id}
            busqueda={q}
            cargando={cargando}
            textoBusqueda={(cliente) => `${cliente.nombre} ${cliente.numeroDocumento}`}
            ordenInicial={[{ id: 'nombre', desc: false }]}
            tarjeta={(cliente) => <TarjetaCliente cliente={cliente} />}
            etiqueta="Listado de clientes"
            unidad="clientes"
            vacio={hayFiltros
              ? <EmptyState icon={SearchX} title="Sin resultados" description="Prueba con otro nombre o documento, o quita algún filtro." action={<Button onClick={limpiar}>Limpiar filtros</Button>} />
              : <EmptyState icon={Users} title="Aún no hay clientes" description="No hay clientes registrados en la base de datos." />}
          />
        )}
      </Card>
      <ClientFormSheet open={registrar} onOpenChange={setRegistrar} />
    </>
  );
}
