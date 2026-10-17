import { motion } from 'motion/react';
import { ArrowUpRight, CalendarClock, CircleAlert, FilePlus2, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { ChartTooltip } from '@/components/data-display/chart-tooltip';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { Trend } from '@/components/data-display/trend';
import { ModuleLink } from '@/components/layout/module-link';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, useIdentidad, useUsuario } from '@/hooks/use-auth';
import { useDb } from '@/hooks/use-db';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { PERIODOS, alcancesPara, calcularDashboard, type Alcance } from '@/lib/analytics';
import { CFG } from '@/lib/config';
import { diasEntre, fecha, fechaLarga, mesCorto, mesLargo, mesNombre } from '@/lib/dates';
import { entero, money, moneyCompacto } from '@/lib/format';
import { fadeUp, stagger } from '@/lib/motion';
import { rutaDeActividad } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import { ClientFormSheet } from '@/features/clients/client-form-sheet';

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaHora = (t: string) => `${fecha(t.slice(0, 10))} · ${t.slice(11)}`;

const COLOR_ESTADO: Record<string, string> = { Vigente: 'var(--success)', 'En mora': 'var(--danger)', Cancelado: 'var(--neutral)' };

/** Resumen textual de un gráfico para lectores de pantalla. */
const Figura = ({ etiqueta, resumen, children, className }: { etiqueta: string; resumen: string; children: ReactNode; className?: string }) => (
  <figure aria-label={etiqueta} className={className}>
    <figcaption className="sr-only">{resumen}</figcaption>
    <div aria-hidden>{children}</div>
  </figure>
);

