import { BRAND } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * IDENTIDAD VISUAL — único punto de la app donde se dibuja el logo.
 *
 * ⚠ PROVISIONAL: este símbolo (una "P" con barras ascendentes) es un marcador de posición hecho con la paleta de marca,
 * porque la imagen oficial de PerúCred no se recibió junto al ZIP. Para sustituirlo por el logo oficial basta con editar
 * este archivo (colocar el archivo en /public/brand/ y devolver un <img> en BrandMark y/o BrandName); ningún otro
 * componente dibuja la marca, así que el cambio se propaga a login, menú, pantallas de sesión, PDF e impresión.
 */
export function BrandMark({ className, tile = 'dark' }: { className?: string; tile?: 'dark' | 'light' }) {
  const claro = tile === 'light';
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={BRAND.nombre} className={cn('size-9 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill={claro ? '#FFFFFF' : '#12365A'} />
      <path d="M10.5 25.5V7.5h7a5.2 5.2 0 0 1 0 10.4h-7" fill="none" stroke={claro ? '#12365A' : '#FFFFFF'} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="22.2" width="3.2" height="3.3" rx="1" fill="#00BFAE" />
      <rect x="23.6" y="19.8" width="3.2" height="5.7" rx="1" fill="#00BFAE" />
    </svg>
  );
}

/** Nombre de la marca con su descriptor institucional (el descriptor se omite en espacios reducidos con `descriptor={false}`). */
export function BrandName({ className, descriptor = true }: { className?: string; descriptor?: boolean }) {
  return (
    <span className={cn('flex min-w-0 flex-col leading-tight', className)}>
      <span className="whitespace-nowrap text-[1.0625rem] font-semibold tracking-[-0.01em]">{BRAND.nombre}</span>
      {descriptor && <span className="truncate text-[0.6875rem] font-medium opacity-70">{BRAND.descriptor}</span>}
    </span>
  );
}
