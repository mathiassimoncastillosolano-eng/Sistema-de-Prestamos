import { CreditCard, Printer, Send, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DefinitionList } from '@/components/data-display/definition-list';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { PrintHeader } from '@/components/layout/print-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Meter } from '@/components/ui/meter';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { diasEntre, fecha } from '@/lib/dates';
import { estadoCuota, faltaCuota, resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import { getCliente, getPrestamo, movimientos } from '@/lib/selectors';
import { PaymentHistory } from '@/features/payments/payment-history';
import { ScheduleTable } from './schedule-table';

function CuotaDialog({ n, onClose, id }: { n: number | null; onClose: () => void; id: string }) {
  const db = useDb();
  const navigate = useNavigate();
  const p = getPrestamo(db, id);
  const c = p?.cronograma.find((x) => x.n === n);
  const e = c ? estadoCuota(c) : null;
  const abierta = !!c && c.abonado < c.cuota - 0.005;
  const dias = c ? diasEntre(c.fecha, CFG.hoy) : 0;
  const cancelado = p ? resumen(p).estado === 'Cancelado' : true;
  return (
    <Modal open={n !== null && !!c} onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title={c ? `Cuota ${c.n} de ${p?.plazo}` : 'Cuota'} description={c ? `Vence el ${fecha(c.fecha)}` : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cerrar</Button>{abierta && !cancelado && <Button variant="primary" onClick={() => navigate(`/pagos/${id}?cuota=${n}`)}><CreditCard className="size-4" />Registrar pago de esta cuota</Button>}</>}>
      {c && e && (
        <>
          <DefinitionList items={[
            { label: 'Estado', value: <StatusBadge estado={e} /> },
            { label: 'Capital', value: money(c.capital) }, { label: 'Interés', value: money(c.interes) },
            { label: 'Cuota', value: money(c.cuota), strong: true }, { label: 'Abonado', value: money(c.abonado) },
            { label: 'Falta por pagar', value: money(faltaCuota(c)), strong: true }, { label: 'Saldo de capital tras la cuota', value: money(c.saldo) }
          ]} />
          {abierta && <p className="mt-3 text-sm text-ink-muted">{dias < 0 ? `Vencida hace ${-dias} día${dias === -1 ? '' : 's'}.` : dias === 0 ? 'Vence hoy.' : `Vence en ${dias} día${dias === 1 ? '' : 's'}.`}</p>}
          {e === 'Cubierta por cancelación' && <p className="mt-3 text-sm text-ink-muted">Esta cuota quedó cubierta por la cancelación anticipada. El cronograma original se conserva para consulta.</p>}
        </>
      )}
    </Modal>
  );
}

function EnvioDialog({ open, onOpenChange, id }: { open: boolean; onOpenChange: (o: boolean) => void; id: string }) {
  const db = useDb();
  const p = getPrestamo(db, id);
  const c = p && getCliente(db, p.clienteId);
  if (!p || !c) return null;
  const r = resumen(p);
  const msg = `Hola ${c.nombre}, te compartimos el cronograma de tu préstamo ${p.id}: ${p.plazo} cuotas, total contractual ${money(r.total)}. Próximo vencimiento: ${r.proxima ? fecha(r.proxima.fecha) : '—'}.`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success('Texto copiado'); } catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.'); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Preparar envío del cronograma"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button><Button variant="primary" onClick={copiar}>Copiar texto</Button></>}>
      <div className="mb-4 flex items-start gap-3 rounded-control bg-warning-soft p-3 text-[0.8125rem] text-warning-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><p><b className="font-semibold">Simulación.</b> No hay integración con correo ni WhatsApp: no se enviará nada.</p></div>
      <label htmlFor="msg-env" className="mb-1.5 block text-sm font-medium">Vista previa del mensaje</label>
      <Textarea id="msg-env" rows={5} readOnly value={msg} />
      <p className="mt-2 text-[0.8125rem] text-ink-muted">Destino de demostración: {c.telefono || 'sin celular registrado'}</p>
    </Modal>
  );
}

