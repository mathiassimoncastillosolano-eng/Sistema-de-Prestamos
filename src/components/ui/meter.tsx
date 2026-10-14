import { motion } from 'motion/react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  tone?: 'teal' | 'warning' | 'danger' | 'success' | 'brand';
  label: string;
  className?: string;
}

const tonos = { teal: 'bg-teal', warning: 'bg-warning', danger: 'bg-danger', success: 'bg-success', brand: 'bg-brand' };

/** Barra de progreso accesible (role=progressbar). La animación es solo un refuerzo: el valor siempre se lee. */
export function Meter({ value, tone = 'teal', label, className }: Props) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <motion.div className={cn('h-full rounded-full', tonos[tone])} initial={false} animate={{ width: `${v}%` }} transition={{ duration: DUR.slow, ease: EASE }} />
    </div>
  );
}