/** `principal`: métricas financieras centrales (mayor presencia). El resto son indicadores operativos, más compactos. */
function Stat({ label, valor, pie, tono, principal, className }: { label: string; valor: ReactNode; pie?: ReactNode; tono?: 'danger'; principal?: boolean; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={cn('flex min-w-0 flex-col gap-1 bg-surface p-4', principal ? 'max-sm:col-span-2 sm:p-5' : 'sm:p-4', className)}>
      <p className="text-[0.8125rem] font-medium text-ink-muted">{label}</p>
      <p className={cn('num truncate font-semibold text-ink', principal ? 'text-[1.625rem] leading-8' : 'text-lg leading-7', tono === 'danger' && 'text-danger-ink')}>{valor}</p>
      <div className="min-h-5 text-xs text-ink-muted">{pie}</div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const db = useDb();
  const usuario = useUsuario();
  const yo = useIdentidad();
  const { puede } = useAuth();
  const navigate = useNavigate();
  const cargando = useSimulatedLoading(240);
  const alcances = useMemo(() => alcancesPara(usuario.rol, usuario.agencia?.nombre ?? null), [usuario.rol, usuario.agencia?.nombre]);
  const [alcance, setAlcance] = useState<Alcance>(() => alcances[0]?.value ?? 'empresa');
  const [meses, setMeses] = useState<number>(6);
  const [registrar, setRegistrar] = useState(false);
  const d = useMemo(() => calcularDashboard(db, alcance, meses, yo), [db, alcance, meses, yo]);
  const alcanceLabel = alcances.find((a) => a.value === alcance)?.label ?? '';
  const mesPrev = mesNombre(d.mesPrevio);

  if (cargando) {
    return (
      <div className="space-y-5" role="status" aria-label="Cargando dashboard">
        <Skeleton className="h-10 w-72" /><Skeleton className="h-28" />
        <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0"><Skeleton className="h-[26rem] lg:col-span-8" /><Skeleton className="h-[26rem] lg:col-span-4" /></div>
      </div>
    );
  }

  const totalEstados = d.estados.reduce((a, e) => a + e.cantidad, 0);
  const resumenCapital = d.serie.map((p) => `${mesCorto(p.mes)} ${money(p.capitalPendiente)}`).join(', ');

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp}>
        <PageHeader
          title={`Hola, ${usuario.nombre.split(' ')[0]}`}
          description={
            <>
              <span>{capitalizar(fechaLarga(CFG.hoy))}</span>. En <b className="font-medium text-ink">{alcanceLabel.toLowerCase()}</b> hay{' '}
              <b className="font-medium text-ink">{d.vencidas.length}</b> cuota{d.vencidas.length === 1 ? '' : 's'} vencida{d.vencidas.length === 1 ? '' : 's'} y{' '}
              <b className="font-medium text-ink">{d.clientesCercaLimite.length}</b> cliente{d.clientesCercaLimite.length === 1 ? '' : 's'} cerca del límite de endeudamiento.
            </>
          }
          actions={
            (puede('solicitud') || puede('clientes')) ? (
              <>
                {puede('solicitud') && <Button variant="primary" onClick={() => navigate('/solicitud')}><FilePlus2 className="size-4" />Nueva solicitud</Button>}
                {puede('clientes') && <Button onClick={() => setRegistrar(true)}><Plus className="size-4" />Registrar cliente</Button>}
              </>
            ) : undefined
          }
        />
        <div role="group" aria-label="Filtros del dashboard" className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2.5">
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <span className="shrink-0 text-[0.8125rem] font-medium text-ink-muted">Cartera</span>
            <Select aria-label="Alcance de los indicadores" value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)} className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              {alcances.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <span className="shrink-0 text-[0.8125rem] font-medium text-ink-muted">Período</span>
            <Select aria-label="Periodo de los gráficos" value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              {PERIODOS.map((p) => <option key={p} value={p}>Últimos {p} meses</option>)}
            </Select>
          </label>
        </div>
      </motion.div>

      {/* Banda de indicadores: líneas finas en lugar de tarjetas idénticas */}
      <motion.div variants={stagger(0.04)} className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1.3fr))_repeat(3,minmax(0,1fr))]">
        <Stat principal label="Total desembolsado" valor={<AnimatedNumber value={d.totalDesembolsado} format={money} />}
          pie={<span className="flex flex-wrap items-center gap-1.5"><span className="num">Este mes: {money(d.desembolsadoMes)}</span><Trend valor={d.variacionDesembolsos} /></span>} />
        <Stat principal label="Capital pendiente" valor={<AnimatedNumber value={d.capitalPendiente} format={money} />}
          pie={<span className="flex flex-wrap items-center gap-1.5"><Trend valor={d.variacionCapital} modo="neutral" />{d.variacionCapital !== null && <span>vs. cierre de {mesPrev}</span>}</span>} />
        <Stat principal label="Cuotas vencidas" tono={d.vencidas.length ? 'danger' : undefined} valor={<AnimatedNumber value={d.vencidas.length} format={entero} />} pie={d.vencidas.length ? `${money(d.montoVencido)} en cuotas programadas` : 'Sin cuotas vencidas'} />
        <Stat label="Préstamos activos" valor={<AnimatedNumber value={d.prestamosActivos} format={entero} />} pie={`${d.prestamosTotales} en total · ${d.prestamosCancelados} cancelados`} />
        <Stat label="Clientes registrados" valor={<AnimatedNumber value={d.clientes} format={entero} />} pie={d.clientesNuevosMes ? `${d.clientesNuevosMes} nuevo${d.clientesNuevosMes === 1 ? '' : 's'} este mes` : alcanceLabel} />
        <Stat className="max-sm:col-span-2" label={`Vencen en ${CFG.diasProxVenc} días`} valor={<AnimatedNumber value={d.proximasVentana.cantidad} format={entero} />} pie={d.proximasVentana.cantidad ? `${money(d.proximasVentana.monto)} en cuotas programadas` : 'Sin vencimientos cercanos'} />
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <motion.div variants={fadeUp} className="lg:col-span-7 xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Evolución del capital pendiente" description="Capital de las cuotas sin cobertura histórica, sin intereses futuros" />
            <CardBody className="pt-3">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="text-3xl font-semibold text-ink sm:text-4xl"><AnimatedNumber value={d.capitalPendiente} format={money} duration={0.9} /></p>
                <div className="flex items-center gap-2 pb-1 text-[0.8125rem] text-ink-muted">
                  <Trend valor={d.variacionCapital} modo="neutral" />
                  {d.variacionCapital !== null && <span>vs. cierre de {mesPrev} ({money(d.capitalPendientePrevio)})</span>}
                </div>
              </div>
              <Figura etiqueta="Evolución del capital pendiente" resumen={`Capital pendiente al cierre de cada mes: ${resumenCapital}.`} className="mt-5">
                <ResponsiveContainer width="100%" height={224}>
                  <AreaChart data={d.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="mes" tickFormatter={mesCorto} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} tickMargin={8} interval="preserveStartEnd" />
                    <YAxis tickFormatter={moneyCompacto} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTooltip etiqueta={(l) => mesLargo(String(l))} />} />
                    <Area type="monotone" dataKey="capitalPendiente" name="Capital pendiente" stroke="var(--chart-1)" strokeWidth={2.5} fill="var(--chart-1)" fillOpacity={0.12} dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--chart-1)', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Figura>
              <p className="mt-2 text-xs text-ink-muted">Cierre de cada mes; el último punto es el capital pendiente a hoy ({fecha(CFG.hoy)}).</p>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="lg:col-span-5 xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Estado de la cartera" description={`${totalEstados} préstamos · ${alcanceLabel}`} />
            <CardBody>
              {totalEstados === 0 ? (
                <EmptyState icon={ShieldCheck} title="Sin préstamos" description="No hay préstamos en este alcance." />
              ) : (
                <>
                  <Figura etiqueta="Distribución de la cartera por estado" resumen={d.estados.map((e) => `${e.estado}: ${e.cantidad} préstamos`).join('; ')} className="relative mx-auto h-48 w-48">
                    <ResponsiveContainer width="100%" height={192}>
                      <PieChart>
                        <Pie data={d.estados} dataKey="cantidad" nameKey="estado" innerRadius={62} outerRadius={88} paddingAngle={d.estados.filter((e) => e.cantidad).length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
                          {d.estados.map((e) => <Cell key={e.estado} fill={COLOR_ESTADO[e.estado]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div><p className="num text-3xl font-semibold text-ink">{totalEstados}</p><p className="text-xs text-ink-muted">préstamos</p></div>
                    </div>
                  </Figura>
                  <ul className="mt-5 space-y-2.5">
                    {d.estados.map((e) => (
                      <li key={e.estado} className="flex items-center gap-3 text-sm">
                        <i aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[e.estado] }} />
                        <span className="min-w-0 flex-1 text-ink-muted">{e.estado}</span>
                        <span className="num font-semibold text-ink">{e.cantidad}</span>
                        <span className="num w-24 shrink-0 text-right text-xs text-ink-muted">{e.estado === 'Cancelado' ? '—' : money(e.capital)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <motion.div variants={fadeUp} className="lg:col-span-6 xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Préstamos registrados por mes" description={`Capital registrado, últimos ${meses} meses (S/)`} />
            <CardBody className="pt-3">
              <Figura etiqueta="Capital registrado por mes" resumen={d.serie.map((p) => `${mesCorto(p.mes)}: ${money(p.desembolsos)}`).join('. ')}>
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={d.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="mes" tickFormatter={mesCorto} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} tickMargin={8} />
                    <YAxis tickFormatter={moneyCompacto} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--ink-muted)', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip etiqueta={(l) => mesLargo(String(l))} />} />
                    <Bar dataKey="desembolsos" name="Capital registrado" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </Figura>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
                <span>El mes en curso está incompleto.</span>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="lg:col-span-6 xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Atención prioritaria" description="Cuotas vencidas, de la más antigua a la más reciente"
              action={d.vencidas.length ? <span className="num rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger-ink">{d.vencidas.length}</span> : undefined} />
            <CardBody className="pt-2">
              {d.vencidas.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="Sin cuotas vencidas" description="No hay cuotas vencidas en este alcance." className="py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.vencidas.slice(0, 5).map((o) => (
                    <li key={`${o.prestamo.id}-${o.cuota.n}`}>
                      <ModuleLink modulo="prestamos" to={`/prestamos/${o.prestamo.id}`} className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2" planoClassName="-mx-2 flex items-center gap-3 px-2 py-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger-soft text-danger-ink"><CircleAlert className="size-4" aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{o.cliente?.nombre ?? o.prestamo.clienteId}</span>
                          <span className="block truncate text-xs text-ink-muted">{o.prestamo.id} · cuota {o.cuota.n} · {diasEntre(CFG.hoy, o.cuota.fecha)} días de atraso</span>
                        </span>
                        <span className="num text-sm font-semibold text-ink">{money(o.importe)}</span>
                      </ModuleLink>
                    </li>
                  ))}
                </ul>
              )}
              {d.vencidas.length > 5 && puede('prestamos') && <Button asChild variant="link" className="mt-3 text-sm"><Link to="/prestamos">Ver préstamos con cuotas vencidas<ArrowUpRight className="size-4" /></Link></Button>}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Próximos vencimientos" />
            <CardBody className="pt-2">
              {d.proximas.length === 0 ? <EmptyState icon={CalendarClock} title="Sin vencimientos" description="No hay cuotas por vencer." className="py-8" /> : (
                <ul className="divide-y divide-line">
                  {d.proximas.map((o) => (
                    <li key={`${o.prestamo.id}-${o.cuota.n}`}>
                      <ModuleLink modulo="prestamos" to={`/prestamos/${o.prestamo.id}`} className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2" planoClassName="-mx-2 flex items-center gap-3 px-2 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{o.cliente?.nombre ?? o.prestamo.clienteId}</span>
                          <span className="block truncate text-xs text-ink-muted">{fecha(o.cuota.fecha)} · {o.prestamo.id} · cuota {o.cuota.n}</span>
                        </span>
                        <span className="num text-sm font-semibold text-ink">{money(o.importe)}</span>
                      </ModuleLink>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Clientes cerca del límite" description={`Más del ${CFG.alertaLimite * 100} % de ${money(CFG.limite)} (toda la empresa)`} />
            <CardBody className="pt-2">
              {d.clientesCercaLimite.length === 0 ? <EmptyState icon={ShieldCheck} title="Sin alertas" description={`Ningún cliente supera el ${CFG.alertaLimite * 100} % del límite.`} className="py-8" /> : (
                <ul className="space-y-4 pt-1">
                  {d.clientesCercaLimite.slice(0, 5).map((x) => (
                    <li key={x.cliente.id}>
                      <ModuleLink modulo="clientes" to={`/clientes/${x.cliente.id}`} className="block rounded-control transition-colors hover:text-teal-ink">
                        <span className="mb-1.5 flex items-baseline justify-between gap-3"><span className="truncate text-sm font-medium text-ink">{x.cliente.nombre}</span><span className="num shrink-0 text-xs text-ink-muted">{money(x.deuda)}</span></span>
                        <LimitMeter deuda={x.deuda} label={x.cliente.nombre} showText={false} />
                      </ModuleLink>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full">
            <CardHeader title="Actividad reciente" />
            <CardBody className="pt-3">
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1.5 before:w-px before:bg-line">
                {db.actividad.slice(0, 5).map((a, i) => (
                  <li key={`${a.t}-${i}`} className="relative pl-5">
                    <i aria-hidden className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface bg-teal" />
                    <p className="text-sm text-ink"><b className="font-medium">{a.tipo}</b> · {a.desc}</p>
                    <p className="text-xs text-ink-muted">
                      {fechaHora(a.t)} · {a.usuario}
                      {a.ref && puede(a.ref.entidad === 'cliente' ? 'clientes' : 'prestamos') && <> · <Link to={rutaDeActividad(a.ref)} className="font-medium text-teal-ink underline-offset-4 hover:underline">Ver</Link></>}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {puede('clientes') && <ClientFormSheet open={registrar} onOpenChange={setRegistrar} />}
    </motion.div>
  );
}
