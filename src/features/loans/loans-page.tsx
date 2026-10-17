import { FilePlus2, Landmark, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/data-display/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useUsuario } from '@/hooks/use-auth';
import { useDb } from '@/hooks/use-db';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { filasPrestamos } from '@/lib/selectors';
import { TarjetaPrestamo, columnasPrestamo } from './loan-columns';

const columnas = columnasPrestamo();

export default function LoansPage() {
  const db = useDb();
  const usuario = useUsuario();
  const navigate = useNavigate();
  const cargando = useSimulatedLoading(260);
  const [q, setQ] = useState('');
  const [solo, setSolo] = useState(false);

  const todas = useMemo(() => filasPrestamos(db), [db]);
  const base = useMemo(() => (solo ? todas.filter((f) => f.prestamo.asesor === usuario.nombre) : todas), [todas, solo, usuario.nombre]);
  const hayFiltros = !!q || solo;

  return (
    <>
      <PageHeader title="Préstamos" description="Cartera completa de la empresa. Filtra, ordena y abre el detalle de cada operación."
        actions={<Button variant="primary" onClick={() => navigate('/solicitud')}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-sm"><Input type="search" aria-label="Buscar préstamos" placeholder="Buscar por código, cliente o documento" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} className="size-4 accent-[var(--teal)]" />Solo mis préstamos
        </label>
      </div>

      <Card className="overflow-hidden">
        <DataTable data={base} columns={columnas} getRowId={(f) => f.prestamo.id} busqueda={q} cargando={cargando}
          textoBusqueda={(f) => [f.prestamo.id, f.cliente?.nombre ?? '', f.cliente?.doc ?? ''].join(' ')}
          ordenInicial={[{ id: 'desembolso', desc: true }]} alAbrir={(f) => navigate(`/prestamos/${f.prestamo.id}`)} tarjeta={(f) => <TarjetaPrestamo f={f} />}
          etiqueta="Listado de préstamos" unidad="préstamos"
          vacio={hayFiltros
            ? <EmptyState icon={SearchX} title="No hay préstamos con estos filtros" description="Quita algún filtro o cambia la búsqueda." action={<Button onClick={() => { setQ(''); setSolo(false); }}>Limpiar filtros</Button>} />
            : <EmptyState icon={Landmark} title="Aún no hay préstamos" description="Crea la primera solicitud para generar un cronograma." action={<Button variant="primary" onClick={() => navigate('/solicitud')}>Nueva solicitud</Button>} />} />
      </Card>
    </>
  );
}