export default function LoanDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const [cuota, setCuota] = useState<number | null>(null);
  const [envio, setEnvio] = useState(false);
  const p = getPrestamo(db, id);
  const pagos = useMemo(() => movimientos(db).filter((m) => m.prestamoId === id), [db, id]);

  if (!p) return <EmptyState icon={TriangleAlert} title="Préstamo no encontrado" description="Revisa el código o vuelve al listado de préstamos." action={<Button asChild variant="primary"><Link to="/prestamos">Ver préstamos</Link></Button>} />;

  const r = resumen(p);
  const c = getCliente(db, p.clienteId);
  const pct = r.total ? (r.abonado / r.total) * 100 : 0;
  const anticipada = p.pagos.some((g) => g.tipo === 'Cancelación anticipada');

  const kpis = [
    { label: 'Capital original', valor: p.capital, pie: 'Monto desembolsado' },
    { label: 'Intereses pactados', valor: r.interes, pie: `TEA ${(p.tea * 100).toFixed(0)} %` },
    { label: 'Total contractual', valor: r.total, pie: `${p.plazo} cuotas` },
    { label: 'Total abonado', valor: r.abonado, pie: `${Math.round(pct)} % del total` },
    { label: 'Pendiente de pago', valor: r.pendiente, pie: r.proxima ? `Próximo vencimiento ${fecha(r.proxima.fecha)}` : 'Sin saldo pendiente', alerta: r.vencidas > 0 }
  ];

  return (
    <>
      <PrintHeader titulo={`Cronograma de pagos · ${p.id}`} lineas={[`Cliente: ${c?.nombre ?? p.clienteId} (${c?.tipo} ${c?.doc})`, `Capital ${money(p.capital)} · ${p.plazo} cuotas · TEA ${(p.tea * 100).toFixed(0)} % · Desembolso ${fecha(p.desembolso)}`]} />
      <PageHeader back={{ to: '/prestamos', label: 'Préstamos' }}
        title={<span className="flex flex-wrap items-center gap-3">{p.id}<StatusBadge estado={r.estado} /></span>}
        description={<>{c ? <Link to={`/clientes/${c.id}`} className="font-medium text-teal-ink hover:underline">{c.nombre}</Link> : p.clienteId} · {p.agencia} · Asesor {p.asesor} · Desembolso {fecha(p.desembolso)} (sin cobro inicial)</>}
        actions={<>
          {r.estado !== 'Cancelado' && <>
            <Button variant="primary" onClick={() => navigate(`/pagos/${p.id}`)}><CreditCard className="size-4" />Registrar pago</Button>
            <Button onClick={() => navigate(`/pagos/${p.id}?modo=anticipada`)}>Cancelación anticipada</Button>
          </>}
          <Button onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>
          <Button onClick={() => setEnvio(true)}><Send className="size-4" />Preparar envío</Button>
        </>} />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card lg:grid-cols-5">
        {kpis.map((k, i) => (
          <div key={k.label} className={`bg-surface p-4 sm:p-5 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <p className="text-[0.8125rem] text-ink-muted">{k.label}</p>
            <p className={`mt-1 truncate text-xl font-semibold ${k.alerta ? 'text-danger-ink' : 'text-ink'}`}><AnimatedNumber value={k.valor} format={money} duration={0.5} /></p>
            <p className="mt-1 text-xs text-ink-muted">{k.pie}</p>
          </div>
        ))}
      </div>

      <Card className="mt-5 no-print">
        <CardBody>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="text-ink-muted">Avance de pago · capital pendiente <b className="num font-semibold text-ink">{money(r.capitalPend)}</b></span><b className="num text-ink">{Math.round(pct)} %</b></div>
          <Meter value={pct} tone={r.estado === 'Cancelado' ? 'success' : 'teal'} label={`Avance de pago: ${Math.round(pct)} %`} />
        </CardBody>
      </Card>

      {anticipada && (
        <p className="no-print mt-5 rounded-control border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-ink">Este préstamo tuvo una cancelación anticipada (total contractual − pagos previos, sin recalcular intereses). El cronograma original se conserva para consulta; las cuotas cubiertas se marcan como tales.</p>
      )}

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Cronograma de pagos" description={`${p.plazo} cuotas · toca una cuota para ver su detalle`} className="pb-4 no-print" />
        <ScheduleTable prestamo={p} onSelect={setCuota} />
      </Card>

      <Card className="no-print mt-5 overflow-hidden">
        <CardHeader title="Historial de pagos" className="pb-2" />
        <PaymentHistory pagos={pagos} />
      </Card>

      <CuotaDialog n={cuota} onClose={() => setCuota(null)} id={p.id} />
      <EnvioDialog open={envio} onOpenChange={setEnvio} id={p.id} />
    </>
  );
}
