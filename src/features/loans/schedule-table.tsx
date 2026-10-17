import { Eye } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fecha } from '@/lib/dates';
import { cuotaParcial, estadoCuota, resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Cuota, Prestamo } from '@/types';

interface Props {
  prestamo: Pick<Prestamo, 'cronograma' | 'capital'> & Partial<Pick<Prestamo, 'etapa'>>;
  /** Abre el detalle de una cuota (en la tabla se muestra un botón por fila). */
  onSelect?: (n: number) => void;
  /**
   * Cronograma proyectado (simulación o solicitud sin desembolsar): aún no hay cuotas pendientes, vencidas ni pagadas,
   * así que no se muestra la columna de estado. Se activa solo si el préstamo tiene `etapa`.
   */
  proyectado?: boolean;
}

/** Texto de apoyo bajo el estado cuando la cuota tiene un pago parcial (nunca aparece como «Pagada»). */
const detalleParcial = (c: Cuota) => (cuotaParcial(c) ? `Cubierto ${money(c.cubierto)}` : null);

/**
 * Cronograma contractual de cuotas: N.º, vencimiento, capital, interés, cuota, saldo de capital programado y ESTADO de cada
 * cuota (Pendiente, Próxima a vencer, Vencida o Pagada, calculado con `estadoCuota`; demostración con datos mock).
 * Se reutiliza en el detalle del préstamo (con `onSelect`) y en la revisión de la solicitud (cronograma proyectado, sin estado).
 * En escritorio la tabla ocupa el ancho disponible sin scroll horizontal; en móvil se presenta como tarjetas.
 */
export function ScheduleTable({ prestamo, onSelect, proyectado }: Props) {
  const escritorio = useMediaQuery('(min-width: 768px)');
  const r = resumen(prestamo);
  const sinEstado = proyectado || !!prestamo.etapa;

  if (!escritorio) {
    return (
      <ol className="divide-y divide-line" aria-label="Cronograma de cuotas">
        {prestamo.cronograma.map((c) => {
          const estado = estadoCuota(c);
          const parcial = detalleParcial(c);
          const contenido = (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">Cuota {c.n} · {fecha(c.fecha)}</p>
                {!sinEstado && <StatusBadge estado={estado} className="shrink-0" />}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-ink-muted">Capital</dt><dd className="num text-sm text-ink">{money(c.capital)}</dd></div>
                <div><dt className="text-ink-muted">Interés</dt><dd className="num text-sm text-ink">{money(c.interes)}</dd></div>
                <div><dt className="text-ink-muted">Cuota</dt><dd className="num text-sm font-semibold text-ink">{money(c.cuota)}</dd></div>
              </dl>
              <p className="num text-xs text-ink-muted">Saldo de capital programado {money(c.saldo)}{!sinEstado && parcial ? ` · ${parcial}` : ''}</p>
            </>
          );
          return (
            <li key={c.n}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(c.n)} aria-label={`Ver detalle de la cuota ${c.n}`} className="block w-full space-y-2 p-4 text-left">{contenido}</button>
                : <div className="space-y-2 p-4">{contenido}</div>}
            </li>
          );
        })}
        <li className="num space-y-1 bg-surface-2/60 p-4 text-sm"><div className="flex justify-between"><span className="text-ink-muted">Intereses pactados</span><b>{money(r.interes)}</b></div><div className="flex justify-between"><span className="text-ink-muted">Importe contractual total</span><b>{money(r.total)}</b></div></li>
      </ol>
    );
  }

  const celda = 'whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4';
  return (
    <table className="w-full border-collapse text-sm" aria-label="Cronograma de cuotas">
      <thead className="bg-surface-2/70 text-left text-xs font-medium text-ink-muted">
        <tr>
          <th scope="col" className={celda}>N.º</th><th scope="col" className={celda}>Vence</th>
          {[['Capital', 'Capital de la cuota'], ['Interés', 'Interés de la cuota'], ['Cuota', 'Importe de la cuota'], ['Saldo cap.', 'Saldo de capital programado tras esta cuota']].map(([h, t]) => <th key={h} scope="col" title={t} className={cn(celda, 'text-right')}>{h}</th>)}
          {!sinEstado && <th scope="col" className={celda}>Estado</th>}
          {onSelect && <th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Detalle</span></th>}
        </tr>
      </thead>
      <tbody>
        {prestamo.cronograma.map((c) => {
          const parcial = detalleParcial(c);
          return (
            <tr key={c.n} className="border-t border-line transition-colors hover:bg-surface-2/50">
              <td className={cn(celda, 'num font-medium text-ink')}>{c.n}</td>
              <td className={celda}>{fecha(c.fecha)}</td>
              <td className={cn(celda, 'num text-right')}>{money(c.capital)}</td>
              <td className={cn(celda, 'num text-right')}>{money(c.interes)}</td>
              <td className={cn(celda, 'num text-right font-semibold text-ink')}>{money(c.cuota)}</td>
              <td className={cn(celda, 'num text-right text-ink-muted')}>{money(c.saldo)}</td>
              {!sinEstado && (
                <td className={celda}>
                  <div className="flex flex-col items-start gap-0.5">
                    <StatusBadge estado={estadoCuota(c)} />
                    {parcial && <span className="num text-xs text-ink-muted" title="Pago parcial: la cuota no está completamente cubierta">{parcial}</span>}
                  </div>
                </td>
              )}
              {onSelect && <td className="px-2 py-1.5"><Button variant="ghost" size="iconSm" onClick={() => onSelect(c.n)} aria-label={`Ver detalle de la cuota ${c.n}`}><Eye className="size-4" /></Button></td>}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="num border-t-2 border-line-strong bg-surface-2/60 font-semibold text-ink">
          <td colSpan={2} className={celda}>Totales</td>
          <td className={cn(celda, 'text-right')}>{money(prestamo.capital)}</td><td className={cn(celda, 'text-right')}>{money(r.interes)}</td>
          <td className={cn(celda, 'text-right')}>{money(r.total)}</td><td colSpan={1 + (sinEstado ? 0 : 1) + (onSelect ? 1 : 0)} />
        </tr>
      </tfoot>
    </table>
  );
}
