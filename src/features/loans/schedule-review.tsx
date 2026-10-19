import { FileDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SimulacionApi } from '@/services/prestamos-api';
import { ClienteCard, type ClienteResumen } from './client-card';
import { aFilas } from './loan-utils';
import { datosPdfSimulacion } from './pdf-datos';
import { ScheduleTable } from './schedule-table';
import { useDescargaPdf } from './use-descarga-pdf';

export interface ExtrasRevision {
  asesor?: string;
  agencia?: string;
}

/** Aviso único y discreto: distingue la simulación del préstamo registrado sin alarmar. */
export function AvisoSimulacion({ className }: { className?: string }) {
  return (
    <p role="note" className={cn('flex items-start gap-2 rounded-control border border-line bg-surface-2/60 px-3 py-2 text-[0.8125rem] text-ink-muted', className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden />
      Simulación previa al registro. El préstamo se formalizará al confirmar la operación.
    </p>
  );
}

/** Indicadores del resumen financiero (todos vienen del servidor). `completo` añade capital y primer vencimiento. */
export function ResumenFinanciero({ sim, completo = false, className }: { sim: SimulacionApi; completo?: boolean; className?: string }) {
  const items: Array<[string, string, boolean?]> = [
    ...(completo ? [['Capital solicitado', money(sim.capital)] as [string, string]] : []),
    ['Cuota mensual', money(sim.cuotaMensual), true],
    ['Intereses totales', money(sim.totalIntereses)],
    ['Total contractual', money(sim.totalContractual)],
    ['Número de cuotas', String(sim.plazoMeses)],
    ...(completo ? [['Primer vencimiento', fecha(sim.fechaPrimerVencimiento)] as [string, string]] : [])
  ];
  return (
    <dl aria-label="Resumen financiero" className={cn('num grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-3', completo ? 'lg:grid-cols-6' : 'lg:grid-cols-4', className)}>
      {items.map(([k, v, destacado]) => (
        <div key={k} className="bg-surface px-3 py-2.5">
          <dt className="text-xs text-ink-muted">{k}</dt>
          <dd className={cn('mt-0.5 truncate text-sm text-ink', destacado ? 'text-base font-semibold' : 'font-medium')}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Botón «Descargar cronograma PDF»: el documento siempre lleva el cronograma COMPLETO, no la página visible. */
export function BotonPdfSimulacion({ sim, cliente, extras }: { sim: SimulacionApi; cliente: ClienteResumen | null; extras: ExtrasRevision }) {
  const { generando, descargar } = useDescargaPdf();
  return (
    <Button onClick={() => void descargar(datosPdfSimulacion(sim, { cliente, ...extras }))} loading={generando}>
      <FileDown className="size-4" aria-hidden />Descargar cronograma PDF
    </Button>
  );
}

/**
 * Vista previa del cronograma: cliente, aviso (una vez), resumen, condiciones aplicadas y tabla paginada.
 * Las acciones (cerrar y PDF) viven en el pie del modal para que sigan accesibles aunque la tabla sea larga.
 */
export function ScheduleReviewModal({ open, onOpenChange, sim, cliente, extras }: { open: boolean; onOpenChange: (o: boolean) => void; sim: SimulacionApi | null; cliente: ClienteResumen | null; extras: ExtrasRevision }) {
  return (
    <Modal open={open && !!sim} onOpenChange={onOpenChange} size="xl" title="Cronograma de cuotas"
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
        {sim && <BotonPdfSimulacion sim={sim} cliente={cliente} extras={extras} />}
      </>}>
      {sim && (
        <div className="space-y-4">
          {cliente && <ClienteCard cliente={cliente} />}
          <AvisoSimulacion />
          <ResumenFinanciero sim={sim} completo />
          <p className="num text-xs text-ink-muted">
            Desembolso {fecha(sim.fechaDesembolso)} · {sim.plazoMeses} cuotas cada 30 días · TEA {(sim.tea * 100).toFixed(0)} %
          </p>
          <div className="overflow-hidden rounded-control border border-line">
            <ScheduleTable
              filas={aFilas(sim.cuotas)}
              totales={{ capital: sim.capital, intereses: sim.totalIntereses, total: sim.totalContractual }}
              etiqueta="Cronograma de cuotas simulado"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
