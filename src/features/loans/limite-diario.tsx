import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Meter } from '@/components/ui/meter';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LimiteDiarioApi } from '@/services/prestamos-api';
import { estadoLimiteDiario, type EstadoLimiteDiario } from './loan-utils';

interface Props {
  limite: LimiteDiarioApi | null;
  error: string | null;
  onReintentar: () => void;
}

const ESTADOS: Record<EstadoLimiteDiario, { etiqueta: string; tono: 'teal' | 'warning' | 'danger' }> = {
  disponible: { etiqueta: 'Disponible', tono: 'teal' },
  cerca: { etiqueta: 'Cerca del límite', tono: 'warning' },
  insuficiente: { etiqueta: 'Saldo insuficiente', tono: 'danger' },
  agotado: { etiqueta: 'Límite agotado', tono: 'danger' }
};

function mensaje(estado: EstadoLimiteDiario, l: LimiteDiarioApi) {
  switch (estado) {
    case 'agotado':
      return `Alcanzaste tu límite diario de ${money(l.limite)}. Podrás registrar nuevos préstamos mañana.`;
    case 'insuficiente':
      return `No puedes iniciar una nueva solicitud hoy: te quedan ${money(l.disponible)} y el monto mínimo de un préstamo es ${money(l.capitalMinimo)}.`;
    case 'cerca':
      return `Te quedan ${money(l.disponible)} para hoy. Ningún préstamo nuevo puede pasar de ese monto.`;
    default:
      return 'Puedes iniciar una nueva solicitud.';
  }
}

/** Límite diario de colocación del asesor (S/ 50,000 por día). Se ve en todos los pasos de la solicitud. */
export function LimiteDiario({ limite, error, onReintentar }: Props) {
  if (error && !limite) {
    return (
      <Card aria-label="Límite diario de colocación" role="alert" className="mb-5 border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
        <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4" aria-hidden />No se pudo consultar tu límite diario</p>
        <p className="mt-0.5 text-[0.8125rem]">{error} El servidor lo valida igual al registrar.</p>
        <button type="button" onClick={onReintentar} className="mt-1 text-[0.8125rem] font-medium underline">Reintentar</button>
      </Card>
    );
  }

  if (!limite) {
    return <p role="status" aria-label="Límite diario de colocación" className="mb-5 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">Consultando tu límite diario…</p>;
  }

  const estado = estadoLimiteDiario(limite);
  const { etiqueta, tono } = ESTADOS[estado];
  const uso = (limite.colocadoHoy / limite.limite) * 100;

  return (
    <Card aria-label="Límite diario de colocación" className="mb-5 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-ink">Límite diario de colocación <span className="num font-normal text-ink-muted">· {money(limite.limite)}</span></h2>
        <Badge tone={tono} dot>{etiqueta}</Badge>
      </div>
      <dl className="num mt-2.5 grid gap-1.5 sm:grid-cols-3 sm:gap-3">
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Colocado hoy</dt>
          <dd className="truncate sm:mt-0.5 text-sm font-semibold text-ink">{money(limite.colocadoHoy)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Disponible hoy</dt>
          <dd className={cn('truncate sm:mt-0.5 text-sm font-semibold', tono === 'danger' ? 'text-danger-ink' : 'text-teal-ink')}>{money(limite.disponible)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
          <dt className="text-xs text-ink-muted">Mínimo por préstamo</dt>
          <dd className="truncate sm:mt-0.5 text-sm font-semibold text-ink">{money(limite.capitalMinimo)}</dd>
        </div>
      </dl>
      <Meter value={uso} tone={tono} label={`Uso del límite diario: ${Math.round(uso)} %`} className="mt-2.5" />
      <p role={tono === 'danger' ? 'alert' : undefined} className={cn('mt-2 text-[0.8125rem]', tono === 'danger' ? 'font-medium text-danger-ink' : tono === 'warning' ? 'text-warning-ink' : 'text-ink-muted')}>
        {mensaje(estado, limite)}
      </p>
    </Card>
  );
}
