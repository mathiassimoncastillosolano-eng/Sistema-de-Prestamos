import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'motion/react';
import { Check, CircleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DefinitionList } from '@/components/data-display/definition-list';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { fecha } from '@/lib/dates';
import { cuotaAbierta, faltaCuota, r2, resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import { DUR, EASE } from '@/lib/motion';
import { getCliente, getPrestamo, movimientos } from '@/lib/selectors';
import { delay } from '@/lib/utils';
import { pagoSchema, type PagoForm } from '@/lib/validation';
import { registrarPago } from '@/services/actions';
import { getDb } from '@/services/store';
import { MEDIOS_PAGO, type Pago } from '@/types';
import { PaymentHistory } from './payment-history';

interface Resultado { prestamoId: string; operacion: Pago }

function Exito({ r, onOtra }: { r: Resultado; onOtra: () => void }) {
  const db = useDb();
  const p = getPrestamo(db, r.prestamoId);
  const c = p && getCliente(db, p.clienteId);
  if (!p) return null;
  const x = resumen(p);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }} className="mx-auto max-w-xl">
      <Card><CardBody className="py-8 text-center">
        <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: DUR.slow, ease: EASE }} className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success-ink">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.15, ease: EASE }} /></svg>
        </motion.span>
        <h1 className="mt-4 text-2xl font-semibold text-ink" role="status">Operación registrada</h1>
        <p className="mt-1 text-sm text-ink-muted">Simulación guardada en este navegador. No se realizó ningún cobro real.</p>
        <DefinitionList className="mt-6 text-left" items={[
          { label: 'N.º de operación', value: r.operacion.op, strong: true }, { label: 'Cliente', value: c?.nombre ?? '—' }, { label: 'Préstamo', value: p.id }, { label: 'Tipo', value: r.operacion.tipo },
          { label: 'Importe', value: money(r.operacion.monto), strong: true }, { label: 'Fecha', value: fecha(r.operacion.fecha) }, { label: 'Usuario', value: r.operacion.usuario },
          { label: 'Nuevo saldo pendiente', value: money(x.pendiente) }, { label: 'Estado actualizado', value: <StatusBadge estado={x.estado} /> }
        ]} />
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button asChild variant="primary"><Link to={`/prestamos/${p.id}`}>Ver préstamo</Link></Button><Button onClick={onOtra}>Registrar otra operación</Button></div>
      </CardBody></Card>
    </motion.div>
  );
}

