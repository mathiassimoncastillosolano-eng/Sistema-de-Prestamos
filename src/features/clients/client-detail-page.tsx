import { CalendarDays, FilePlus2, Hash, Landmark, MapPin, Phone, SearchX, UserRound, Store, UsersRound } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DataTable } from '@/components/data-display/data-table';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Meter } from '@/components/ui/meter';
import { PageHeader } from '@/components/layout/page-header';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { fecha } from '@/lib/dates';
import { r2 } from '@/lib/finance';
import { money } from '@/lib/format';
import { deudaCliente, filasPrestamos, getCliente } from '@/lib/selectors';
import { TarjetaPrestamo, columnasPrestamo } from '@/features/loans/loan-columns';

const columnas = columnasPrestamo({ mostrarCliente: false });

/** Dato de la ficha: etiqueta pequeña + valor. Si no hay valor se muestra «No registrado» de forma discreta. */
function Dato({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value?: ReactNode; className?: string }) {
  const vacio = value === undefined || value === null || value === '';
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs text-ink-muted"><Icon className="size-3.5" aria-hidden />{label}</dt>
      <dd className={vacio ? 'mt-0.5 text-sm text-ink-muted' : 'num mt-0.5 break-words text-sm font-medium text-ink'}>{vacio ? 'No registrado' : value}</dd>
    </div>
  );
}

