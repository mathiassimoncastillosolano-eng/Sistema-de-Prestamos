import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, CalendarDays, Check, Percent, Search, Send, TriangleAlert, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { InfoFact, InfoPanel } from '@/components/data-display/info-fact';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input, Textarea } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Modal } from '@/components/ui/modal';
import { Stepper } from '@/components/ui/stepper';
import { toast } from '@/components/ui/toast';
import { useUsuario } from '@/hooks/use-auth';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { DUR, EASE } from '@/lib/motion';
import { cn, normalizar } from '@/lib/utils';
import { codigoPrestamo } from './loan-utils';
import { listarClientes, type ClienteListado } from '@/services/clientes-api';
import { detalleLimite, prestamosApi, PrestamoApiError, type CondicionesApi } from '@/services/prestamos-api';
import { ClienteCard } from './client-card';
import { BotonPdfSimulacion, ResumenFinanciero, ScheduleReviewModal } from './schedule-review';
import { aFilas } from './loan-utils';
import { ScheduleTable } from './schedule-table';
import { SimulationSummary } from './simulation-summary';
import { useSimulacion } from './use-simulacion';

/* Las reglas (mínimo, límite, plazos, TEA) llegan del servidor en GET /api/prestamos/condiciones; el servidor las vuelve a validar. */
const MAX_CAPITAL_ENTRADA = 999999; // 6 cifras
const MAX_PLAZO_ENTRADA = 999;      // 3 cifras
const MAX_OBSERVACIONES = 250;

const crearEsquema = (c: CondicionesApi | null) => z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente.'),
  capital: z
    .number({ error: 'Ingresa un monto válido.' })
    .min(c?.capitalMinimo ?? 0.01, `El monto mínimo es ${money(c?.capitalMinimo ?? 0.01)}.`)
    .max(c?.limiteEndeudamiento ?? MAX_CAPITAL_ENTRADA, `El monto no puede superar ${money(c?.limiteEndeudamiento ?? MAX_CAPITAL_ENTRADA)} (límite por cliente).`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'El monto admite como máximo 2 decimales.'),
  plazo: z
    .number({ error: 'Ingresa el plazo en meses.' })
    .int('El plazo debe ser un número entero de meses.')
    .min(c?.plazoMinimoMeses ?? 1, `El plazo mínimo es ${c?.plazoMinimoMeses ?? 1} mes${(c?.plazoMinimoMeses ?? 1) === 1 ? '' : 'es'}.`)
    .max(c?.plazoMaximoMeses ?? MAX_PLAZO_ENTRADA, `El plazo máximo es ${c?.plazoMaximoMeses ?? MAX_PLAZO_ENTRADA} meses.`),
  observaciones: z.string().max(MAX_OBSERVACIONES, `Máximo ${MAX_OBSERVACIONES} caracteres.`)
});
type SolicitudForm = z.infer<ReturnType<typeof crearEsquema>>;

const PASOS = [
  { titulo: 'Cliente', descripcion: 'Quién solicita' },
  { titulo: 'Condiciones', descripcion: 'Monto y plazo' },
  { titulo: 'Confirmación', descripcion: 'Revisar y registrar' }
];

/** Dato de la cuadrícula de confirmación. */
function Dato({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className={cn('num mt-0.5 truncate text-ink', fuerte ? 'text-lg font-semibold' : 'text-sm font-medium')} title={v}>{v}</dd>
    </div>
  );
}

