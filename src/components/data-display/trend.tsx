import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Variación porcentual; null = no calculable (no se muestra nada inventado). */
  valor: number | null;
  /** 'up-good': subir es positivo (p. ej. desembolsos). 'neutral': solo informativo (capital pendiente). */
  modo?: 'up-good' | 'neutral';
  className?: string;
}

export function Trend({ valor, modo = 'up-good', className }: Props) {
  if (valor === null) return null;
  const sube = valor >= 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  const tono = modo === 'neutral' ? 'bg-neutral-soft text-neutral-ink' : sube ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink';
  return (
    <span className={cn('num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tono, className)}>
      <Icono className="size-3" aria-hidden />
      <span className="sr-only">{sube ? 'Aumento de ' : 'Disminución de '}</span>
      {Math.abs(valor).toFixed(0)} %
    </span>
  );
}
