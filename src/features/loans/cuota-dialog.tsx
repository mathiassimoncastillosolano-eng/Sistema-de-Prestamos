import { Info } from 'lucide-react';
import { DefinitionList } from '@/components/data-display/definition-list';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import type { FilaCronograma } from './loan-utils';

interface Props {
  cuota: FilaCronograma | null;
  totalCuotas: number;
  onClose: () => void;
}

/**
 * Detalle de una cuota con datos reales del servidor. El sistema no tiene tabla de pagos: no hay fecha de pago ni monto
 * abonado que mostrar, y así se dice. «Pendiente» es la parte de la cuota que no figura como pagada.
 */
export function CuotaDialog({ cuota, totalCuotas, onClose }: Props) {
  return (
    <Modal open={!!cuota} onOpenChange={(o) => { if (!o) onClose(); }} size="sm"
      title={cuota ? `Cuota ${cuota.numero} de ${totalCuotas}` : 'Cuota'} description={cuota ? `Vence el ${fecha(cuota.fechaVencimiento)}` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      {cuota && (
        <>
          <DefinitionList items={[
            { label: 'Estado', value: cuota.estado ? <StatusBadge estado={cuota.estado} /> : '—' },
            { label: 'Capital', value: money(cuota.capital) },
            { label: 'Interés', value: money(cuota.interes) },
            { label: 'Importe de la cuota', value: money(cuota.importeCuota), strong: true },
            { label: 'Saldo de capital tras la cuota', value: money(cuota.saldo) },
            { label: 'Importe pendiente', value: money(cuota.importePendiente ?? 0) },
            ...(cuota.estado === 'VENCIDA' ? [{ label: 'Días de atraso', value: `${cuota.diasAtraso ?? 0}` }] : []),
            { label: 'Fecha de pago', value: 'No registrada' }
          ]} />
          <p className="mt-4 flex items-start gap-2 rounded-control bg-info-soft p-3 text-[0.8125rem] text-info-ink">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            El sistema aún no registra pagos: no hay fecha ni monto abonado. El estado se deriva del cronograma guardado y de la fecha actual (Lima).
          </p>
        </>
      )}
    </Modal>
  );
}
