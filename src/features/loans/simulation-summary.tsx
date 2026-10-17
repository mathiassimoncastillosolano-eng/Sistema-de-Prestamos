import { Calculator, Info } from 'lucide-react';
import { money } from '@/lib/format';
import type { Simulacion } from '@/lib/finance';
import { CFG } from '@/lib/config';
import { cn } from '@/lib/utils';

interface Props {
  /** Simulación calculada con los valores actuales; null si no se puede calcular. */
  sim: Simulacion | null;
  monto: number;
  plazo: number;
  /** false cuando los datos no cumplen las reglas de negocio: no se muestra ningún resultado como válido. */
  valido: boolean;
  /** Motivo comprensible cuando los datos no son válidos. */
  motivo?: string;
  className?: string;
}

/**
 * Tarjeta lateral «Resumen de la simulación». Solo presenta lo que calcula `simular()` (lib/finance.ts) en el navegador con
 * datos ficticios: no consulta ningún servicio ni crea operaciones. La cuota es el dato principal; intereses y total, secundarios.
 */
export function SimulationSummary({ sim, monto, plazo, valido, motivo, className }: Props) {
  const mostrar = valido && !!sim;
  const valor = (n: number | undefined) => (mostrar && n !== undefined ? money(n) : '—');
  return (
    <section aria-label="Resumen de la simulación" className={cn('overflow-hidden rounded-card border border-line bg-surface shadow-card', className)}>
      <div className="bg-side px-5 pb-5 pt-4 text-side-ink">
        <h2 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-side-muted"><Calculator className="size-4 text-side-accent" aria-hidden />Resumen de la simulación</h2>
        <div aria-live="polite" aria-atomic="true">
          <p className="mt-4 text-xs text-side-muted">Cuota mensual estimada</p>
          <p className={cn('num mt-1 text-[2rem] font-semibold leading-9', mostrar ? 'text-white' : 'text-side-muted')}>{valor(sim?.cuota)}</p>
          <p className="mt-1 text-xs text-side-muted">{mostrar ? `${plazo} cuotas mensuales iguales` : 'Sin estimación'}</p>
        </div>
      </div>

      <div className="p-5">
        <dl aria-live="polite" className="num space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-ink-muted">Intereses estimados</dt><dd className="text-ink">{valor(sim?.interes)}</dd></div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3"><dt className="font-medium text-ink">Total contractual estimado</dt><dd className="text-base font-semibold text-ink">{valor(sim?.total)}</dd></div>
        </dl>

        <dl className="num mt-4 grid grid-cols-3 gap-2 rounded-control bg-surface-2/70 p-3 text-xs">
          <div><dt className="text-ink-muted">Monto</dt><dd className="mt-0.5 truncate text-[0.8125rem] font-medium text-ink">{mostrar ? money(monto) : '—'}</dd></div>
          <div><dt className="text-ink-muted">Plazo</dt><dd className="mt-0.5 text-[0.8125rem] font-medium text-ink">{mostrar ? `${plazo} meses` : '—'}</dd></div>
          <div><dt className="text-ink-muted">TEA</dt><dd className="mt-0.5 text-[0.8125rem] font-medium text-ink">{(CFG.tea * 100).toFixed(0)} %</dd></div>
        </dl>

        {!mostrar && <p role="status" className="mt-4 text-[0.8125rem] font-medium text-warning-ink">{motivo ?? 'Ingresa un monto y un plazo válidos para ver la estimación.'}</p>}
        <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Estimación referencial. Las condiciones definitivas se muestran en la revisión.</p>
      </div>
    </section>
  );
}
