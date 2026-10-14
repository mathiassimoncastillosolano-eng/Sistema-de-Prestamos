import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Circle, Search, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { DefinitionList } from '@/components/data-display/definition-list';
import { LimitMeter } from '@/components/data-display/limit-meter';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Input, Textarea } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Meter } from '@/components/ui/meter';
import { Modal } from '@/components/ui/modal';
import { Stepper } from '@/components/ui/stepper';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { addMonths, fecha } from '@/lib/dates';
import { capacidadDisponible, simular, validarSolicitud } from '@/lib/finance';
import { money } from '@/lib/format';
import { DUR, EASE } from '@/lib/motion';
import { deudaCliente, getCliente } from '@/lib/selectors';
import { cn, delay, normalizar } from '@/lib/utils';
import { solicitudSchema, type SolicitudForm } from '@/lib/validation';
import { crearPrestamo } from '@/services/actions';
import { getDb } from '@/services/store';
import { ClientFormSheet } from '@/features/clients/client-form-sheet';

const PASOS = [{ titulo: 'Cliente', descripcion: 'Quién solicita' }, { titulo: 'Condiciones', descripcion: 'Monto y plazo' }, { titulo: 'Revisión', descripcion: 'Simulación y confirmación' }];

export default function RequestPage() {
  const { clienteId: param } = useParams();
  const db = useDb();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const inicial = param && getCliente(db, param) ? param : '';
  const [paso, setPaso] = useState(inicial ? 2 : 1);
  const [q, setQ] = useState('');
  const [registrar, setRegistrar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [verCronograma, setVerCronograma] = useState(false);

  const form = useForm<SolicitudForm>({
    resolver: (v, c, o) => zodResolver(solicitudSchema((id) => deudaCliente(getDb(), id)))(v, c, o),
    defaultValues: { clienteId: inicial, monto: 2000, plazo: 12, desembolso: CFG.hoy, observaciones: '' },
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

  const elegir = (id: string) => setValue('clienteId', id, { shouldValidate: true, shouldDirty: true });
  const siguiente = async () => {
    if (paso === 1) { if (await trigger('clienteId')) setPaso(2); return; }
    if (paso === 2) { const ok = await trigger(['monto', 'plazo', 'desembolso']); if (ok && validacion.ok) setPaso(3); }
  };

  const confirmarDesembolso = async () => {
    if (guardando) return; // evita envíos duplicados
    setGuardando(true);
    await delay(500);
    const r = crearPrestamo({ clienteId: valores.clienteId, monto: valores.monto, plazo: valores.plazo, desembolso: valores.desembolso, observaciones: valores.observaciones });
    setGuardando(false);
    if (!r.ok) { setConfirmar(false); toast.error(r.error); setPaso(2); void trigger(); return; }
    toast.success(`Préstamo ${r.prestamo.id} registrado`);
    navigate(`/prestamos/${r.prestamo.id}`);
  };

  const cancelar = () => (isDirty || paso > 1 ? setDescartar(true) : navigate('/prestamos'));

  const resumen = (
    <Card className="lg:sticky lg:top-24">
      <CardBody>
        <h2 className="text-[0.9375rem] font-semibold text-ink">Resumen en tiempo real</h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Simulación de demostración, no es una liquidación definitiva.</p>
        {cliente
          ? <div className="mt-4 flex items-center gap-3"><Avatar nombre={cliente.nombre} tipo={cliente.tipo} /><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{cliente.nombre}</p><p className="num text-xs text-ink-muted">{cliente.tipo} · {cliente.doc}</p></div></div>
          : <p className="mt-4 rounded-control bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">Selecciona un cliente para comenzar.</p>}
        <div className="mt-4 rounded-control bg-surface-2 px-4 py-3">
          <p className="text-[0.8125rem] text-ink-muted">Cuota mensual estimada</p>
          <p className="num mt-0.5 text-2xl font-semibold text-ink">{sim ? money(sim.cuota) : '—'}</p>
          <p className="num mt-0.5 text-[0.8125rem] text-ink-muted">{sim ? `${valores.plazo} cuotas · total ${money(sim.total)}` : 'Completa monto y plazo'}</p>
        </div>
        <DefinitionList compact className="mt-2" items={[
          { label: 'Capital solicitado', value: money(montoNum) }, { label: 'Tasa aplicada', value: `TEA ${(CFG.tea * 100).toFixed(0)} %` },
          { label: 'Intereses estimados', value: sim ? money(sim.interes) : '—' }, { label: 'Total contractual', value: sim ? money(sim.total) : '—' },
          { label: 'Primer vencimiento', value: sim ? fecha(sim.primera) : '—' },
          { label: 'Capital acumulado tras el préstamo', value: money(deuda + montoNum) }
        ]} />
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[0.8125rem]"><span className="text-ink-muted">Uso del límite</span><b className="num text-ink">{Math.round(uso)} %</b></div>
          <Meter value={uso} tone={uso > 100 ? 'danger' : uso >= CFG.alertaLimite * 100 ? 'warning' : 'teal'} label={`Uso del límite tras el préstamo: ${Math.round(uso)} %`} />
        </div>
        <ul className="mt-4 space-y-2">
          {validacion.checks.map((k) => {
            const pendiente = !cliente; // sin cliente aún no se puede evaluar: estado neutro, no error
            return (
              <li key={k.label} className={cn('flex items-start gap-2 text-[0.8125rem]', pendiente ? 'text-ink-muted' : k.ok ? 'text-success-ink' : 'text-danger-ink')}>
                {pendiente ? <Circle className="mt-0.5 size-4 shrink-0" aria-hidden /> : k.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span><span className="sr-only">{pendiente ? 'Pendiente: ' : k.ok ? 'Cumple: ' : 'No cumple: '}</span>{k.label}{!pendiente && !k.ok && <span className="block text-ink-muted">{k.ayuda}</span>}</span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader title="Nueva solicitud" description="Evalúa el endeudamiento, simula el cronograma y desembolsa con las reglas de negocio aplicadas." />
      <div className="mb-6"><Stepper pasos={PASOS} actual={paso} onIr={setPaso} /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={paso} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: DUR.base, ease: EASE }}>
              <Card>
                <CardBody>
                  {paso === 1 && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-ink">Selecciona al cliente</h2>
                        <Button size="sm" onClick={() => setRegistrar(true)}><UserPlus className="size-4" />Registrar cliente nuevo</Button>
                      </div>
                      <div className="mt-4"><Input type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre, DNI o RUC" prefix={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} /></div>
                      <div role="group" aria-label="Clientes" className="mt-3 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
                        {lista.length === 0 && <EmptyState icon={Search} title="Sin coincidencias" description="Busca por nombre o documento, o registra un cliente nuevo." className="py-8" />}
                        {lista.map((c) => {
                          const d = deudaCliente(db, c.id);
                          const sel = valores.clienteId === c.id;
                          return (
                            <button key={c.id} type="button" aria-pressed={sel} onClick={() => elegir(c.id)}
                              className={cn('flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors', sel ? 'border-teal bg-teal-soft' : 'border-line hover:bg-surface-2')}>
                              <Avatar nombre={c.nombre} tipo={c.tipo} />
                              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{c.nombre}</span><span className="num block truncate text-xs text-ink-muted">{c.tipo} {c.doc} · {c.agencia}</span></span>
                              <span className="hidden w-28 shrink-0 text-right sm:block"><span className="num block text-sm font-medium text-ink">{money(capacidadDisponible(d))}</span><span className="block text-xs text-ink-muted">disponible</span></span>
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
                      <div className="mt-5 space-y-5">
                        <FormSection title="Importe y plazo">
                          <Controller name="monto" control={control} render={({ field }) => (
                            <Field label="Monto solicitado" error={errors.monto?.message} hint={`Mínimo ${money(CFG.minMonto)}. Disponible: ${money(capacidadDisponible(deuda))}`}>
                              <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} decimals={2} prefix="S/" placeholder="0.00" />
                            </Field>
                          )} />
                          <Controller name="plazo" control={control} render={({ field }) => (
                            <Field label={`Plazo (${CFG.plazoMin}–${CFG.plazoMax} meses)`} error={errors.plazo?.message}>
                              <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} suffix="meses" />
                            </Field>
                          )} />
                        </FormSection>
                        <FormSection title="Fechas" description="La primera cuota vence un mes después del desembolso.">
                          <Controller name="desembolso" control={control} render={({ field }) => (
                            <Field label="Fecha de desembolso" error={errors.desembolso?.message}>
                              <DatePicker name={field.name} ref={field.ref} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                            </Field>
                          )} />
                          <Field label="Primera cuota" hint="Calculada automáticamente"><Input derived value={valores.desembolso ? fecha(addMonths(valores.desembolso, 1)) : '—'} /></Field>
                        </FormSection>
                        <FormSection title="Condiciones y responsable">
                          <Field label="Tasa efectiva anual" hint="Fijada por política"><Input derived value={`${(CFG.tea * 100).toFixed(0)} %`} /></Field>
                          <Field label="Asesor responsable" hint="Usuario en sesión"><Input derived value={usuario.nombre} /></Field>
                        </FormSection>
                        <Field label="Observaciones" optional><Textarea rows={2} {...register('observaciones')} /></Field>
                      </div>
                    </>
                  )}

                  {paso === 3 && (
                    <>
                      <h2 className="text-lg font-semibold text-ink">Revisión y confirmación</h2>
                      {validacion.ok
                        ? <p className="mt-1 text-sm text-ink-muted">Todo está en orden. Al confirmar se registra el préstamo simulado y se genera su cronograma.</p>
                        : <p role="alert" className="mt-2 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">Hay validaciones pendientes. Vuelve al paso anterior para corregirlas.</p>}
                      <DefinitionList className="mt-4" items={[
                        { label: 'Cliente', value: cliente?.nombre ?? '—' }, { label: 'Capital', value: money(montoNum) }, { label: 'Plazo', value: `${valores.plazo} meses` },
                        { label: 'Desembolso', value: fecha(valores.desembolso) }, { label: 'Cuota estimada', value: sim ? money(sim.cuota) : '—', strong: true },
                        { label: 'Intereses', value: sim ? money(sim.interes) : '—' }, { label: 'Total contractual', value: sim ? money(sim.total) : '—', strong: true }
                      ]} />
                      {sim && (
                        <div className="mt-4">
                          <Button variant="ghost" size="sm" onClick={() => setVerCronograma((v) => !v)} aria-expanded={verCronograma}><ChevronDown className={cn('size-4 transition-transform', verCronograma && 'rotate-180')} />{verCronograma ? 'Ocultar' : 'Ver'} cronograma previsto</Button>
                          {verCronograma && (
                            <div className="mt-2 max-h-72 overflow-auto rounded-control border border-line">
                              <table className="w-full min-w-[28rem] text-sm"><thead className="sticky top-0 bg-surface-2 text-xs text-ink-muted"><tr><th className="px-3 py-2 text-left">N.º</th><th className="px-3 py-2 text-left">Vence</th><th className="px-3 py-2 text-right">Capital</th><th className="px-3 py-2 text-right">Interés</th><th className="px-3 py-2 text-right">Cuota</th></tr></thead>
                                <tbody>{sim.cronograma.map((c) => <tr key={c.n} className="num border-t border-line"><td className="px-3 py-1.5">{c.n}</td><td className="px-3 py-1.5">{fecha(c.fecha)}</td><td className="px-3 py-1.5 text-right">{money(c.capital)}</td><td className="px-3 py-1.5 text-right">{money(c.interes)}</td><td className="px-3 py-1.5 text-right font-medium">{money(c.cuota)}</td></tr>)}</tbody></table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" onClick={cancelar}>Cancelar solicitud</Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      {paso > 1 && <Button onClick={() => setPaso(paso - 1)}>Atrás</Button>}
                      {paso < 3
                        ? <Button variant="primary" onClick={siguiente} disabled={paso === 1 && !valores.clienteId}>Continuar</Button>
                        : <Button variant="primary" onClick={() => setConfirmar(true)} disabled={!validacion.ok}><Check className="size-4" />Confirmar y desembolsar</Button>}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
        <aside aria-label="Resumen de la solicitud">{resumen}</aside>
      </div>

      <ClientFormSheet open={registrar} onOpenChange={setRegistrar} onCreated={(c) => { elegir(c.id); }} />

      <Modal open={confirmar} onOpenChange={(o) => { if (!guardando) setConfirmar(o); }} size="sm" title="Confirmar desembolso simulado"
        description={`Vas a registrar un préstamo de ${money(montoNum)} a ${valores.plazo} meses para ${cliente?.nombre ?? ''}. No se realiza ningún cobro inicial ni movimiento bancario real.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)} disabled={guardando}>Cancelar</Button><Button variant="primary" loading={guardando} onClick={confirmarDesembolso}>Confirmar</Button></>} />

      <Modal open={descartar} onOpenChange={setDescartar} size="sm" title="¿Descartar la solicitud?" description="Se perderán los datos ingresados. No se ha registrado ningún préstamo."
        footer={<><Button variant="secondary" onClick={() => setDescartar(false)}>Seguir editando</Button><Button variant="danger" onClick={() => navigate('/prestamos')}>Descartar</Button></>} />
    </>
  );
}