function Indicador({ label, children, pie }: { label: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="flex flex-col bg-surface p-5">
      <p className="text-[0.8125rem] text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{children}</p>
      <div className="mt-auto pt-2 text-xs text-ink-muted">{pie}</div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const c = getCliente(db, id);
  const prestamos = useMemo(() => filasPrestamos(db).filter((f) => f.prestamo.clienteId === id), [db, id]);

  if (!c) return <EmptyState icon={SearchX} title="Cliente no encontrado" description="Vuelve al listado y busca de nuevo." action={<Button asChild variant="primary"><Link to="/clientes">Ver clientes</Link></Button>} />;

  const deuda = deudaCliente(db, c.id);
  const pendiente = r2(prestamos.reduce((a, f) => a + f.resumen.pendiente, 0));
  const totalContractual = r2(prestamos.reduce((a, f) => a + f.resumen.total, 0));
  const cubierto = r2(prestamos.reduce((a, f) => a + f.resumen.cubierto, 0));
  const desembolsado = r2(prestamos.reduce((a, f) => a + f.prestamo.capital, 0));
  const ultimoDesembolso = prestamos.reduce<string | null>((m, f) => (m === null || f.prestamo.desembolso > m ? f.prestamo.desembolso : m), null);
  const conSaldo = prestamos.filter((f) => f.resumen.pendiente > 0.005).length;
  const disponible = Math.max(0, r2(CFG.limite - deuda));
  const esEmpresa = c.tipo === 'RUC 20';
  const esNegocio = c.tipo === 'RUC 10';
  const usoCubierto = totalContractual > 0 ? (cubierto / totalContractual) * 100 : 0;
  const nuevaSolicitud = () => navigate(`/solicitud/${c.id}`);

  return (
    <>
      <PageHeader back={{ to: '/clientes', label: 'Clientes' }}
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{c.nombre}<Badge tone={esEmpresa ? 'navy' : esNegocio ? 'teal' : 'neutral'}>{c.tipo}</Badge></span>}
        description={<span className="num">{c.id} · {c.tipo} {c.doc} · {c.agencia} · Asesor {c.asesor}</span>}
        actions={<Button variant="primary" onClick={nuevaSolicitud}><FilePlus2 className="size-4" />Nueva solicitud</Button>} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Ficha de identificación */}
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-4 border-b border-line p-5">
            <Avatar nombre={c.nombre} tipo={c.tipo} size="xl" />
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">{esEmpresa ? 'Razón social' : esNegocio ? 'Titular' : 'Nombre completo'}</p>
              <h2 className="break-words text-base font-semibold leading-snug text-ink">{c.nombre}</h2>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5">
            <Dato icon={Hash} label="Documento" value={`${c.tipo} ${c.doc}`} />
            <Dato icon={Hash} label="Código de cliente" value={c.id} />
            <Dato icon={Phone} label="Celular" value={c.telefono} />
            <Dato icon={CalendarDays} label="Fecha de registro" value={fecha(c.alta)} />
            <Dato icon={Landmark} label="Agencia" value={c.agencia} />
            <Dato icon={UserRound} label="Asesor asignado" value={c.asesor} />
            {esEmpresa && <Dato icon={MapPin} label="Domicilio fiscal" value={c.domicilio} className="col-span-2" />}
            {esEmpresa && c.representante && <Dato icon={UsersRound} label="Representante legal" value={`${c.representante.nombre} · DNI ${c.representante.dni}`} className="col-span-2" />}
            {esNegocio && <Dato icon={Hash} label="DNI del titular" value={c.dniTitular} />}
            {esNegocio && <Dato icon={Store} label="Negocio" value={c.negocio} className={c.dniTitular ? undefined : 'col-span-2'} />}
          </dl>
        </Card>

        {/* Resumen financiero y actividad crediticia */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3">
            <Indicador label="Capital pendiente" pie="Base del límite de endeudamiento">
              <AnimatedNumber value={deuda} format={money} duration={0.5} />
            </Indicador>
            <Indicador label="Importe contractual pendiente"
              pie={totalContractual > 0
                ? <><Meter value={usoCubierto} tone="brand" label={`Cubierto del total contractual: ${Math.round(usoCubierto)} %`} /><p className="mt-1.5">Capital + intereses pactados · total {money(totalContractual)}</p></>
                : 'Capital + intereses pactados, según cronograma'}>
              <AnimatedNumber value={pendiente} format={money} duration={0.5} />
            </Indicador>
            <Indicador label="Capacidad disponible"
              pie={<><LimitMeter deuda={deuda} showText={false} label="Uso del límite" /><p className="mt-1.5">{Math.round((deuda / CFG.limite) * 100)} % de {money(CFG.limite)} (límite por cliente, toda la empresa)</p></>}>
              <AnimatedNumber value={disponible} format={money} duration={0.5} />
            </Indicador>
          </div>

          <Card>
            <CardHeader as="h2" title="Actividad crediticia" description="Resumen calculado desde los préstamos registrados del cliente" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 sm:grid-cols-4">
              <div><dt className="text-xs text-ink-muted">Préstamos asociados</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{prestamos.length}</dd></div>
              <div><dt className="text-xs text-ink-muted">Con saldo pendiente</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{conSaldo}</dd></div>
              <div><dt className="text-xs text-ink-muted">Capital desembolsado</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{money(desembolsado)}</dd></div>
              <div><dt className="text-xs text-ink-muted">Último desembolso</dt><dd className="num mt-0.5 text-base font-semibold text-ink">{ultimoDesembolso ? fecha(ultimoDesembolso) : '—'}</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader as="h2" title={`Préstamos · ${prestamos.length}`} description="Abre un préstamo para ver su cronograma completo" className="pb-4" />
        <div className="border-t border-line">
          <DataTable data={prestamos} columns={columnas} getRowId={(f) => f.prestamo.id} textoBusqueda={() => ''} ordenInicial={[{ id: 'desembolso', desc: true }]}
            alAbrir={(f) => navigate(`/prestamos/${f.prestamo.id}`)} tarjeta={(f) => <TarjetaPrestamo f={f} mostrarCliente={false} />}
            etiqueta="Préstamos del cliente" unidad="préstamos"
            vacio={<EmptyState icon={Landmark} title="Sin préstamos" description="Este cliente aún no tiene préstamos asociados." action={<Button variant="primary" onClick={nuevaSolicitud}><FilePlus2 className="size-4" />Crear solicitud</Button>} />} />
        </div>
      </Card>
    </>
  );
}
