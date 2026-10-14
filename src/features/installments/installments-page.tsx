import type { ColumnDef } from '@tanstack/react-table';
import { CalendarX2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useDb } from '@/hooks/use-db';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { AGENCIAS, CFG } from '@/lib/config';
import { addDays, diasEntre, fecha } from '@/lib/dates';
import { cuotaAbierta } from '@/lib/finance';
import { money } from '@/lib/format';
import { filasCuotas, type FilaCuota } from '@/lib/selectors';

type FiltroEstado = '' | 'abiertas' | FilaCuota['estado'];
type FiltroPeriodo = '' | 'mes' | '30' | '90';


const periodoCumple = (periodo: FiltroPeriodo, f: string) => {
  if (periodo === '') return true;
  if (periodo === 'mes') return f.slice(0, 7) === CFG.hoy.slice(0, 7);
  const dias = periodo === '30' ? 30 : 90;
  return f >= CFG.hoy && f <= addDays(CFG.hoy, dias);
};

const diasTexto = (f: FilaCuota) => {
  if (!cuotaAbierta(f.cuota)) return '—';
  const d = diasEntre(f.cuota.fecha, CFG.hoy);
  return d < 0 ? `${-d} d de atraso` : d === 0 ? 'Hoy' : `En ${d} d`;
};

const columnas: ColumnDef<FilaCuota>[] = [
  { id: 'prestamo', header: 'Préstamo', accessorFn: (f) => f.prestamo.id, cell: ({ row: { original: f } }) => <Link to={`/prestamos/${f.prestamo.id}`} className="num font-medium text-teal-ink hover:underline">{f.prestamo.id}</Link> },
  { id: 'cliente', header: 'Cliente', accessorFn: (f) => f.cliente?.nombre ?? '', cell: ({ row: { original: f } }) => <div className="min-w-0"><p className="truncate font-medium text-ink">{f.cliente?.nombre ?? f.prestamo.clienteId}</p><p className="truncate text-xs text-ink-muted">{f.prestamo.agencia}</p></div> },
  { id: 'n', header: 'Cuota', accessorFn: (f) => f.cuota.n, cell: ({ row: { original: f } }) => <span className="num whitespace-nowrap">{f.cuota.n} de {f.prestamo.plazo}</span> },
  { id: 'fecha', header: 'Vence', accessorFn: (f) => f.cuota.fecha, cell: ({ row: { original: f } }) => <span className="whitespace-nowrap">{fecha(f.cuota.fecha)}</span> },
  { id: 'capital', header: 'Capital', accessorFn: (f) => f.cuota.capital, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.cuota.capital) },
  { id: 'interes', header: 'Interés', accessorFn: (f) => f.cuota.interes, meta: { derecha: true }, cell: ({ row: { original: f } }) => money(f.cuota.interes) },
  { id: 'importe', header: 'Importe', accessorFn: (f) => f.cuota.cuota, meta: { derecha: true }, cell: ({ row: { original: f } }) => <b className="font-semibold text-ink">{money(f.cuota.cuota)}</b> },
  { id: 'dias', header: 'Plazo', enableSorting: false, accessorFn: (f) => diasTexto(f), cell: ({ row: { original: f } }) => <span className="whitespace-nowrap text-ink-muted">{diasTexto(f)}</span> },
  { id: 'estado', header: 'Estado', accessorFn: (f) => f.estado, cell: ({ row: { original: f } }) => <StatusBadge estado={f.estado} /> }
];

function TarjetaCuota({ f }: { f: FilaCuota }) {
  return (
    <Link to={`/prestamos/${f.prestamo.id}`} className="block space-y-2 p-4 transition-colors active:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{f.cliente?.nombre ?? f.prestamo.clienteId}</p><p className="num text-xs text-ink-muted">{f.prestamo.id} · cuota {f.cuota.n} de {f.prestamo.plazo}</p></div>
        <StatusBadge estado={f.estado} />
      </div>
      <div className="flex items-baseline justify-between text-sm"><span className="text-ink-muted">Vence {fecha(f.cuota.fecha)} · {diasTexto(f)}</span><b className="num font-semibold text-ink">{money(f.cuota.cuota)}</b></div>
    </Link>
  );
}

/** Consulta de cuotas de toda la cartera. Es una vista informativa: no hay acciones de cobro ni de cambio de estado. */
export default function InstallmentsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const cargando = useSimulatedLoading(260);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('abiertas');
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('');
  const [agencia, setAgencia] = useState('');

  const todas = useMemo(() => filasCuotas(db), [db]);
  const filtradas = useMemo(
    () => todas.filter((f) =>
      (estado === '' ? true : estado === 'abiertas' ? cuotaAbierta(f.cuota) : f.estado === estado) &&
      (agencia === '' || f.prestamo.agencia === agencia) &&
      periodoCumple(periodo, f.cuota.fecha)),
    [todas, estado, agencia, periodo]
  );
  const hayFiltros = !!q || estado !== 'abiertas' || !!periodo || !!agencia;
  const limpiar = () => { setQ(''); setEstado('abiertas'); setPeriodo(''); setAgencia(''); };

  return (
    <>
      <PageHeader title="Cuotas y cronogramas" description="Consulta de cuotas programadas de toda la cartera. Es informativa: el sistema no registra pagos. Abre un préstamo para ver su cronograma completo." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <Input type="search" aria-label="Buscar por préstamo, cliente o documento" placeholder="Préstamo, cliente o documento" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Estado de la cuota" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
          <option value="abiertas">Abiertas</option>
          <option value="">Todas</option>
          <option value="Vencida">Vencidas</option>
          <option value="Próxima a vencer">Próximas a vencer</option>
          <option value="Pendiente">Pendientes</option>
          <option value="Cubierta (histórico)">Cubiertas (histórico)</option>
        </Select>
        <Select aria-label="Periodo de vencimiento" value={periodo} onChange={(e) => setPeriodo(e.target.value as FiltroPeriodo)}>
          <option value="">Cualquier vencimiento</option>
          <option value="mes">Vencen este mes</option>
          <option value="30">Próximos 30 días</option>
          <option value="90">Próximos 90 días</option>
        </Select>
        <Select aria-label="Agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)}>
          <option value="">Todas las agencias</option>
          {AGENCIAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <DataTable data={filtradas} columns={columnas} getRowId={(f) => `${f.prestamo.id}-${f.cuota.n}`} busqueda={q} cargando={cargando} tamanoPagina={10}
          textoBusqueda={(f) => [f.prestamo.id, f.cliente?.nombre ?? '', f.cliente?.doc ?? ''].join(' ')}
          ordenInicial={[{ id: 'fecha', desc: false }]} alAbrir={(f) => navigate(`/prestamos/${f.prestamo.id}`)} tarjeta={(f) => <TarjetaCuota f={f} />}
          etiqueta="Cuotas programadas" unidad="cuotas"
          vacio={<EmptyState icon={CalendarX2} title="No hay cuotas con estos filtros" description="Cambia el estado, el periodo o la agencia, o limpia la búsqueda." action={hayFiltros ? <Button onClick={limpiar}>Restablecer filtros</Button> : undefined} />} />
      </Card>
    </>
  );
}
