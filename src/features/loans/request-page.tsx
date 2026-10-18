import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, CalendarDays, Check, Info, Percent, Search, Send, TriangleAlert, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { DefinitionList } from '@/components/data-display/definition-list';
import { InfoFact, InfoPanel } from '@/components/data-display/info-fact';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
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
import { listarClientes, type ClienteListado } from '@/services/clientes-api';
import { detalleLimite, prestamosApi, PrestamoApiError } from '@/services/prestamos-api';
import { simular } from '@/lib/finance';
import { SimulationSummary } from './simulation-summary';

/* Reglas de negocio de US-04/05. El servidor las vuelve a validar: aquí solo se avisa antes de enviar. */
const CAPITAL_MINIMO = 1000;
const MAX_CAPITAL_ENTRADA = 999999; // 6 cifras
const MAX_PLAZO_ENTRADA = 999;      // 3 cifras
const MAX_OBSERVACIONES = 250;
const LIMITE = 10000;
const PLAZO_MIN = 1;
const PLAZO_MAX = 60;
const TEA = 0.3;

const esquema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente.'),
    capital: z
    .number({ error: 'Ingresa un monto válido.' })
    .min(CAPITAL_MINIMO, `El monto mínimo es ${money(CAPITAL_MINIMO)}.`)
    .max(LIMITE, `El monto no puede superar ${money(LIMITE)} (límite por cliente).`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'El monto admite como máximo 2 decimales.'),
  plazo: z
    .number({ error: 'Ingresa el plazo en meses.' })
    .int('El plazo debe ser un número entero de meses.')
    .min(PLAZO_MIN, `El plazo mínimo es ${PLAZO_MIN} mes.`)
    .max(PLAZO_MAX, `El plazo máximo es ${PLAZO_MAX} meses.`),
    observaciones: z.string().max(MAX_OBSERVACIONES, `Máximo ${MAX_OBSERVACIONES} caracteres.`)
});
type SolicitudForm = z.infer<typeof esquema>;

const PASOS = [
  { titulo: 'Cliente', descripcion: 'Quién solicita' },
  { titulo: 'Condiciones', descripcion: 'Monto y plazo' },
  { titulo: 'Confirmación', descripcion: 'Revisar y registrar' }
];