export default function PaymentsPage() {
  const { id: idParam } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const db = useDb();
  const abiertos = useMemo(() => db.prestamos.filter((p) => resumen(p).estado !== 'Cancelado'), [db.prestamos]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [confirmar, setConfirmar] = useState<PagoForm | null>(null);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);

  const inicialId = abiertos.some((p) => p.id === idParam) ? (idParam as string) : (abiertos[0]?.id ?? '');
  const defaults = (prestamoId: string, cuotaPreferida?: string): Pick<PagoForm, 'cuotaN' | 'monto'> => {
    const p = getPrestamo(getDb(), prestamoId);
    const cuotas = p?.cronograma.filter(cuotaAbierta) ?? [];
    const c = cuotas.find((x) => String(x.n) === cuotaPreferida) ?? cuotas[0];
    return { cuotaN: c ? String(c.n) : '', monto: c ? faltaCuota(c) : 0 };
  };
  /** Valores iniciales coherentes con el préstamo, el tipo de operación y la cuota indicados (p. ej. desde la URL). */
  const iniciales = (prestamoId: string, modo: PagoForm['modo'], cuota?: string): PagoForm => {
    const p = getPrestamo(getDb(), prestamoId);
    const d = defaults(prestamoId, cuota);
    return { prestamoId, modo, ...d, monto: modo === 'anticipada' && p ? resumen(p).pendiente : d.monto, fecha: CFG.hoy, medio: 'Efectivo', ref: '' };
  };

  const modoQ: PagoForm['modo'] = sp.get('modo') === 'anticipada' ? 'anticipada' : 'cuota';
  const cuotaQ = sp.get('cuota') ?? undefined;
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = useForm<PagoForm>({
    resolver: (v, c, o) => zodResolver(pagoSchema((id) => getPrestamo(getDb(), id)))(v, c, o),
    defaultValues: iniciales(inicialId, modoQ, cuotaQ),
    mode: 'onTouched', reValidateMode: 'onChange'
  });
  const v = watch();
  const p = getPrestamo(db, v.prestamoId);
  const r = p ? resumen(p) : null;
  const cuotas = p?.cronograma.filter(cuotaAbierta) ?? [];
  const importe = v.modo === 'anticipada' && r ? r.pendiente : v.monto;

  // Si el préstamo desaparece del conjunto abierto (p. ej. tras restaurar datos), reubica la selección
  useEffect(() => { if (!p && abiertos[0]) { setValue('prestamoId', abiertos[0].id); } }, [p, abiertos, setValue]);

  // Aplica el importe sugerido cuando cambia el préstamo, el modo o la cuota
  const sugerir = (prestamoId: string, modo: PagoForm['modo'], cuotaN?: string) => {
    const pr = getPrestamo(getDb(), prestamoId);
    if (!pr) return;
    if (modo === 'anticipada') { setValue('monto', resumen(pr).pendiente, { shouldValidate: true }); return; }
    const d = defaults(prestamoId, cuotaN);
    setValue('cuotaN', d.cuotaN); setValue('monto', d.monto, { shouldValidate: true });
  };
  // Si la URL cambia estando ya en esta pantalla (otro préstamo, ?modo=anticipada, ?cuota=n), el formulario la sigue
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    const id = abiertos.some((x) => x.id === idParam) ? (idParam as string) : (abiertos[0]?.id ?? '');
    reset(iniciales(id, modoQ, cuotaQ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, modoQ, cuotaQ]);

  const movs = useMemo(() => movimientos(db).slice(0, 15), [db]);

  if (resultado) return <Exito r={resultado} onOtra={() => { const id = abiertos[0]?.id ?? ''; setResultado(null); reset(iniciales(id, 'cuota')); navigate('/pagos', { replace: true }); }} />;
  if (!abiertos.length) return (<><PageHeader title="Pagos y cancelaciones" /><EmptyState icon={Check} title="Sin saldos pendientes" description="Todos los préstamos están cancelados." /></>);

  const tipo = v.modo === 'anticipada' ? 'Cancelación anticipada' : 'Pago de cuota';
  const saldoTras = r && Number.isFinite(importe) ? Math.max(0, r2(r.pendiente - importe)) : null;

  const registrar = async (f: PagoForm) => {
    if (bloqueo.current) return; // evita envíos duplicados
    bloqueo.current = true; setGuardando(true);
    await delay(500);
    const res = registrarPago({ prestamoId: f.prestamoId, monto: f.monto, fecha: f.fecha, medio: f.medio, ref: f.ref || undefined, tipo: f.modo === 'anticipada' ? 'Cancelación anticipada' : 'Pago de cuota' });
    bloqueo.current = false; setGuardando(false); setConfirmar(null);
    if (!res.ok) {
      const campo = (['monto', 'fecha', 'ref', 'prestamoId'] as const).find((k) => k === res.campo) ?? 'monto';
      setError(campo, { message: res.error });
      toast.error(res.error);
      return;
    }
    toast.success(`Operación ${res.operacion.op} registrada`);
    setResultado({ prestamoId: res.prestamo.id, operacion: res.operacion });
  };

  return (
    <>
      <PageHeader title="Pagos y cancelaciones" description="Registra pagos de cuotas o la cancelación anticipada del préstamo (simulado: no hay cobros ni transferencias reales)." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Card>
          <form noValidate onSubmit={handleSubmit((f) => setConfirmar(f))}>
            <CardBody className="space-y-5">
              <Field label="Préstamo" error={errors.prestamoId?.message}>
                <Select {...register('prestamoId', { onChange: (e) => sugerir(e.target.value, v.modo) })}>
                  {abiertos.map((x) => <option key={x.id} value={x.id}>{x.id} · {getCliente(db, x.clienteId)?.nombre}</option>)}
                </Select>
              </Field>

              <div>
                <p id="modo-label" className="mb-1.5 text-sm font-medium text-ink">Tipo de operación</p>
                <Segmented aria-label="Tipo de operación" value={v.modo} onValueChange={(m) => { setValue('modo', m); sugerir(v.prestamoId, m, v.cuotaN); }} options={[{ value: 'cuota', label: 'Pago de cuota' }, { value: 'anticipada', label: 'Cancelación anticipada' }]} />
              </div>

              {v.modo === 'cuota' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cuota a pagar">
                    <Select {...register('cuotaN', { onChange: (e) => sugerir(v.prestamoId, 'cuota', e.target.value) })}>
                      {cuotas.map((c) => <option key={c.n} value={c.n}>Cuota {c.n} · vence {fecha(c.fecha)} · {money(faltaCuota(c))}</option>)}
                    </Select>
                  </Field>
                  <Field label="Importe" error={errors.monto?.message} hint="Se aplica a las cuotas abiertas, en orden.">
                    <Input type="number" inputMode="decimal" step="0.01" min="0" prefix="S/" {...register('monto', { valueAsNumber: true })} />
                  </Field>
                </div>
              ) : r && (
                <div>
                  <div className="grid grid-cols-1 items-center gap-2 rounded-card border border-line bg-sand p-4 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]" role="group" aria-label="Cálculo de la cancelación anticipada">
                    <div><p className="text-xs text-sand-ink">Total contractual</p><p className="num text-lg font-semibold text-ink">{money(r.total)}</p></div><span aria-hidden className="text-ink-muted">−</span>
                    <div><p className="text-xs text-sand-ink">Total abonado</p><p className="num text-lg font-semibold text-ink">{money(r.abonado)}</p></div><span aria-hidden className="text-ink-muted">=</span>
                    <div className="rounded-control bg-surface p-2 shadow-card"><p className="text-xs text-sand-ink">Importe de cancelación</p><p className="num text-lg font-semibold text-teal-ink">{money(r.pendiente)}</p></div>
                  </div>
                  <p className="mt-2 text-[0.8125rem] text-ink-muted">Se paga el total pactado, incluidos los intereses previstos. No hay recálculo de intereses y el cronograma original se conserva.</p>
                  {errors.monto && <p role="alert" className="mt-2 text-sm font-medium text-danger-ink">{errors.monto.message}</p>}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Fecha del pago" error={errors.fecha?.message}><Input type="date" max={CFG.hoy} {...register('fecha')} /></Field>
                <Field label="Medio de pago (ficticio)"><Select {...register('medio')}>{MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}</Select></Field>
                <Field label="Referencia" optional error={errors.ref?.message}><Input autoComplete="off" {...register('ref')} /></Field>
              </div>
            </CardBody>
            <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/50 px-5 py-4 sm:flex-row sm:justify-end">
              <Button type="submit" variant="primary">Revisar y confirmar</Button>
            </div>
          </form>
        </Card>

        <aside aria-label="Resumen del préstamo" className="space-y-5">
          {p && r && (
            <Card className="lg:sticky lg:top-24"><CardBody>
              <h2 className="truncate text-[0.9375rem] font-semibold text-ink">{getCliente(db, p.clienteId)?.nombre}</h2>
              <p className="mt-1 flex items-center gap-2 text-[0.8125rem] text-ink-muted"><Link to={`/prestamos/${p.id}`} className="num font-medium text-teal-ink hover:underline">{p.id}</Link><StatusBadge estado={r.estado} /></p>
              <DefinitionList compact className="mt-3" items={[
                { label: 'Capital pendiente', value: money(r.capitalPend) }, { label: 'Intereses pactados', value: money(r.interes) }, { label: 'Total contractual', value: money(r.total) },
                { label: 'Total abonado', value: money(r.abonado) }, { label: 'Pendiente de pago', value: money(r.pendiente), strong: true }
              ]} />
              {saldoTras !== null && (
                <div className="mt-4 rounded-control bg-teal-soft p-3 text-sm text-teal-ink">
                  <p className="flex items-center justify-between gap-2"><span>{tipo}</span><b className="num">{money(Number.isFinite(importe) ? importe : 0)}</b></p>
                  <p className="mt-1 flex items-center justify-between gap-2"><span>Saldo tras la operación</span><b className="num">{money(saldoTras)}</b></p>
                </div>
              )}
              {r.vencidas > 0 && <p className="mt-3 flex items-start gap-2 text-[0.8125rem] text-danger-ink"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{r.vencidas} cuota{r.vencidas === 1 ? '' : 's'} vencida{r.vencidas === 1 ? '' : 's'}.</p>}
            </CardBody></Card>
          )}
        </aside>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Movimientos recientes" description="Últimas operaciones registradas en toda la cartera" className="pb-3" />
        <PaymentHistory pagos={movs} mostrarPrestamo tamanoPagina={5} etiqueta="Movimientos recientes" />
      </Card>

      <Modal open={!!confirmar} onOpenChange={(o) => { if (!o && !guardando) setConfirmar(null); }} title={`Confirmar ${tipo.toLowerCase()}`} description="Revisa los datos antes de registrar. La operación es simulada."
        footer={<><Button variant="secondary" onClick={() => setConfirmar(null)} disabled={guardando}>Volver</Button><Button variant="primary" loading={guardando} onClick={() => confirmar && registrar(confirmar)}>Confirmar</Button></>}>
        {confirmar && p && r && (
          <>
            <DefinitionList items={[
              { label: 'Préstamo', value: p.id }, { label: 'Cliente', value: getCliente(db, p.clienteId)?.nombre ?? '—' }, { label: 'Importe', value: money(confirmar.monto), strong: true },
              { label: 'Fecha', value: fecha(confirmar.fecha) }, { label: 'Medio', value: confirmar.medio }, { label: 'Saldo tras la operación', value: money(Math.max(0, r2(r.pendiente - confirmar.monto))) }
            ]} />
            {confirmar.modo === 'anticipada' && <p className="mt-3 text-sm text-ink-muted">El préstamo se marcará como cancelado y se conservará el cronograma original.</p>}
          </>
        )}
      </Modal>
    </>
  );
}
