import { Eye } from 'lucide-react';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fecha } from '@/lib/dates';
import { estadoCuota, resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Prestamo } from '@/types';

/**
 * Cronograma de cuotas (solo consulta). Muestra el cronograma ORIGINAL: capital, interés, importe de la cuota
 * y saldo de capital programado. El estado es informativo y se calcula desde las fechas; no hay acciones de cobro.
 * En móvil se presenta como tarjetas.
 */
export function ScheduleTable({ prestamo, onSelect }: { prestamo: Prestamo; onSelect: (n: number) => void }) {
  const escritorio = useMediaQuery('(min-width: 768px)');
  const r = resumen(prestamo);

  if (!escritorio) {
    return (
      <ol className="divide-y divide-line" aria-label="Cronograma de cuotas">
        {prestamo.cronograma.map((c) => {
          const e = estadoCuota(c);
          return (
            <li key={c.n} className={cn(e === 'Vencida' && 'bg-danger-soft/50')}>
              <button type="button" onClick={() => onSelect(c.n)} aria-label={`Ver detalle de la cuota ${c.n}`} className="block w-full space-y-2 p-4 text-left">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-ink">Cuota {c.n} · {fecha(c.fecha)}</p><StatusBadge estado={e} /></div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-ink-muted">Capital</dt><dd className="num text-sm text-ink">{money(c.capital)}</dd></div>
                  <div><dt className="text-ink-muted">Interés</dt><dd className="num text-sm text-ink">{money(c.interes)}</dd></div>
                  <div><dt className="text-ink-muted">Cuota</dt><dd className="num text-sm font-semibold text-ink">{money(c.cuota)}</dd></div>
                </dl>
                <p className="num text-xs text-ink-muted">Saldo de capital programado {money(c.saldo)}</p>
              </button>
            </li>
          );
        })}
        <li className="num space-y-1 bg-surface-2/60 p-4 text-sm"><div className="flex justify-between"><span className="text-ink-muted">Intereses pactados</span><b>{money(r.interes)}</b></div><div className="flex justify-between"><span className="text-ink-muted">Importe contractual total</span><b>{money(r.total)}</b></div></li>
      </ol>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm" aria-label="Cronograma de cuotas">
        <thead className="bg-surface-2/70 text-left text-xs font-medium text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5">N.º</th><th scope="col" className="px-4 py-2.5">Vence</th>
            {['Capital', 'Interés', 'Cuota', 'Saldo de capital'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 text-right">{h}</th>)}
            <th scope="col" className="px-4 py-2.5">Estado</th><th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Detalle</span></th>
          </tr>
        </thead>
        <tbody>
          {prestamo.cronograma.map((c) => {
            const e = estadoCuota(c);
            return (
              <tr key={c.n} className={cn('border-t border-line', e === 'Vencida' && 'bg-danger-soft/50')}>
                <td className="num whitespace-nowrap px-4 py-2.5 font-medium text-ink">{c.n}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{fecha(c.fecha)}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-right">{money(c.capital)}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-right">{money(c.interes)}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">{money(c.cuota)}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-right text-ink-muted">{money(c.saldo)}</td>
                <td className="px-4 py-2.5"><StatusBadge estado={e} /></td>
                <td className="px-2 py-1.5"><Button variant="ghost" size="iconSm" onClick={() => onSelect(c.n)} aria-label={`Ver detalle de la cuota ${c.n}`}><Eye className="size-4" /></Button></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="num border-t-2 border-line-strong bg-surface-2/60 font-semibold text-ink">
            <td colSpan={2} className="px-4 py-3">Totales</td>
            <td className="px-4 py-3 text-right">{money(prestamo.capital)}</td><td className="px-4 py-3 text-right">{money(r.interes)}</td>
            <td className="px-4 py-3 text-right">{money(r.total)}</td><td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
