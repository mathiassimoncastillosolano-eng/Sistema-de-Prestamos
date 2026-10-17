import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fecha } from '@/lib/dates';
import { resumen } from '@/lib/finance';
import { money } from '@/lib/format';
import type { Prestamo } from '@/types';

/**
 * Cronograma contractual de cuotas (solo consulta): N.º, vencimiento, capital, interés, importe de la cuota y saldo de capital
 * programado. NO muestra estados de pago (pagada, vencida, pendiente…): el sistema aún no registra ni concilia pagos.
 * Se reutiliza en el detalle del préstamo (con `onSelect` para abrir el detalle de cada cuota) y en la revisión de la
 * solicitud (cronograma proyectado, sin `onSelect`). En móvil se presenta como tarjetas.
 */
export function ScheduleTable({ prestamo, onSelect }: { prestamo: Pick<Prestamo, 'cronograma' | 'capital'>; onSelect?: (n: number) => void }) {
  const escritorio = useMediaQuery('(min-width: 768px)');
  const r = resumen(prestamo);

  if (!escritorio) {
    return (
      <ol className="divide-y divide-line" aria-label="Cronograma de cuotas">
        {prestamo.cronograma.map((c) => {
          const contenido = (
            <>
              <p className="text-sm font-medium text-ink">Cuota {c.n} · {fecha(c.fecha)}</p>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-ink-muted">Capital</dt><dd className="num text-sm text-ink">{money(c.capital)}</dd></div>
                <div><dt className="text-ink-muted">Interés</dt><dd className="num text-sm text-ink">{money(c.interes)}</dd></div>
                <div><dt className="text-ink-muted">Cuota</dt><dd className="num text-sm font-semibold text-ink">{money(c.cuota)}</dd></div>
              </dl>
              <p className="num text-xs text-ink-muted">Saldo de capital programado {money(c.saldo)}</p>
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

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm" aria-label="Cronograma de cuotas">
        <thead className="bg-surface-2/70 text-left text-xs font-medium text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5">N.º</th><th scope="col" className="px-4 py-2.5">Vence</th>
            {['Capital', 'Interés', 'Cuota', 'Saldo de capital'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 text-right">{h}</th>)}
            {onSelect && <th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Detalle</span></th>}
          </tr>
        </thead>
        <tbody>
          {prestamo.cronograma.map((c) => (
            <tr key={c.n} className="border-t border-line">
              <td className="num whitespace-nowrap px-4 py-2.5 font-medium text-ink">{c.n}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{fecha(c.fecha)}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 text-right">{money(c.capital)}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 text-right">{money(c.interes)}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">{money(c.cuota)}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 text-right text-ink-muted">{money(c.saldo)}</td>
              {onSelect && <td className="px-2 py-1.5"><Button variant="ghost" size="iconSm" onClick={() => onSelect(c.n)} aria-label={`Ver detalle de la cuota ${c.n}`}><Eye className="size-4" /></Button></td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="num border-t-2 border-line-strong bg-surface-2/60 font-semibold text-ink">
            <td colSpan={2} className="px-4 py-3">Totales</td>
            <td className="px-4 py-3 text-right">{money(prestamo.capital)}</td><td className="px-4 py-3 text-right">{money(r.interes)}</td>
            <td className="px-4 py-3 text-right">{money(r.total)}</td><td colSpan={onSelect ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
