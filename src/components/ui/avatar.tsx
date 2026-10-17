import { Building2 } from 'lucide-react';
import { cn, iniciales } from '@/lib/utils';
import type { TipoCliente } from '@/types';

const TONOS = ['bg-teal-soft text-teal-ink', 'bg-navy-soft text-navy-ink', 'bg-info-soft text-info-ink', 'bg-tint text-tint-ink', 'bg-neutral-soft text-neutral-ink'];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const tamanos = { sm: 'size-8 text-[0.6875rem]', md: 'size-9 text-xs', lg: 'size-11 text-sm', xl: 'size-14 text-lg' };

export function Avatar({ nombre, tipo, size = 'md', className }: { nombre: string; tipo?: TipoCliente; size?: keyof typeof tamanos; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', tamanos[size], TONOS[hash(nombre) % TONOS.length], className)}>
      {tipo === 'RUC 20' ? <Building2 className={size === 'xl' ? 'size-6' : 'size-4'} /> : iniciales(nombre)}
    </span>
  );
}