export default function RequestPage() {
  const { clienteId: param } = useParams();
  const usuario = useUsuario();
  const navigate = useNavigate();

  const [paso, setPaso] = useState(1);
  const [q, setQ] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<PrestamoApiError | null>(null);
  const [verCronograma, setVerCronograma] = useState(false);
  const enviando = useRef(false); // bloquea el doble envío aunque el estado aún no se haya repintado

  const [cond, setCond] = useState<CondicionesApi | null>(null);
  const [errorCond, setErrorCond] = useState<string | null>(null);
  const [intentoCond, setIntentoCond] = useState(0);
  const esquema = useMemo(() => crearEsquema(cond), [cond]);
  const resolver = useMemo(() => zodResolver(esquema), [esquema]);

  const [clientes, setClientes] = useState<ClienteListado[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const preseleccionado = useRef(false);

  const form = useForm<SolicitudForm>({
    resolver,
    defaultValues: { clienteId: '', capital: 0, plazo: 0, observaciones: '' },
    mode: 'all'
  });
  const { register, control, setValue, trigger, watch, formState: { errors, isDirty } } = form;
  const valores = watch();

  useEffect(() => {
    let vigente = true;
    setCargandoClientes(true);
    setErrorClientes(null);
    listarClientes()
      .then((l) => { if (vigente) setClientes(l); })
      .catch((e: unknown) => { if (vigente) setErrorClientes(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.'); })
      .finally(() => { if (vigente) setCargandoClientes(false); });
    return () => { vigente = false; };
  }, [intento]);

  useEffect(() => {
    let vigente = true;
    setErrorCond(null);
    prestamosApi.condiciones()
      .then((c) => { if (vigente) setCond(c); })
      .catch((e: unknown) => { if (vigente) setErrorCond(e instanceof Error ? e.message : 'No se pudieron cargar las condiciones del préstamo.'); });
    return () => { vigente = false; };
  }, [intentoCond]);

  /* /solicitud/:clienteId → preselecciona ese cliente y salta a las condiciones. */
  useEffect(() => {
    if (preseleccionado.current || !param || clientes.length === 0) return;
    if (clientes.some((c) => c.id === param)) {
      preseleccionado.current = true;
      setValue('clienteId', param, { shouldValidate: true });
      setPaso(2);
    }
  }, [clientes, param, setValue]);

  const cliente = clientes.find((c) => c.id === valores.clienteId) ?? null;

  const lista = useMemo(() => {
    const nq = normalizar(q);
    return clientes
      .filter((c) => !nq || normalizar(`${c.nombre} ${c.numeroDocumento}`).includes(nq))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, q]);

  const capitalNum = Number.isFinite(valores.capital) ? valores.capital : 0;
  const plazoNum = Number.isFinite(valores.plazo) ? valores.plazo : 0;
  const condicionesValidas = !!cond && esquema.safeParse(valores).success;
  const { sim, estado: estadoSim, error: errorSim, recalcular } = useSimulacion(capitalNum, plazoNum, condicionesValidas);
  const simVigente = estadoSim === 'lista' && !!sim && sim.capital === capitalNum && sim.plazoMeses === plazoNum;
  const desembolso = sim?.fechaDesembolso ?? cond?.fechaDesembolso ?? '';
  const primerVencimiento = sim?.fechaPrimerVencimiento ?? cond?.fechaPrimerVencimiento ?? '';
  const extras = { asesor: usuario.nombre, agencia: usuario.agencia?.nombre };
  const filasSim = useMemo(() => (sim ? aFilas(sim.cuotas) : []), [sim]);

  const elegir = (id: string) => {
    setErrorServidor(null);
    setValue('clienteId', id, { shouldValidate: true, shouldDirty: true });
  };

  const siguiente = async () => {
    if (paso === 1) { if (await trigger('clienteId')) setPaso(2); return; }
    if (paso === 2) { if (await trigger(['capital', 'plazo', 'observaciones'])) { setErrorServidor(null); setPaso(3); } }
  };

  const enviar = async () => {
    if (enviando.current) return; // evita envíos duplicados
    if (!simVigente || !sim || !esquema.safeParse(valores).success) { setConfirmar(false); if (!condicionesValidas) { setPaso(2); void trigger(); } return; }
    enviando.current = true;
    setGuardando(true);
    setErrorServidor(null);
    try {
      const p = await prestamosApi.registrar({
        clienteId: valores.clienteId,
        capital: valores.capital,
        plazoMeses: valores.plazo,
        observaciones: valores.observaciones.trim() || undefined,
        // Lo que el asesor revisó: si el servidor calcula otra cosa (p. ej. cambió el día), rechaza y se vuelve a revisar.
        fechaDesembolsoEsperada: sim.fechaDesembolso,
        totalContractualEsperado: sim.totalContractual
      });
      toast.success(`Préstamo ${codigoPrestamo(p.numero)} registrado con su cronograma`);
      navigate(`/prestamos/${p.id}`); // el bloqueo se mantiene hasta salir de la página
    } catch (e) {
      enviando.current = false;
      setGuardando(false);
      setConfirmar(false);
      const err = e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo registrar el préstamo. Inténtalo nuevamente.');
      setErrorServidor(err);
      if (err.codigo === 'CONDICIONES_DESACTUALIZADAS') recalcular(); // vuelve a mostrar el cronograma vigente para revisarlo
    }
  };

  const cancelar = () => (isDirty || paso > 1 ? setDescartar(true) : navigate('/prestamos'));
  const limite = detalleLimite(errorServidor);

  /** Acciones del flujo. En la confirmación quedan fijas al borde inferior para no perderlas con un cronograma largo. */
  const acciones = (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between', paso === 3 ? 'sticky bottom-3 z-10 mt-4 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur' : 'mt-6 border-t border-line pt-5')}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
        {paso === 3 && simVigente && sim && <BotonPdfSimulacion sim={sim} cliente={cliente} extras={extras} />}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {paso > 1 && <Button onClick={() => setPaso(paso - 1)}>Atrás</Button>}
        {paso < 3
          ? <Button variant="primary" onClick={siguiente} disabled={(paso === 1 && !valores.clienteId) || (paso === 2 && !simVigente)}>Continuar</Button>
          : <Button variant="primary" onClick={() => setConfirmar(true)} disabled={!simVigente || !valores.clienteId || guardando}><Send className="size-4" />Registrar préstamo</Button>}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Registrar préstamo" description="Elige al cliente, define el monto y el plazo, y registra el préstamo con su cronograma. El sistema valida el límite de endeudamiento por cliente." />
      <div className="mb-6"><Stepper pasos={PASOS} actual={paso} onIr={(n) => { if (n < paso) setPaso(n); }} /></div>

      <div className={cn('grid gap-5', paso === 2 && 'xl:grid-cols-[minmax(0,1fr)_21.5rem] xl:items-start')}>
      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={paso} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: DUR.base, ease: EASE }}>
            <Card className={paso === 3 ? 'border-0 bg-transparent shadow-none' : undefined}>
              <CardBody className={paso === 3 ? 'p-0' : undefined}>
                {paso === 1 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-ink">Selecciona al cliente</h2>
                        <p className="mt-0.5 text-sm text-ink-muted">Elige un cliente ya registrado para continuar con las condiciones del préstamo.</p>
                      </div>
                      <Button asChild size="sm"><Link to="/clientes">Ir a clientes</Link></Button>
                    </div>
                    <div className="mt-4">
                      <Input type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre, DNI o RUC" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>

                    {cargandoClientes && <p role="status" className="py-8 text-center text-sm text-ink-muted">Cargando clientes…</p>}
                    {!cargandoClientes && errorClientes && (
                      <EmptyState icon={TriangleAlert} title="No se pudieron cargar los clientes" description={errorClientes} className="py-8"
                        action={<Button variant="primary" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />
                    )}
                    {!cargandoClientes && !errorClientes && (
                      <div role="group" aria-label="Clientes" className="mt-3 max-h-[min(34rem,60vh)] space-y-1.5 overflow-y-auto pr-1">
                        {lista.length === 0 && <EmptyState icon={Search} title="Sin coincidencias" description="Busca por nombre o documento, o registra primero al cliente en la sección Clientes." className="py-8" />}
                        {lista.map((c) => {
                          const sel = valores.clienteId === c.id;
                          return (
                            <button key={c.id} type="button" aria-pressed={sel} onClick={() => elegir(c.id)}
                              className={cn('flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors', sel ? 'border-teal bg-teal-soft' : 'border-line hover:bg-surface-2')}>
                              <Avatar nombre={c.nombre} tipo={c.tipoDocumento} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">{c.nombre}</span>
                                <span className="num block truncate text-xs text-ink-muted">{c.tipoDocumento} {c.numeroDocumento}</span>
                              </span>
                              {c.telefono && <span className="num hidden shrink-0 text-sm text-ink-muted sm:block">{c.telefono}</span>}
                              {sel && <Check className="size-5 shrink-0 text-teal-ink" aria-hidden />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.clienteId && <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">{errors.clienteId.message}</p>}
                    {cliente && (
                      <p className="mt-4 rounded-control bg-success-soft p-3 text-sm text-success-ink">
                        Cliente seleccionado: <b className="font-semibold">{cliente.nombre}</b>. {cond ? <>El límite de endeudamiento de {money(cond.limiteEndeudamiento)} se evalúa al registrar</> : 'El límite de endeudamiento se evalúa al registrar'}, sumando los préstamos activos del cliente en toda la empresa.
                      </p>
                    )}
                  </>
                )}

                {paso === 2 && (
                  <>
                    <h2 className="text-lg font-semibold text-ink">Condiciones del préstamo</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">Define el importe y el plazo. El cronograma se calcula en el servidor con las condiciones vigentes.</p>
                    {!cond && !errorCond && <p role="status" className="py-8 text-center text-sm text-ink-muted">Cargando condiciones…</p>}
                    {!cond && errorCond && (
                      <EmptyState icon={TriangleAlert} title="No se pudieron cargar las condiciones" description={errorCond} className="py-8"
                        action={<Button variant="primary" onClick={() => setIntentoCond((n) => n + 1)}>Reintentar</Button>} />
                    )}
                    {cliente && <ClienteCard cliente={cliente} className="mt-4" />}
                    {cond && (
                    <div className="mt-5 space-y-5">
                      <FormSection title="Importe y plazo">
                        <Controller name="capital" control={control} render={({ field }) => (
                          <Field label="Monto solicitado" error={errors.capital?.message} hint={`Mínimo ${money(cond.capitalMinimo)}. Límite acumulado por cliente: ${money(cond.limiteEndeudamiento)}`}>
                            <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(typeof v === 'number' && v > MAX_CAPITAL_ENTRADA ? MAX_CAPITAL_ENTRADA : v)} onBlur={field.onBlur} decimals={2} maxIntegerDigits={6} prefix="S/" placeholder="0.00" />
                          </Field>
                        )} />
                        <Controller name="plazo" control={control} render={({ field }) => (
                          <Field label={`Plazo (${cond.plazoMinimoMeses}–${cond.plazoMaximoMeses} meses)`} error={errors.plazo?.message} hint="Cuotas mensuales iguales">
                            <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(typeof v === 'number' && v > MAX_PLAZO_ENTRADA ? MAX_PLAZO_ENTRADA : v)} onBlur={field.onBlur} maxIntegerDigits={3} suffix="meses" placeholder="0" />
                          </Field>
                        )} />
                      </FormSection>
                      <FormSection title="Fechas">
                        <div className="sm:col-span-2">
                          <InfoPanel aria-label="Fechas del préstamo">
                            <InfoFact icon={CalendarDays} label="Fecha de desembolso" value={fecha(desembolso)} helper="Fecha actual · Lima, Perú" />
                            <InfoFact icon={CalendarClock} label="Primera cuota" value={fecha(primerVencimiento)} helper="Vencimiento de la cuota 1" />
                          </InfoPanel>
                        </div>
                      </FormSection>
                      <FormSection title="Condiciones y responsable">
                        <div className="sm:col-span-2">
                          <InfoPanel aria-label="Condiciones y responsable">
                            <InfoFact icon={Percent} label="Tasa efectiva anual" value={`${(cond.tea * 100).toFixed(0)} %`} helper="Fijada por política de crédito" />
                            <InfoFact icon={UserRound} label="Asesor responsable" value={usuario.nombre} helper="Usuario en sesión" />
                          </InfoPanel>
                        </div>
                      </FormSection>
                      <Field label="Observaciones" optional error={errors.observaciones?.message}>
                        <Textarea rows={3} maxLength={MAX_OBSERVACIONES} className="min-h-[5.5rem] max-h-56" placeholder="Información adicional" {...register('observaciones')} />
                      </Field>
                      <p className="mt-1 text-right text-xs text-ink-muted">{valores.observaciones.length}/{MAX_OBSERVACIONES}</p>
                    </div>
                    )}
                  </>
                )}

                {paso === 3 && (
                  <>
                    <div>
                      <h2 className="text-lg font-semibold text-ink">Revisión y confirmación</h2>
                      <p className="mt-0.5 text-sm text-ink-muted">Verifica los datos antes de registrar el préstamo.</p>
                    </div>

                    {errorServidor && (
                      <div role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">
                        <p className="font-medium">{errorServidor.codigo === 'LIMITE_EXCEDIDO' ? 'Se supera el límite de endeudamiento' : errorServidor.codigo === 'CONDICIONES_DESACTUALIZADAS' ? 'Las condiciones cambiaron' : 'No se pudo registrar el préstamo'}</p>
                        {limite ? (
                          <dl className="num mt-2 grid max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                            <dt>Acumulado actual</dt><dd className="text-right font-semibold">{money(limite.acumulado)}</dd>
                            <dt>Límite</dt><dd className="text-right font-semibold">{money(limite.limite)}</dd>
                            <dt>Excedente</dt><dd className="text-right font-semibold">{money(limite.excedente)}</dd>
                          </dl>
                        ) : (
                          <p className="mt-1">{errorServidor.message}</p>
                        )}
                        <p className="mt-2 text-[0.8125rem]">
                          {limite ? 'Reduce el monto en el paso anterior para continuar.' : errorServidor.codigo === 'CONDICIONES_DESACTUALIZADAS' ? 'Revisa el cronograma actualizado y confirma de nuevo.' : 'Revisa los datos o inténtalo nuevamente.'}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 space-y-4">
                      {/* 1 · Cliente */}
                      {cliente && <ClienteCard cliente={cliente} variante="destacada" />}

                      {/* 2 · Condiciones del préstamo */}
                      <Card aria-label="Condiciones del préstamo">
                        <CardHeader title="Condiciones del préstamo" as="h3" />
                        <CardBody>
                          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Dato k="Capital solicitado" v={money(capitalNum)} fuerte />
                            <Dato k="Plazo" v={`${plazoNum} meses`} fuerte />
                            <Dato k="Tasa aplicada" v={cond ? `TEA ${(cond.tea * 100).toFixed(0)} %` : '—'} fuerte />
                          </dl>
                          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Dato k="Moneda" v={cond?.moneda === 'PEN' ? 'Soles (PEN)' : (cond?.moneda ?? '—')} />
                            <Dato k="Frecuencia de cuotas" v="Mensual" />
                            <Dato k="Asesor responsable" v={usuario.nombre} />
                            <Dato k="Fecha de desembolso" v={desembolso ? fecha(desembolso) : '—'} />
                            <Dato k="Primera fecha de vencimiento" v={primerVencimiento ? fecha(primerVencimiento) : '—'} />
                            {valores.observaciones.trim() && <Dato k="Observaciones" v={valores.observaciones.trim()} />}
                          </dl>
                        </CardBody>
                      </Card>

                      {/* 3 · Resumen financiero */}
                      {simVigente && sim && <ResumenFinanciero sim={sim} />}

                      {/* 4 · Detalle de cuotas */}
                      <Card aria-label="Detalle de cuotas" className="overflow-hidden">
                        <CardHeader title="Detalle de cuotas" as="h3" description="Cronograma de amortización. El PDF incluye todas las cuotas, no solo la página visible."
                          action={sim ? <Badge tone="neutral" className="num">{sim.plazoMeses} cuotas</Badge> : undefined} className="pb-3" />
                        {simVigente && sim && (
                          <ScheduleTable filas={filasSim} totales={{ capital: sim.capital, intereses: sim.totalIntereses, total: sim.totalContractual }} etiqueta="Cronograma de cuotas a registrar" />
                        )}
                        {estadoSim === 'cargando' && <p role="status" className="px-5 pb-5 text-center text-sm text-ink-muted">Calculando cronograma…</p>}
                        {estadoSim === 'error' && (
                          <div role="alert" className="mx-5 mb-5 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">
                            <p>{errorSim?.message ?? 'No se pudo calcular el cronograma.'}</p>
                            <button type="button" onClick={recalcular} className="mt-1 font-medium underline">Reintentar</button>
                          </div>
                        )}
                      </Card>
                    </div>
                  </>
                )}

                {/* 5 · Acciones */}
                {acciones}
              </CardBody>
            </Card>
          </motion.div>
        
        </AnimatePresence>
      </div>
      {paso === 2 && cond && (
          <motion.div key="resumen" className="min-w-0 xl:sticky xl:top-24" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
            <SimulationSummary
              sim={simVigente ? sim : null}
              estado={estadoSim}
              tea={cond.tea}
              errorMensaje={errorSim?.message}
              ayuda="Ingresa un monto y un plazo válidos para ver la estimación y el cronograma."
              onVerCronograma={() => setVerCronograma(true)}
              onReintentar={recalcular}
            />
          </motion.div>
        )}
        </div>

      <ScheduleReviewModal open={verCronograma} onOpenChange={setVerCronograma} sim={simVigente ? sim : null} cliente={cliente} extras={extras} />

      <Modal open={confirmar} onOpenChange={(o) => { if (!guardando) setConfirmar(o); }} size="sm" title="Registrar préstamo"
        description={`Vas a registrar un préstamo de ${money(capitalNum)} a ${plazoNum} meses para ${cliente?.nombre ?? ''}. Se guardará junto con su cronograma de cuotas.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)} disabled={guardando}>Cancelar</Button><Button variant="primary" loading={guardando} onClick={enviar}>Registrar</Button></>} />

      <Modal open={descartar} onOpenChange={setDescartar} size="sm" title="¿Descartar el registro?" description="Se perderán los datos ingresados. No se ha registrado ningún préstamo."
        footer={<><Button variant="secondary" onClick={() => setDescartar(false)}>Seguir editando</Button><Button variant="danger" onClick={() => navigate('/prestamos')}>Descartar</Button></>} />
    </>
  );
}