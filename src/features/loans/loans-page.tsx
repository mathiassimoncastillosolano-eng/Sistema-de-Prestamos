import { FilePlus2, Landmark, Search, SearchX, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PrestamoApiError, prestamosApi, type EstadoPrestamoApi, type PrestamoListadoApi } from '@/services/prestamos-api';
import { VisorContratoPrestamo } from './loan-actions';
import { TarjetaPrestamo, columnasPrestamo, textoBusquedaPrestamo } from './loan-columns';
import { ESTADOS_PRESTAMO } from './loan-utils';
import { useAccionesPrestamo } from './use-contrato';

type FiltroEstado = 'todos' | EstadoPrestamoApi;

/**
 * Listado de préstamos con datos reales (GET /api/prestamos). Estados y saldos los calcula el servidor; los contadores salen de
 * esos mismos datos. «Solo mis préstamos» filtra por `propio` (el asesor del préstamo es la persona en sesión).
 */
export default function LoansPage() {
  const navigate = useNavigate();
  const acciones = useAccionesPrestamo();
  const columnas = useMemo(() => columnasPrestamo(acciones), [acciones.ocupado]); // eslint-disable-line react-hooks/exhaustive-deps
  const [datos, setDatos] = useState<PrestamoListadoApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [q, setQ] = useState('');
  const [solo, setSolo] = useState(false);
  const [estado, setEstado] = useState<FiltroEstado>('todos');

  useEffect(() => {
    let vigente = true;
    setError(null);
    setDatos(null);
    prestamosApi.listar()
      .then((l) => { if (vigente) setDatos(l); })
      .catch((e: unknown) => { if (vigente) setError(e instanceof PrestamoApiError ? e.message : 'No se pudo cargar el listado de préstamos.'); });
    return () => { vigente = false; };
  }, [intento]);

  const base = useMemo(() => (solo ? (datos ?? []).filter((p) => p.propio) : (datos ?? [])), [datos, solo]);
  const hayFiltros = !!q || solo || estado !== 'todos';
  const filtros = useMemo(() => (estado === 'todos' ? [] : [{ id: 'estado', value: estado }]), [estado]);
  const opciones = useMemo(() => [
    { value: 'todos' as const, label: <>Todos <span className="num ml-1 text-xs opacity-70">{base.length}</span></> },
    ...ESTADOS_PRESTAMO.map((e) => ({ value: e, label: <>{e} <span className="num ml-1 text-xs opacity-70">{base.filter((p) => p.estado === e).length}</span></> }))
  ], [base]);

  return (
    <>
      <PageHeader title="Préstamos" description="Préstamos registrados dentro de tu alcance. Filtra por estado, busca por código, cliente o documento y abre el detalle de cada uno."
        actions={<Button variant="primary" onClick={() => navigate('/solicitud')}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-sm"><Input type="search" aria-label="Buscar préstamos" placeholder="Buscar por código, cliente o documento" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Checkbox checked={solo} onChange={(e) => setSolo(e.target.checked)}>Solo mis préstamos</Checkbox>
      </div>
      <div className="mb-4">
        <Segmented aria-label="Filtrar por estado" size="sm" value={estado} onValueChange={setEstado} options={opciones} className="sm:w-full" />
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <EmptyState icon={TriangleAlert} title="No se pudo cargar el listado" description={error} action={<Button variant="primary" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />
        ) : (
          <DataTable data={base} columns={columnas} getRowId={(p) => p.id} busqueda={q} filtros={filtros} tamanoPagina={10} cargando={datos === null}
            textoBusqueda={textoBusquedaPrestamo}
            ordenInicial={[{ id: 'codigo', desc: true }]} alAbrir={(p) => navigate(`/prestamos/${p.id}`)} tarjeta={(p) => <TarjetaPrestamo p={p} acciones={acciones} />}
            etiqueta="Listado de préstamos" unidad="préstamos"
            vacio={hayFiltros
              ? <EmptyState icon={SearchX} title="No hay préstamos con estos filtros" description="Quita algún filtro o cambia la búsqueda." action={<Button onClick={() => { setQ(''); setSolo(false); setEstado('todos'); }}>Limpiar filtros</Button>} />
              : <EmptyState icon={Landmark} title="Aún no hay préstamos" description="Registra el primer préstamo para generar su cronograma." action={<Button variant="primary" onClick={() => navigate('/solicitud')}>Nueva solicitud</Button>} />} />
        )}
      </Card>
      <VisorContratoPrestamo acciones={acciones} />
    </>
  );
}
