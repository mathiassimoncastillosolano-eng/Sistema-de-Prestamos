import { FileDown, MessageSquareText, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatedNumber } from '@/components/data-display/animated-number';
import { DefinitionList } from '@/components/data-display/definition-list';
import { StatusBadge } from '@/components/data-display/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { PrestamoApiError, prestamosApi, type PrestamoDetalleApi } from '@/services/prestamos-api';
import { CuotaDialog } from './cuota-dialog';
import { BotonesContrato, VisorContratoPrestamo } from './loan-actions';
import { aFilas, codigoPrestamo } from './loan-utils';
import { datosPdfRegistrado } from './pdf-datos';
import { ScheduleTable } from './schedule-table';
import { useAccionesPrestamo } from './use-contrato';
import { useDescargaPdf } from './use-descarga-pdf';

/** «2026-10-18 15:42» (hora de Lima, ya convertida por el servidor) → «18 oct 2026 · 15:42». */
const fechaHora = (v: string) => `${fecha(v.slice(0, 10))} · ${v.slice(11, 16)}`;

function MensajeDialog({ p, open, onOpenChange }: { p: PrestamoDetalleApi; open: boolean; onOpenChange: (o: boolean) => void }) {
  const msg = `Hola ${p.clienteNombre}, te compartimos el resumen de tu préstamo ${codigoPrestamo(p.numero)}: ${p.plazoMeses} cuotas, importe contractual total ${money(p.totalContractual)}. Próximo vencimiento: ${p.proximoVencimiento ? fecha(p.proximoVencimiento) : 'sin cuotas pendientes'}.`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast.success('Texto copiado'); } catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.'); }
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Mensaje para el cliente"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button><Button variant="primary" onClick={copiar}>Copiar texto</Button></>}>
      <div className="mb-4 flex items-start gap-3 rounded-control bg-info-soft p-3 text-[0.8125rem] text-info-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><p>Este sistema no tiene integración de correo ni mensajería: no envía nada. Copia el texto y envíalo por tu canal habitual; adjunta el PDF descargado.</p></div>
      <label htmlFor="msg-env" className="mb-1.5 block text-sm font-medium">Vista previa del mensaje</label>
      <Textarea id="msg-env" rows={5} readOnly value={msg} />
    </Modal>
  );
}

