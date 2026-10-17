import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, CalendarDays, Check, Info, Percent, Search, Send, UserPlus, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { DefinitionList } from '@/components/data-display/definition-list';
import { InfoFact, InfoPanel } from '@/components/data-display/info-fact';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input, Textarea } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Meter } from '@/components/ui/meter';
import { Modal } from '@/components/ui/modal';
import { Stepper } from '@/components/ui/stepper';
import { toast } from '@/components/ui/toast';
import { useIdentidad, useUsuario } from '@/hooks/use-auth';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { addMonths, fecha, hoySistema } from '@/lib/dates';
import { capacidadDisponible, simular, validarSolicitud } from '@/lib/finance';
import { money } from '@/lib/format';
import { DUR, EASE } from '@/lib/motion';
import { deudaCliente, getCliente } from '@/lib/selectors';
import { cn, delay, normalizar } from '@/lib/utils';
import { solicitudSchema, type SolicitudForm } from '@/lib/validation';
import { crearPrestamo } from '@/services/actions';
import { getDb } from '@/services/store';
import { ClientFormSheet } from '@/features/clients/client-form-sheet';
import { ScheduleTable } from './schedule-table';
import { SimulationSummary } from './simulation-summary';

const PASOS = [{ titulo: 'Cliente', descripcion: 'Quién solicita' }, { titulo: 'Condiciones', descripcion: 'Monto y plazo' }, { titulo: 'Revisión', descripcion: 'Simulación y confirmación' }];

