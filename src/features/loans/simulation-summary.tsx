import { Calculator, CalendarRange, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SimulacionApi } from '@/services/prestamos-api';
import type { EstadoSimulacion } from './use-simulacion';

interface Props {
  /** Resultado del servidor para los valores actuales (null si aún no hay datos válidos). */
  sim: SimulacionApi | null;
  estado: EstadoSimulacion;
  /** TEA vigente según el servidor, para mostrarla aunque no haya simulación. */
  tea?: number;
  /** Mensaje del servidor si la simulación falló. */
  errorMensaje?: string;
  /** Texto cuando los datos aún no son válidos (sin errores en rojo antes de que el usuario escriba). */
  ayuda?: string;
  /** Abre el cronograma completo. Solo disponible con datos válidos y simulación vigente. */
  onVerCronograma: () => void;
  onReintentar?: () => void;
  className?: string;
}

/**
 * Tarjeta lateral «Resumen de la simulación». Muestra únicamente lo que calcula el servidor (misma fórmula que el registro).
 * Con datos vacíos o inválidos no presenta cifras: guiones y una indicación neutra, sin errores ni resultados simulados.
 */
export function SimulationSummary({ sim, estado, tea, errorMensaje, ayuda, onVerCronograma, onReintentar, className }: Props) {
  const mostrar = estado === 'lista' && !!sim;
  const valor = (n: number | undefined) => (mostrar && n !== undefined ? money(n) : '—');
  return (
    <section aria-label="Resumen de la simulación" className={cn('overflow-hidden rounded-card border border-line bg-surface shadow-card', className)}>
      <div className="bg-side px-5 pb-5 pt-4 text-side-ink">
        <h2 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-side-muted"><Calculator className="size-4 text-side-accent" aria-hidden />Resumen de la simulación</h2>
        <div aria-live="polite" aria-atomic="true">
          <p className="mt-4 text-xs text-side-muted">Cuota mensual estimada</p>
          <p className={cn('num mt-1 text-[2rem] font-semibold leading-9', mostrar ? 'text-white' : 'text-side-muted')}>{valor(sim?.cuotaMensual)}</p>
          <p className="mt-1 text-xs text-side-muted">
            {estado === 'cargando' ? 'Calculando…' : mostrar ? `${sim.plazoMeses} cuotas mensuales iguales` : 'Sin estimación'}
          </p>
        </div>
      </div>

      <div className="p-5">
        <dl aria-live="polite" className="num space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-ink-muted">Intereses estimados</dt><dd className="text-ink">{valor(sim?.totalIntereses)}</dd></div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3"><dt className="font-medium text-ink">Total contractual</dt><dd className="text-base font-semibold text-ink">{valor(sim?.totalContractual)}</dd></div>
        </dl>

        <dl className="num mt-4 grid grid-cols-3 gap-2 rounded-control bg-surface-2/70 p-3 text-xs">
          <div><dt className="text-ink-muted">Monto</dt><dd className="mt-0.5 truncate text-[0.8125rem] font-medium text-ink">{mostrar ? money(sim.capital) : '—'}</dd></div>
          <div><dt className="text-ink-muted">Plazo</dt><dd className="mt-0.5 text-[0.8125rem] font-medium text-ink">{mostrar ? `${sim.plazoMeses} meses` : '—'}</dd></div>
          <div><dt className="text-ink-muted">TEA</dt><dd className="mt-0.5 text-[0.8125rem] font-medium text-ink">{sim ? `${(sim.tea * 100).toFixed(0)} %` : tea !== undefined ? `${(tea * 100).toFixed(0)} %` : '—'}</dd></div>
        </dl>

        <Button className="mt-4 w-full" onClick={onVerCronograma} disabled={!mostrar}>
          <CalendarRange className="size-4" />Ver cronograma de cuotas
        </Button>

        {estado === 'error' && (
          <div role="alert" className="mt-3 text-[0.8125rem] font-medium text-danger-ink">
            <p>{errorMensaje ?? 'No se pudo calcular el cronograma.'}</p>
            {onReintentar && <button type="button" onClick={onReintentar} className="mt-1 underline">Reintentar</button>}
          </div>
        )}
        {estado === 'inactiva' && ayuda && <p role="status" className="mt-3 text-[0.8125rem] text-ink-muted">{ayuda}</p>}
        <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Cálculo del servidor con las condiciones vigentes. El préstamo solo existe al registrarlo.</p>
      </div>
    </section>
  );
}