/** Fecha de hoy en Lima (yyyy-MM-dd), solo para mostrarla: la fecha de desembolso real la fija el servidor. */
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

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
  const [desembolsoPrevisto] = useState(hoyLima);

  const [clientes, setClientes] = useState<ClienteListado[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const preseleccionado = useRef(false);

  const form = useForm<SolicitudForm>({
    resolver: zodResolver(esquema),
    defaultValues: { clienteId: '', capital: 2000, plazo: 12, observaciones: '' },
    mode: 'onChange'
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
  const condicionesValidas = esquema.safeParse(valores).success;
  const sim = condicionesValidas ? simular({ monto: capitalNum, plazo: plazoNum, desembolso: desembolsoPrevisto }) : null;

  const elegir = (id: string) => {
    setErrorServidor(null);
    setValue('clienteId', id, { shouldValidate: true, shouldDirty: true });
  };

  const siguiente = async () => {
    if (paso === 1) { if (await trigger('clienteId')) setPaso(2); return; }
    if (paso === 2) { if (await trigger(['capital', 'plazo', 'observaciones'])) { setErrorServidor(null); setPaso(3); } }
  };

  const enviar = async () => {
    if (!esquema.safeParse(valores).success) { setConfirmar(false); setPaso(2); void trigger(); return; }
    if (guardando) return; // evita envíos duplicados
    setGuardando(true);
    setErrorServidor(null);
    try {
      const p = await prestamosApi.registrar({
        clienteId: valores.clienteId,
        capital: valores.capital,
        plazoMeses: valores.plazo,
        observaciones: valores.observaciones.trim() || undefined
      });
      toast.success(`Préstamo N.º ${p.numero} registrado con su cronograma`);
      navigate(`/prestamos/${p.id}`);
    } catch (e) {
      setConfirmar(false);
      setErrorServidor(e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo registrar el préstamo. Inténtalo nuevamente.'));
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => (isDirty || paso > 1 ? setDescartar(true) : navigate('/prestamos'));
  const limite = detalleLimite(errorServidor);

  return (
    <>
      <PageHeader title="Registrar préstamo" description="Elige al cliente, define el monto y el plazo, y registra el préstamo con su cronograma. El sistema valida el límite de endeudamiento por cliente." />
      <div className="mb-6"><Stepper pasos={PASOS} actual={paso} onIr={(n) => { if (n < paso) setPaso(n); }} /></div>

      <div className={cn('grid gap-5', paso === 2 && 'xl:grid-cols-[minmax(0,1fr)_21.5rem] xl:items-start')}>
      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={paso} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: DUR.base, ease: EASE }}>
            <Card>
              <CardBody>
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
                        Cliente seleccionado: <b className="font-semibold">{cliente.nombre}</b>. El límite de endeudamiento de {money(LIMITE)} se evalúa al registrar, sumando los préstamos activos del cliente en toda la empresa.
                      </p>
                    )}
                  </>
                )}

                {paso === 2 && (
                  <>
                    <h2 className="text-lg font-semibold text-ink">Condiciones del préstamo</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">Define el importe y el plazo. Las cuotas se calculan al registrar.</p>
                    <div className="mt-5 space-y-5">
                      <FormSection title="Importe y plazo">
                        <Controller name="capital" control={control} render={({ field }) => (
                          <Field label="Monto solicitado" error={errors.capital?.message} hint={`Mínimo ${money(CAPITAL_MINIMO)}. Límite acumulado por cliente: ${money(LIMITE)}`}>
                            <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(typeof v === 'number' && v > MAX_CAPITAL_ENTRADA ? MAX_CAPITAL_ENTRADA : v)} onBlur={field.onBlur} decimals={2} maxIntegerDigits={6} prefix="S/" placeholder="0.00" />
                          </Field>
                        )} />
                        <Controller name="plazo" control={control} render={({ field }) => (
                          <Field label={`Plazo (${PLAZO_MIN}–${PLAZO_MAX} meses)`} error={errors.plazo?.message} hint="Cuotas mensuales iguales">
                            <NumericInput name={field.name} ref={field.ref} value={field.value} onValueChange={(v) => field.onChange(typeof v === 'number' && v > MAX_PLAZO_ENTRADA ? MAX_PLAZO_ENTRADA : v)} onBlur={field.onBlur} maxIntegerDigits={3} suffix="meses" />
                          </Field>
                        )} />
                      </FormSection>
                      <FormSection title="Fechas">
                        <div className="space-y-2.5 sm:col-span-2">
                          <InfoPanel aria-label="Fechas del préstamo">
                            <InfoFact icon={CalendarDays} label="Desembolso" value={fecha(desembolsoPrevisto)} helper="Fecha de hoy (Lima), no editable" />
                            <InfoFact icon={CalendarClock} label="Primera cuota" value="Un mes después" helper="Se calcula al registrar" />
                          </InfoPanel>
                          <p className="flex items-start gap-1.5 text-[0.8125rem] text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />La primera cuota vence exactamente un mes después del desembolso.</p>
                        </div>
                      </FormSection>
                      <FormSection title="Condiciones y responsable">
                        <div className="sm:col-span-2">
                          <InfoPanel aria-label="Condiciones y responsable">
                            <InfoFact icon={Percent} label="Tasa efectiva anual" value={`${(TEA * 100).toFixed(0)} %`} helper="Fijada por política de crédito" />
                            <InfoFact icon={UserRound} label="Asesor responsable" value={usuario.nombre} helper="Usuario en sesión" />
                          </InfoPanel>
                        </div>
                      </FormSection>
                      <Field label="Observaciones" optional error={errors.observaciones?.message}>
                        <Textarea rows={3} maxLength={MAX_OBSERVACIONES} className="min-h-[5.5rem] max-h-56" placeholder="Información adicional" {...register('observaciones')} />
                      </Field>
                      <p className="mt-1 text-right text-xs text-ink-muted">{valores.observaciones.length}/{MAX_OBSERVACIONES}</p>
                    </div>
                  </>
                )}

                {paso === 3 && (
                  <>
                    <h2 className="text-lg font-semibold text-ink">Revisión y confirmación</h2>
                    <p className="mt-1 text-sm text-ink-muted">Al confirmar se registra el préstamo y su cronograma de cuotas en una sola operación: si algo falla, no se guarda nada.</p>

                    {errorServidor && (
                      <div role="alert" className="mt-4 rounded-control bg-danger-soft p-3 text-sm text-danger-ink">
                        <p className="font-medium">{errorServidor.codigo === 'LIMITE_EXCEDIDO' ? 'Se supera el límite de endeudamiento' : 'No se pudo registrar el préstamo'}</p>
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
                          {limite ? 'Reduce el monto en el paso anterior para continuar.' : 'Revisa los datos o inténtalo nuevamente.'}
                        </p>
                      </div>
                    )}

                    {cliente && (
                      <div className="mt-4 flex items-center gap-3 rounded-control bg-surface-2 p-3">
                        <Avatar nombre={cliente.nombre} tipo={cliente.tipoDocumento} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{cliente.nombre}</p>
                          <p className="num text-xs text-ink-muted">{cliente.tipoDocumento} {cliente.numeroDocumento}</p>
                        </div>
                      </div>
                    )}

                    <section aria-label="Condiciones del préstamo" className="mt-5">
                      <h3 className="mb-1 text-sm font-semibold text-ink">Condiciones</h3>
                      <DefinitionList items={[
                        { label: 'Capital solicitado', value: money(capitalNum), strong: true },
                        { label: 'Moneda', value: 'Soles (PEN)' },
                        { label: 'Plazo', value: `${plazoNum} meses` },
                        { label: 'Tasa aplicada', value: `TEA ${(TEA * 100).toFixed(0)} %` },
                        { label: 'Frecuencia de cuotas', value: 'Mensual' },
                        { label: 'Desembolso', value: fecha(desembolsoPrevisto) },
                        { label: 'Asesor responsable', value: usuario.nombre },
                        { label: 'Observaciones', value: valores.observaciones.trim() || '—' }
                      ]} />
                    </section>
                  </>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    {paso > 1 && <Button onClick={() => setPaso(paso - 1)}>Atrás</Button>}
                    {paso < 3
                      ? <Button variant="primary" onClick={siguiente} disabled={(paso === 1 && !valores.clienteId) || (paso === 2 && !condicionesValidas)}>Continuar</Button>
                      : <Button variant="primary" onClick={() => setConfirmar(true)} disabled={!condicionesValidas || !valores.clienteId}><Send className="size-4" />Registrar préstamo</Button>}
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        
        </AnimatePresence>
      </div>
      {paso === 2 && (
          <motion.div key="resumen" className="min-w-0 xl:sticky xl:top-24" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
            <SimulationSummary
              sim={sim}
              monto={capitalNum}
              plazo={plazoNum}
              valido={condicionesValidas && !!sim}
              motivo={errors.capital?.message ?? errors.plazo?.message}
            />
          </motion.div>
        )}
        </div>

      <Modal open={confirmar} onOpenChange={(o) => { if (!guardando) setConfirmar(o); }} size="sm" title="Registrar préstamo"
        description={`Vas a registrar un préstamo de ${money(capitalNum)} a ${plazoNum} meses para ${cliente?.nombre ?? ''}. Se guardará junto con su cronograma de cuotas.`}
        footer={<><Button variant="secondary" onClick={() => setConfirmar(false)} disabled={guardando}>Cancelar</Button><Button variant="primary" loading={guardando} onClick={enviar}>Registrar</Button></>} />

      <Modal open={descartar} onOpenChange={setDescartar} size="sm" title="¿Descartar el registro?" description="Se perderán los datos ingresados. No se ha registrado ningún préstamo."
        footer={<><Button variant="secondary" onClick={() => setDescartar(false)}>Seguir editando</Button><Button variant="danger" onClick={() => navigate('/prestamos')}>Descartar</Button></>} />
    </>
  );
}