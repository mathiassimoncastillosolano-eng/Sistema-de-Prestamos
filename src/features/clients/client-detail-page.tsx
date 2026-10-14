import { FilePlus2, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DataTable } from '@/components/data-display/data-table';
import { DefinitionList } from '@/components/data-display/definition-list';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TabsNav } from '@/components/ui/tabs';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { fecha } from '@/lib/dates';
import { r2 } from '@/lib/finance';
import { money } from '@/lib/format';
import { deudaCliente, estadoCliente, filasPrestamos, getCliente } from '@/lib/selectors';
import { Landmark } from 'lucide-react';
import { TarjetaPrestamo, columnasPrestamo } from '@/features/loans/loan-columns';

const columnas = columnasPrestamo({ mostrarCliente: false });
type Tab = 'prestamos' | 'datos';

export default function ClientDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('prestamos');
  const c = getCliente(db, id);
  const prestamos = useMemo(() => filasPrestamos(db).filter((f) => f.prestamo.clienteId === id), [db, id]);

  if (!c) return <EmptyState icon={SearchX} title="Cliente no encontrado" description="Vuelve al listado y busca de nuevo." action={<Button asChild variant="primary"><Link to="/clientes">Ver clientes</Link></Button>} />;

  const deuda = deudaCliente(db, c.id);
  const pendiente = r2(prestamos.reduce((a, f) => a + f.resumen.pendiente, 0));
  const disponible = Math.max(0, r2(CFG.limite - deuda));
  const esEmpresa = c.tipo === 'RUC 20';

  const datos = [
    { label: 'Tipo de cliente', value: c.tipo }, { label: 'Documento', value: c.doc },
    ...(esEmpresa ? [{ label: 'Razón social', value: c.nombre }, { label: 'Domicilio fiscal', value: c.domicilio ?? '—' }] : []),
    ...(c.tipo === 'RUC 10' ? [{ label: 'Titular', value: c.nombre }, { label: 'DNI del titular', value: c.dniTitular ?? '—' }, { label: 'Negocio', value: c.negocio ?? '—' }] : []),
    { label: 'Agencia de registro', value: c.agencia }, { label: 'Asesor responsable', value: c.asesor }, { label: 'Fecha de alta', value: fecha(c.alta) }, { label: 'Celular', value: c.telefono || '—' }
  ];

  return (
    <>
      <PageHeader back={{ to: '/clientes', label: 'Clientes' }} title={c.nombre} description={`${c.tipo} · ${c.doc} · ${c.agencia} · Asesor ${c.asesor}`}
        actions={<Button variant="primary" onClick={() => navigate(`/solicitud/${c.id}`)}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center gap-4">
          <Avatar nombre={c.nombre} tipo={c.tipo} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={esEmpresa ? 'copper' : c.tipo === 'RUC 10' ? 'teal' : 'neutral'}>{c.tipo}</Badge><StatusBadge estado={estadoCliente(db, c)} /></div>
            {c.representante && <p className="mt-2 text-sm text-ink-muted">Representante legal: <b className="font-medium text-ink">{c.representante.nombre}</b> · DNI {c.representante.dni}</p>}
            {c.negocio && <p className="mt-2 text-sm text-ink-muted">Negocio: <b className="font-medium text-ink">{c.negocio}</b></p>}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3">
        <div className="bg-surface p-5"><p className="text-[0.8125rem] text-ink-muted">Capital pendiente</p><p className="mt-1 text-xl font-semibold text-ink"><AnimatedNumber value={deuda} format={money} duration={0.5} /></p><p className="mt-1 text-xs text-ink-muted">Base del límite de endeudamiento</p></div>
        <div className="bg-surface p-5"><p className="text-[0.8125rem] text-ink-muted">Importe contractual pendiente</p><p className="mt-1 text-xl font-semibold text-ink"><AnimatedNumber value={pendiente} format={money} duration={0.5} /></p><p className="mt-1 text-xs text-ink-muted">Capital + intereses pactados, según cronograma</p></div>
        <div className="bg-surface p-5"><p className="text-[0.8125rem] text-ink-muted">Capacidad disponible</p><p className="mt-1 text-xl font-semibold text-ink"><AnimatedNumber value={disponible} format={money} duration={0.5} /></p>
          <div className="mt-2"><LimitMeter deuda={deuda} showText={false} label="Uso del límite" /></div><p className="mt-1.5 text-xs text-ink-muted">{Math.round((deuda / CFG.limite) * 100)} % del límite de {money(CFG.limite)} (toda la empresa)</p></div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <TabsNav<Tab> aria-label="Secciones del expediente" value={tab} onValueChange={setTab}
          items={[{ value: 'prestamos', label: `Préstamos · ${prestamos.length}` }, { value: 'datos', label: 'Datos' }]}
          panels={{
            prestamos: <DataTable data={prestamos} columns={columnas} getRowId={(f) => f.prestamo.id} textoBusqueda={() => ''} ordenInicial={[{ id: 'desembolso', desc: true }]} alAbrir={(f) => navigate(`/prestamos/${f.prestamo.id}`)}
              tarjeta={(f) => <TarjetaPrestamo f={f} mostrarCliente={false} />} etiqueta="Préstamos del cliente" unidad="préstamos" vacio={<EmptyState icon={Landmark} title="Sin préstamos" description="Este cliente aún no tiene préstamos." action={<Button variant="primary" onClick={() => navigate(`/solicitud/${c.id}`)}>Crear solicitud</Button>} />} />,
            datos: <div className="px-5 py-2"><DefinitionList items={datos} /></div>
          }} />
      </Card>
    </>
  );
}
