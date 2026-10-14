import { FileDown, MessageSquareText, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DefinitionList } from '@/components/data-display/definition-list';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useDb } from '@/hooks/use-db';
import { CFG } from '@/lib/config';
import { diasEntre, fecha } from '@/lib/dates';
import { cuotaAbierta, estadoCuota, importePendienteCuota, resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import { descargarPdfPrestamo } from '@/lib/pdf';
import { actividadDe, getCliente, getPrestamo } from '@/lib/selectors';
import { ScheduleTable } from './schedule-table';

function CuotaDialog({ n, onClose, id }: { n: number | null; onClose: () => void; id: string }) {
  const db = useDb();
  const p = getPrestamo(db, id);
  const c = p?.cronograma.find((x) => x.n === n);
  const e = c ? estadoCuota(c) : null;
  const dias = c ? diasEntre(c.fecha, CFG.hoy) : 0;
  return (
    <Modal open={n !== null && !!c} onOpenChange={(o) => { if (!o) onClose(); }} size="sm" title={c ? `Cuota ${c.n} de ${p?.plazo}` : 'Cuota'} description={c ? `Vence el ${fecha(c.fecha)}` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      {c && e && (
        <>
          <DefinitionList items={[
            { label: 'Estado', value: <StatusBadge estado={e} /> },
            { label: 'Capital programado', value: money(c.capital) }, { label: 'Interés programado', value: money(c.interes) },
            { label: 'Importe de la cuota', value: money(c.cuota), strong: true },
            { label: 'Saldo de capital programado', value: money(c.saldo) }
          ]} />
          {cuotaAbierta(c) && <p className="mt-3 text-sm text-ink-muted">{dias < 0 ? `Vencida hace ${-dias} día${dias === -1 ? '' : 's'}.` : dias === 0 ? 'Vence hoy.' : `Vence en ${dias} día${dias === 1 ? '' : 's'}.`} Importe contractual: {money(importePendienteCuota(c))}.</p>}
          {e === 'Cubierta (histórico)' && <p className="mt-3 text-sm text-ink-muted">Esta cuota figura cubierta en el registro histórico importado. El sistema no permite registrar pagos; la información es solo de consulta.</p>}
        </>
      )}
    </Modal>
  );
}

function MensajeDialog({ open, onOpenChange, id }: { open: boolean; onOpenChange: (o: boolean) => void; id: string }) {
  const db = useDb();
  const p = getPrestamo(db, id);
  const c = p && getCliente(db, p.clienteId);
  if (!p || !c) return null;
  const r = resumen(p);
  const msg = `Hola ${c.nombre}, te compartimos el resumen de tu préstamo ${p.id}: ${p.plazo} cuotas, importe contractual total ${money(r.total)}. Próximo vencimiento: ${r.proxima ? fecha(r.proxima.fecha) : '—'}.`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success('Texto copiado'); } catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.'); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Mensaje para el cliente"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button><Button variant="primary" onClick={copiar}>Copiar texto</Button></>}>
      <div className="mb-4 flex items-start gap-3 rounded-control bg-info-soft p-3 text-[0.8125rem] text-info-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><p>Este sistema no tiene integración de correo: no envía nada. Copia el texto y envíalo por tu canal habitual; adjunta el PDF descargado.</p></div>
      <label htmlFor="msg-env" className="mb-1.5 block text-sm font-medium">Vista previa del mensaje</label>
      <Textarea id="msg-env" rows={5} readOnly value={msg} />
    </Modal>
  );
}

export default function LoanDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const [cuota, setCuota] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState(false);
  const [generando, setGenerando] = useState(false);
  const p = getPrestamo(db, id);

  if (!p) return <EmptyState icon={TriangleAlert} title="Préstamo no encontrado" description="Revisa el código o vuelve al listado de préstamos." action={<Button asChild variant="primary"><Link to="/prestamos">Ver préstamos</Link></Button>} />;

  const r = resumen(p);
  const c = getCliente(db, p.clienteId);
  const ultima = p.cronograma[p.cronograma.length - 1];
  const historial = actividadDe(db, 'prestamo', p.id);

  const descargar = async () => {
    setGenerando(true);
    try {
      await descargarPdfPrestamo(p, c);
      toast.success('PDF descargado');
    } catch {
      toast.error('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  };

  const kpis = [
    { label: 'Capital original', valor: p.capital, pie: 'Monto registrado' },
    { label: 'Intereses pactados', valor: r.interes, pie: `TEA ${(p.tea * 100).toFixed(0)} %` },
    { label: 'Importe contractual total', valor: r.total, pie: `${p.plazo} cuotas` },
    { label: 'Capital pendiente', valor: r.capitalPend, pie: r.cubierto > 0 ? 'Según registro histórico' : 'Sin amortizaciones registradas' },
    { label: 'Pendiente contractual', valor: r.pendiente, pie: r.proxima ? `Próximo vencimiento ${fecha(r.proxima.fecha)}` : 'Sin cuotas abiertas', alerta: r.vencidas > 0 }
  ];

  return (
    <>
      <PageHeader back={{ to: '/prestamos', label: 'Préstamos' }}
        title={<span className="flex flex-wrap items-center gap-3">{p.id}<StatusBadge estado={r.estado} /></span>}
        description={<>{c ? <Link to={`/clientes/${c.id}`} className="font-medium text-teal-ink hover:underline">{c.nombre}</Link> : p.clienteId} · {p.agencia} · Asesor {p.asesor}</>}
        actions={<>
          <Button variant="primary" onClick={descargar} disabled={generando} aria-busy={generando}><FileDown className="size-4" />{generando ? 'Generando PDF…' : 'Descargar PDF'}</Button>
          <Button onClick={() => setMensaje(true)}><MessageSquareText className="size-4" />Mensaje para el cliente</Button>
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

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Condiciones" className="pb-2" />
          <CardBody className="pt-0">
            <DefinitionList items={[
              { label: 'Fecha de desembolso registrada', value: fecha(p.desembolso) },
              { label: 'Primer vencimiento', value: p.cronograma[0] ? fecha(p.cronograma[0].fecha) : '—' },
              { label: 'Vencimiento final', value: ultima ? fecha(ultima.fecha) : '—' },
              { label: 'Plazo', value: `${p.plazo} meses` }, { label: 'TEA', value: `${(p.tea * 100).toFixed(0)} %` },
              { label: 'Observaciones', value: p.observaciones || '—' }
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Historial administrativo" description="Altas y registros vinculados a este préstamo" className="pb-2" />
          <CardBody className="pt-1">
            {historial.length === 0
              ? <p className="py-6 text-center text-sm text-ink-muted">Sin movimientos administrativos recientes.</p>
              : <ul className="divide-y divide-line">{historial.map((a, i) => <li key={`${a.t}-${i}`} className="py-2.5 text-sm"><p className="text-ink"><b className="font-medium">{a.tipo}</b> · {a.desc}</p><p className="text-xs text-ink-muted">{fecha(a.t.slice(0, 10))} · {a.t.slice(11)} · {a.usuario}</p></li>)}</ul>}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Cronograma de cuotas" description={`${p.plazo} cuotas · informativo, abre una cuota para ver su detalle`} className="pb-4" />
        <ScheduleTable prestamo={p} onSelect={setCuota} />
      </Card>

      <CuotaDialog n={cuota} onClose={() => setCuota(null)} id={p.id} />
      <MensajeDialog open={mensaje} onOpenChange={setMensaje} id={p.id} />
    </>
  );
}
