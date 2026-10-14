import { BRAND } from '@/lib/config';
import { cn } from '@/lib/utils';

/** Marca: una "N" con un peldaño de cobre (alusión discreta a las terrazas escalonadas de la costa). */
export function BrandMark({ className, tile = 'dark' }: { className?: string; tile?: 'dark' | 'light' }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-9 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill={tile === 'dark' ? '#10263D' : '#F5F1E8'} />
      <path d="M8 24V8h4.2l7.8 9.4V8H24v16h-4.2L12 14.6V24z" fill={tile === 'dark' ? '#F5F1E8' : '#10263D'} />
      <rect x="23" y="5" width="4" height="4" rx="1" fill="#C18A58" />
    </svg>
  );
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn('whitespace-nowrap text-[0.9375rem] font-semibold tracking-[0.16em]', className)}>
      {BRAND.nombre} <span className="font-medium opacity-70">{BRAND.sufijo}</span>
    </span>
  );
}
