import { FileDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { SimulacionApi } from '@/services/prestamos-api';
import { aFilas } from './loan-utils';
import { datosPdfSimulacion } from './pdf-datos';
import { ScheduleTable } from './schedule-table';
import { useDescargaPdf } from './use-descarga-pdf';

export interface ExtrasRevision {
  clienteNombre?: string;
  clienteDocumento?: string;
  asesor?: string;
  agencia?: string;
}

/**
 * Revisión del cronograma que se registraría: aviso de simulación no registrada, cifras clave y tabla completa, con la
 * descarga del PDF. Se usa en la vista previa del paso de condiciones y en la confirmación, para que ambas muestren lo mismo.
 */
export function ScheduleReview({ sim, extras }: { sim: SimulacionApi; extras: ExtrasRevision }) {
  const { generando, descargar } = useDescargaPdf();
  const datos = [
    ['Cuota mensual', money(sim.cuotaMensual)],
    ['Total de intereses', money(sim.totalIntereses)],
    ['Total contractual', money(sim.totalContractual)],
    ['Primera cuota', fecha(sim.fechaPrimerVencimiento)]
  ];
  return (
    <div className="space-y-4">
      <p role="note" className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2.5 text-[0.8125rem] font-medium text-warning-ink">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Simulación no registrada: el préstamo todavía no existe y no tiene código. Se registra al confirmar.
      </p>
      <dl className="num grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line text-sm sm:grid-cols-4">
        {datos.map(([k, v]) => (
          <div key={k} className="bg-surface p-3"><dt className="text-xs text-ink-muted">{k}</dt><dd className="mt-0.5 font-semibold text-ink">{v}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-ink-muted">
        Desembolso {fecha(sim.fechaDesembolso)} · {sim.plazoMeses} cuotas mensuales · TEA {(sim.tea * 100).toFixed(0)} %
      </p>
      <div className="overflow-hidden rounded-control border border-line">
        <ScheduleTable
          filas={aFilas(sim.cuotas)}
          totales={{ capital: sim.capital, intereses: sim.totalIntereses, total: sim.totalContractual }}
          etiqueta="Cronograma de cuotas simulado"
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => void descargar(datosPdfSimulacion(sim, extras))} loading={generando}>
          <FileDown className="size-4" />Descargar cronograma PDF
        </Button>
      </div>
    </div>
  );
}

export function ScheduleReviewModal({ open, onOpenChange, sim, extras }: { open: boolean; onOpenChange: (o: boolean) => void; sim: SimulacionApi | null; extras: ExtrasRevision }) {
  return (
    <Modal open={open && !!sim} onOpenChange={onOpenChange} size="xl" title="Cronograma de cuotas"
      description={sim ? `${money(sim.capital)} a ${sim.plazoMeses} meses` : undefined}
      footer={<Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>}>
      {sim && <ScheduleReview sim={sim} extras={extras} />}
    </Modal>
  );
}