export default function RequestPage() {
  const { clienteId: param } = useParams();
  const db = useDb();
  const usuario = useUsuario();
  const yo = useIdentidad();
  const navigate = useNavigate();
  const inicial = param && getCliente(db, param) ? param : '';
  const [paso, setPaso] = useState(inicial ? 2 : 1);
  const [q, setQ] = useState('');
  const [registrar, setRegistrar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /* Fecha PREVISTA de desembolso: la fecha actual del sistema, fijada al abrir la solicitud. No es editable ni está codificada. */
  const [desembolsoPrevisto] = useState(hoySistema);

  const form = useForm<SolicitudForm>({
    resolver: (v, c, o) => zodResolver(solicitudSchema((id) => deudaCliente(getDb(), id)))(v, c, o),
    defaultValues: { clienteId: inicial, monto: 2000, plazo: 12, desembolso: desembolsoPrevisto, observaciones: '' },
    mode: 'onChange'
  });
  const { register, control, setValue, trigger, watch, formState: { errors, isDirty } } = form;
  const valores = watch();

  const cliente = getCliente(db, valores.clienteId);
  const deuda = cliente ? deudaCliente(db, cliente.id) : 0;
  const validacion = validarSolicitud({ ...valores, deudaActual: deuda });
  const sim = simular(valores);
  const montoNum = Number.isFinite(valores.monto) ? valores.monto : 0;
  const uso = ((deuda + montoNum) / CFG.limite) * 100;

  const lista = useMemo(() => {
    const nq = normalizar(q);
    return db.clientes.filter((c) => !nq || normalizar(`${c.nombre} ${c.doc} ${c.id}`).includes(nq)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [db.clientes, q]);

  const elegir = (id: string) => {
    setValue('clienteId', id, { shouldValidate: true, shouldDirty: true });
  };
  const fallos = cliente ? validacion.checks.filter((k) => !k.ok) : [];
  /* La tarjeta lateral solo presenta resultados cuando los datos cumplen las reglas de negocio. */
  const simulacionValida = validacion.ok && !!sim;
  const motivoSimulacion = !Number.isFinite(valores.monto) || !Number.isFinite(valores.plazo) ? 'Ingresa un monto y un plazo válidos para ver la estimación.' : fallos.find((k) => k.campo === 'monto' || k.campo === 'plazo')?.ayuda;
  const primeraCuota = addMonths(valores.desembolso, 1);
  const siguiente = async () => {
    if (paso === 1) { if (await trigger('clienteId')) setPaso(2); return; }
    if (paso === 2) { const ok = await trigger(['monto', 'plazo', 'desembolso']); if (ok && validacion.ok) setPaso(3); }
  };

  const enviarSolicitud = async () => {
    if (guardando) return; // evita envíos duplicados
    setGuardando(true);
    await delay(500);
    const r = crearPrestamo(yo, { clienteId: valores.clienteId, monto: valores.monto, plazo: valores.plazo, desembolso: valores.desembolso, observaciones: valores.observaciones });
    setGuardando(false);
    if (!r.ok) { setConfirmar(false); toast.error(r.error); setPaso(2); void trigger(); return; }
    toast.success(`Solicitud ${r.prestamo.id} registrada en evaluación (demostración)`);
    navigate(`/prestamos/${r.prestamo.id}`);
  };

  const cancelar = () => (isDirty || paso > 1 ? setDescartar(true) : navigate('/prestamos'));

  return (
    <>
      <PageHeader title="Nueva solicitud" description="Evalúa el endeudamiento, simula el cronograma y envía la solicitud a evaluación con las reglas de negocio aplicadas." />
      <div className="mb-6"><Stepper pasos={PASOS} actual={paso} onIr={setPaso} /></div>

      <div className={cn('grid gap-5', paso === 2 && 'xl:grid-cols-[minmax(0,1fr)_21.5rem] xl:items-start')}>
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={paso} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: DUR.base, ease: EASE }}>
              <Card>
                <CardBody>
                  {paso === 1 && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h2 className="text-lg font-semibold text-ink">Selecciona al cliente</h2><p className="mt-0.5 text-sm text-ink-muted">Elige un cliente existente o registra uno nuevo para continuar con las condiciones del préstamo.</p></div>
                        <Button size="sm" onClick={() => setRegistrar(true)}><UserPlus className="size-4" />Registrar cliente nuevo</Button>
                      </div>
                      <div className="mt-4"><Input type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre, DNI o RUC" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} /></div>
                      <div role="group" aria-label="Clientes" className="mt-3 max-h-[min(34rem,60vh)] space-y-1.5 overflow-y-auto pr-1">
                        {lista.length === 0 && <EmptyState icon={Search} title="Sin coincidencias" description="Busca por nombre o documento, o registra un cliente nuevo." className="py-8" />}
                        {lista.map((c) => {
                          const d = deudaCliente(db, c.id);
                          const sel = valores.clienteId === c.id;
                          return (
                            <button key={c.id} type="button" aria-pressed={sel} onClick={() => elegir(c.id)}
                              className={cn('flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors', sel ? 'border-teal bg-teal-soft' : 'border-line hover:bg-surface-2')}>
                              <Avatar nombre={c.nombre} tipo={c.tipo} />
                              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{c.nombre}</span><span className="num block truncate text-xs text-ink-muted">{c.tipo} {c.doc}</span></span>
                              <span className="hidden w-40 shrink-0 truncate text-sm text-ink-muted lg:block">{c.agencia}</span>
                              <span className="hidden w-32 shrink-0 text-right md:block"><span className="num block text-sm text-ink">{money(d)}</span><span className="block text-xs text-ink-muted">capital pendiente</span></span>
                              <span className="hidden w-32 shrink-0 text-right sm:block"><span className="num block text-sm font-medium text-ink">{money(capacidadDisponible(d))}</span><span className="block text-xs text-ink-muted">disponible</span></span>
                              {sel && <Check className="size-5 shrink-0 text-teal-ink" aria-hidden />}
                            </button>
                          );
                        })}
                      </div>
                      {errors.clienteId && <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">{errors.clienteId.message}</p>}
                      {cliente && (
                        <div className="mt-4 rounded-control bg-success-soft p-3 text-sm text-success-ink">
                          El capital pendiente de <b className="font-semibold">{cliente.nombre}</b> es <b className="num font-semibold">{money(deuda)}</b> en todas las agencias. Capacidad disponible: <b className="num font-semibold">{money(capacidadDisponible(deuda))}</b>.
                          <div className="mt-2"><LimitMeter deuda={deuda} showText={false} label="Uso del límite" /></div>
                        </div>
                      )}
                    </>
                  )}

                  {paso === 2 && (
                    <>
                      <h2 className="text-lg font-semibold text-ink">Condiciones del préstamo</h2>
                      <p className="mt-0.5 text-sm text-ink-muted">Define el importe y el plazo; el resumen de la simulación se actualiza mientras escribes.</p>
                      <div className="mt-5 space-y-5">
                        <FormSection title="Importe y plazo">
                          <Controller name="monto" control={control} render={({ field }) => (
                            <Field label="Monto solicitado" error={errors.monto?.message} hint={`Mínimo ${money(CFG.minMonto)}. Disponible: ${money(capacidadDisponible(deuda))}`}>
                              <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} decimals={2} prefix="S/" placeholder="0.00" />
                            </Field>
                          )} />
                          <Controller name="plazo" control={control} render={({ field }) => (
                            <Field label={`Plazo (${CFG.plazoMin}–${CFG.plazoMax} meses)`} error={errors.plazo?.message} hint="Cuotas mensuales iguales">
                              <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} suffix="meses" />
                            </Field>
                          )} />
                        </FormSection>
                        <FormSection title="Fechas">
                          <div className="space-y-2.5 sm:col-span-2">
                            <InfoPanel aria-label="Fechas del préstamo">
                              <InfoFact icon={CalendarDays} label="Desembolso" value={fecha(valores.desembolso)} helper="Fecha actual del sistema" />
                              <InfoFact icon={CalendarClock} label="Primera cuota" value={fecha(primeraCuota)} helper="Calculada automáticamente" />
                            </InfoPanel>
                            <p className="flex items-start gap-1.5 text-[0.8125rem] text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />La primera cuota vence un mes después del desembolso.</p>
                          </div>
                        </FormSection>
                        <FormSection title="Condiciones y responsable">
                          <div className="sm:col-span-2">
                            <InfoPanel aria-label="Condiciones y responsable">
                              <InfoFact icon={Percent} label="Tasa efectiva anual" value={`${(CFG.tea * 100).toFixed(0)} %`} helper="Fijada por política de crédito" />
                              <InfoFact icon={UserRound} label="Asesor responsable" value={usuario.nombre} helper="Usuario en sesión" />
                            </InfoPanel>
                          </div>
                        </FormSection>
                        <Field label="Observaciones" optional><Textarea rows={3} maxLength={400} className="min-h-[5.5rem] max-h-56" placeholder="Información adicional para la evaluación" {...register('observaciones')} /></Field>
                        {fallos.length > 0 && (
                          <div role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger-ink">
                            <p className="font-medium">Revisa estas reglas antes de continuar</p>
                            <ul className="mt-1.5 space-y-1">{fallos.map((k) => <li key={k.label} className="flex items-start gap-2"><X className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{k.label}<span className="block text-[0.8125rem]">{k.ayuda}</span></span></li>)}</ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {paso === 3 && (
                    <>
                      <h2 className="text-lg font-semibold text-ink">Revisión y confirmación</h2>
                      {validacion.ok
                        ? <p className="mt-1 text-sm text-ink-muted">Esta es una simulación: todavía no existe ningún préstamo. Al confirmar se registra una solicitud simulada «En evaluación» con su cronograma proyectado; no hay desembolso real.</p>
                        : <p role="alert" className="mt-2 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">Hay validaciones pendientes. Vuelve al paso anterior para corregirlas.</p>}

                      {cliente && (
                        <div className="mt-4 flex items-center gap-3 rounded-control bg-surface-2 p-3">
                          <Avatar nombre={cliente.nombre} tipo={cliente.tipo} />
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{cliente.nombre}</p><p className="num text-xs text-ink-muted">{cliente.tipo} {cliente.doc} · {cliente.agencia}</p></div>
                        </div>
                      )}

                      <div className="mt-5 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                        <section aria-label="Condiciones de la solicitud">
                          <h3 className="mb-1 text-sm font-semibold text-ink">Condiciones</h3>
                          <DefinitionList items={[
                            { label: 'Capital solicitado', value: money(montoNum) }, { label: 'Tasa aplicada', value: `TEA ${(CFG.tea * 100).toFixed(0)} %` },
                            { label: 'Plazo', value: `${valores.plazo} meses` }, { label: 'Frecuencia de pago', value: 'Mensual' },
                            { label: 'Desembolso previsto', value: fecha(valores.desembolso) }, { label: 'Primer vencimiento', value: sim ? fecha(sim.primera) : '—' }
                          ]} />
                        </section>
                        <section aria-label="Resultado de la simulación">
                          <h3 className="mb-1 text-sm font-semibold text-ink">Resultado de la simulación</h3>
                          <DefinitionList items={[
                            { label: 'Cuota estimada', value: sim ? money(sim.cuota) : '—', strong: true },
                            { label: 'Total de intereses estimados', value: sim ? money(sim.interes) : '—' },
                            { label: 'Total contractual estimado', value: sim ? money(sim.total) : '—', strong: true },
                            { label: 'Capital pendiente actual del cliente', value: money(deuda) }
                          ]} />
                          <div className="mt-3">
                            <div className="mb-1.5 flex justify-between text-[0.8125rem]"><span className="text-ink-muted">Uso del límite tras el préstamo</span><b className="num text-ink">{Math.round(uso)} %</b></div>
                            <Meter value={uso} tone={uso > 100 ? 'danger' : uso >= CFG.alertaLimite * 100 ? 'warning' : 'teal'} label={`Uso del límite tras el préstamo: ${Math.round(uso)} %`} />
                          </div>
                        </section>
                      </div>

                      <ul aria-label="Validaciones de negocio" className="mt-5 space-y-2">
                        {validacion.checks.map((k) => (
                          <li key={k.label} className={cn('flex items-start gap-2 text-[0.8125rem]', k.ok ? 'text-success-ink' : 'text-danger-ink')}>
                            {k.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0" aria-hidden />}
                            <span><span className="sr-only">{k.ok ? 'Cumple: ' : 'No cumple: '}</span>{k.label}{!k.ok && <span className="block text-ink-muted">{k.ayuda}</span>}</span>
                          </li>
                        ))}
                      </ul>

                      {sim && (
                        <section aria-label="Cronograma proyectado" className="mt-6">
                          <h3 className="mb-2 text-sm font-semibold text-ink">Cronograma de cuotas proyectado</h3>
                          <div className="overflow-hidden rounded-control border border-line">
                            <ScheduleTable prestamo={{ cronograma: sim.cronograma, capital: montoNum }} proyectado />
                          </div>
                        </section>
                      )}
                    </>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" onClick={cancelar}>Cancelar solicitud</Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      {paso > 1 && <Button onClick={() => setPaso(paso - 1)}>Atrás</Button>}
                      {paso < 3
                        ? <Button variant="primary" onClick={siguiente} disabled={paso === 1 && !valores.clienteId}>Continuar</Button>
                        : <Button variant="primary" onClick={() => setConfirmar(true)} disabled={!validacion.ok}><Send className="size-4" />Enviar a evaluación</Button>}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
        {paso === 2 && (
          <motion.div key="resumen" className="min-w-0 xl:sticky xl:top-24" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
            <SimulationSummary sim={simulacionValida ? sim : null} monto={montoNum} plazo={valores.plazo} valido={simulacionValida} motivo={motivoSimulacion} />
          </motion.div>
        )}
      </div>

      <ClientFormSheet open={registrar} onOpenChange={setRegistrar} onCreated={(c) => { elegir(c.id); }} />

      <Modal open={confirmar} onOpenChange={(o) => { if (!guardando) setConfirmar(o); }} size="sm" title="Enviar solicitud a evaluación (demostración)"
        description={`Vas a registrar una solicitud de ${money(montoNum)} a ${valores.plazo} meses para ${cliente?.nombre ?? ''} con estado «En evaluación». Es una simulación: no se guarda en ninguna base de datos ni se desembolsa dinero.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)} disabled={guardando}>Cancelar</Button><Button variant="primary" loading={guardando} onClick={enviarSolicitud}>Enviar a evaluación</Button></>} />

      <Modal open={descartar} onOpenChange={setDescartar} size="sm" title="¿Descartar la solicitud?" description="Se perderán los datos ingresados. No se ha registrado ningún préstamo."
        footer={<><Button variant="secondary" onClick={() => setDescartar(false)}>Seguir editando</Button><Button variant="danger" onClick={() => navigate('/prestamos')}>Descartar</Button></>} />
    </>
  );
}