function Cargando() {
  return (
    <div role="status" aria-label="Cargando préstamo" className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/**
 * Detalle de un préstamo registrado. Todo viene del servidor (GET /api/prestamos/{id}): cabecera, KPI, condiciones,
 * historial administrativo y cronograma con estados. No hay datos de demostración.
 */
export default function LoanDetailPage() {
  const { id = '' } = useParams();
  const [p, setP] = useState<PrestamoDetalleApi | null>(null);
  const [error, setError] = useState<PrestamoApiError | null>(null);
  const [intento, setIntento] = useState(0);
  const [numeroCuota, setNumeroCuota] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState(false);
  const { generando, descargar } = useDescargaPdf();
  const acciones = useAccionesPrestamo();

  useEffect(() => {
    let vigente = true;
    setP(null);
    setError(null);
    prestamosApi.consultar(id)
      .then((d) => { if (vigente) setP(d); })
      .catch((e: unknown) => { if (vigente) setError(e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo cargar el préstamo.')); });
    return () => { vigente = false; };
  }, [id, intento]);

  const filas = useMemo(() => (p ? aFilas(p.cuotas) : []), [p]);

  if (error) {
    const noExiste = error.codigo === 'PRESTAMO_NO_ENCONTRADO' || error.codigo === 'SIN_PERMISO';
    return (
      <EmptyState icon={TriangleAlert}
        title={noExiste ? 'Préstamo no encontrado' : 'No se pudo cargar el préstamo'}
        description={noExiste ? 'No existe o no está dentro de tu alcance. Vuelve al listado de préstamos.' : error.message}
        action={noExiste
          ? <Button asChild variant="primary"><Link to="/prestamos">Ver préstamos</Link></Button>
          : <Button variant="primary" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />
    );
  }
  if (!p) return <Cargando />;

  const cuotaAbierta = filas.find((c) => c.numero === numeroCuota) ?? null;
  const kpis = [
    { label: 'Capital original', valor: p.capital, pie: 'Monto registrado' },
    { label: 'Intereses pactados', valor: p.totalIntereses, pie: `TEA ${(p.tea * 100).toFixed(0)} %` },
    { label: 'Importe contractual total', valor: p.totalContractual, pie: `${p.plazoMeses} cuotas` },
    { label: 'Capital pendiente', valor: p.capitalPendiente, pie: p.estado === 'Cancelado' ? 'Cancelado' : 'Capital sin cuotas pagadas' },
    { label: 'Pendiente contractual', valor: p.totalPendiente, pie: p.proximoVencimiento ? `Próximo vencimiento ${fecha(p.proximoVencimiento)}` : 'Sin cuotas abiertas' }
  ];

  return (
    <>
      <PageHeader back={{ to: '/prestamos', label: 'Préstamos' }}
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{codigoPrestamo(p.numero)}<StatusBadge estado={p.estado} className="text-[0.8125rem]" /></span>}
        description={<><Link to={`/clientes/${p.clienteId}`} className="font-medium text-teal-ink hover:underline">{p.clienteNombre}</Link> · {p.agenciaNombre} · Asesor {p.asesorNombre}</>}
        actions={<>
          <Button variant="primary" onClick={() => void descargar(datosPdfRegistrado(p))} loading={generando}><FileDown className="size-4" />Descargar cronograma PDF</Button>
          <BotonesContrato id={p.id} acciones={acciones} />
          <Button onClick={() => setMensaje(true)}><MessageSquareText className="size-4" />Mensaje para el cliente</Button>
        </>} />

      {p.cuotasVencidas > 0 && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{p.cuotasVencidas === 1 ? 'Tiene 1 cuota vencida' : `Tiene ${p.cuotasVencidas} cuotas vencidas`} a la fecha de hoy (Lima).</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card lg:grid-cols-5">
        {kpis.map((k, i) => (
          <div key={k.label} className={`bg-surface p-4 sm:p-5 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <p className="text-[0.8125rem] text-ink-muted">{k.label}</p>
            <p className="mt-1 truncate text-xl font-semibold text-ink"><AnimatedNumber value={k.valor} format={money} duration={0.5} /></p>
            <p className="mt-1 text-xs text-ink-muted">{k.pie}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Condiciones" className="pb-2" />
          <CardBody className="pt-0">
            <DefinitionList items={[
              { label: 'Moneda', value: p.moneda === 'PEN' ? 'Soles (PEN)' : p.moneda },
              { label: 'Fecha de desembolso', value: fecha(p.fechaDesembolso) },
              { label: 'Primer vencimiento', value: fecha(p.fechaPrimerVencimiento) },
              { label: 'Vencimiento final', value: fecha(p.fechaUltimoVencimiento) },
              { label: 'Plazo', value: `${p.plazoMeses} meses` },
              { label: 'TEA', value: `${(p.tea * 100).toFixed(0)} %` },
              { label: 'Cuota mensual', value: money(p.cuotaMensual) },
              { label: 'Observaciones', value: p.observaciones || '—' }
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Historial administrativo" description="Eventos registrados por el sistema para este préstamo" className="pb-2" />
          <CardBody className="pt-1">
            {p.historial.length === 0
              ? <p className="py-6 text-center text-sm text-ink-muted">Sin movimientos administrativos registrados.</p>
              : <ul className="divide-y divide-line">{p.historial.map((h, i) => (
                  <li key={`${h.fechaHora}-${i}`} className="py-2.5 text-sm">
                    <p className="text-ink"><b className="font-medium">{h.tipo}</b> · {h.descripcion}</p>
                    <p className="text-xs text-ink-muted">{fechaHora(h.fechaHora)} · {h.usuario}</p>
                  </li>
                ))}</ul>}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Cronograma de cuotas" description={`${p.plazoMeses} cuotas · abre una cuota para ver su detalle`} className="pb-4" />
        <ScheduleTable filas={filas} totales={{ capital: p.capital, intereses: p.totalIntereses, total: p.totalContractual }} conEstado onSelect={setNumeroCuota} />
      </Card>

      <VisorContratoPrestamo acciones={acciones} />
      <CuotaDialog cuota={cuotaAbierta} totalCuotas={p.plazoMeses} onClose={() => setNumeroCuota(null)} />
      <MensajeDialog p={p} open={mensaje} onOpenChange={setMensaje} />
    </>
  );
}
