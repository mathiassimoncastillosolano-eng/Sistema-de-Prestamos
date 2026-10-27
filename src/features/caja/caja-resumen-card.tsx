import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Meter } from '@/components/ui/meter';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CajaResumenApi } from '@/services/caja-api';
import { estadoCaja, type EstadoCaja, type Tono } from './caja-utils';

interface Props {
  caja: CajaResumenApi | null;
  error: string | null;
  onReintentar: () => void;
  /** Versión corta (solicitud de préstamo): sin la fila de reposición autorizada. */
  compacta?: boolean;
}

const ESTADOS: Record<EstadoCaja, { etiqueta: string; tono: Tono }> = {
  normal: { etiqueta: 'Efectivo disponible', tono: 'teal' },
  baja: { etiqueta: 'Efectivo bajo', tono: 'warning' },
  vacia: { etiqueta: 'Sin efectivo', tono: 'danger' },
  llena: { etiqueta: 'Caja en su límite', tono: 'info' },
  cerrada: { etiqueta: 'Caja cerrada', tono: 'danger' }
};

function mensaje(e: EstadoCaja, c: CajaResumenApi) {
  switch (e) {
    case 'cerrada': return 'Tu caja está cerrada: no se pueden registrar préstamos ni pedir reposiciones.';
    case 'vacia': return 'No tienes efectivo para desembolsar. Solicita una reposición a gerencia.';
    case 'baja': return `Te quedan ${money(c.saldo)}. Ningún préstamo nuevo puede pasar de ese monto.`;
    case 'llena': return `Tu caja está en su límite de ${money(c.limite)}: no puedes pedir más efectivo.`;
    default: return 'Puedes registrar préstamos hasta el efectivo que tienes en caja.';
  }
}

/**
 * Caja del asesor. Efectivo = dinero realmente recibido y contabilizado. Lo que gerencia autorizó y aún no llegó se muestra
 * aparte y NUNCA se suma al efectivo.
 */
export function CajaResumen({ caja, error, onReintentar, compacta }: Props) {
  if (error && !caja) {
    return (
      <Card aria-label="Caja del asesor" role="alert" className="mb-5 border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
        <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4" aria-hidden />No se pudo consultar tu caja</p>
        <p className="mt-0.5 text-[0.8125rem]">{error} El servidor valida el efectivo igual al registrar.</p>
        <button type="button" onClick={onReintentar} className="mt-1 text-[0.8125rem] font-medium underline">Reintentar</button>
      </Card>
    );
  }
  if (!caja) {
    return <p role="status" aria-label="Caja del asesor" className="mb-5 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">Consultando tu caja…</p>;
  }

  const estado = estadoCaja(caja);
  const { etiqueta, tono } = ESTADOS[estado];
  const uso = caja.limite > 0 ? (caja.saldo / caja.limite) * 100 : 0;
  const peligro = tono === 'danger';

  return (
    <Card aria-label="Caja del asesor" className="mb-5 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-ink">Mi caja <span className="num font-normal text-ink-muted">· límite {money(caja.limite)}</span></h2>
        <Badge tone={tono} dot>{etiqueta}</Badge>
      </div>
      <dl className={cn('num mt-2.5 grid gap-1.5 sm:gap-3', compacta ? 'sm:grid-cols-2' : 'sm:grid-cols-4')}>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Efectivo en caja</dt>
          <dd className={cn('truncate text-sm font-semibold sm:mt-0.5', peligro ? 'text-danger-ink' : 'text-teal-ink')}>{money(caja.saldo)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Puedes solicitar hasta</dt>
          <dd className="truncate text-sm font-semibold text-ink sm:mt-0.5">{money(caja.capacidadLibre)}</dd>
        </div>
        {!compacta && (
          <>
            <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
              <dt className="text-xs text-ink-muted">Autorizado, aún sin recibir</dt>
              <dd className="truncate text-sm font-semibold text-ink sm:mt-0.5">{money(caja.autorizadoPendienteRecepcion)}</dd>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
              <dt className="text-xs text-ink-muted">Si llega todo lo autorizado</dt>
              <dd className="truncate text-sm font-semibold text-ink sm:mt-0.5">{money(caja.saldoProyectado)}</dd>
            </div>
          </>
        )}
      </dl>
      <Meter value={uso} tone={tono === 'teal' ? 'teal' : tono === 'warning' ? 'warning' : tono === 'info' ? 'brand' : 'danger'} label={`Efectivo en caja: ${Math.round(uso)} % del límite`} className="mt-2.5" />
      <p role={peligro ? 'alert' : undefined} className={cn('mt-2 text-[0.8125rem]', peligro ? 'font-medium text-danger-ink' : tono === 'warning' ? 'text-warning-ink' : 'text-ink-muted')}>
        {mensaje(estado, caja)}
      </p>
      {!compacta && caja.autorizadoPendienteRecepcion > 0 && (
        <p className="mt-1 text-xs text-ink-muted">Lo autorizado todavía no es efectivo: entra a tu caja solo cuando registras la recepción.</p>
      )}
    </Card>
  );
}
