import { CFG } from '@/lib/config';
import { money } from '@/lib/format';
import { Meter } from '@/components/ui/meter';

/** Uso del límite de endeudamiento (S/ 10,000 de capital pendiente por cliente en toda la empresa). */
export function LimitMeter({ deuda, label = 'Uso del límite', showText = true }: { deuda: number; label?: string; showText?: boolean }) {
  const uso = (deuda / CFG.limite) * 100;
  const tono = uso > 100 ? 'danger' : uso >= CFG.alertaLimite * 100 ? 'warning' : 'teal';
  return (
    <div className="min-w-28">
      <Meter value={uso} tone={tono} label={`${label}: ${Math.round(uso)} %`} />
      {showText && <p className="num mt-1 text-xs text-ink-muted">{money(Math.max(0, CFG.limite - deuda))} disponibles</p>}
    </div>
  );
}
