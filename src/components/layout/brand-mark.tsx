import { BRAND } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * IDENTIDAD VISUAL — único punto de la app donde se dibuja la marca «Préstamos Castillo».
 * El logo oficial es el símbolo «P» (sin modificar). El nombre se compone en tipografía (Inter), nunca como imagen.
 * Recursos en /public/brand/ (el original está en /brand-source/):
 *  - perucred-icon.png     símbolo sobre tile blanco redondeado (igual que los favicons); válido en fondos claros y oscuros.
 *  - perucred-symbol.png   símbolo con fondo transparente; se usa en el inicio de sesión (fondo siempre claro).
 *  - perucred-logo.png y logo-perucred-transparente.png llevan impresa la denominación anterior: se conservan como archivo
 *    histórico y no se muestran en la interfaz.
 */

type BrandSize = 'sm' | 'md' | 'lg';

const MARK: Record<BrandSize, string> = { sm: 'size-9', md: 'size-10', lg: 'size-[3.75rem] sm:size-[4.25rem]' };
const GAP: Record<BrandSize, string> = { sm: 'gap-3', md: 'gap-3', lg: 'gap-3.5 sm:gap-4' };
const ACTIVIDAD: Record<BrandSize, string> = {
  sm: 'text-[0.75rem]',
  md: 'text-[0.8125rem]',
  lg: 'text-[0.9375rem] sm:text-base'
};
const PRINCIPAL: Record<BrandSize, string> = {
  sm: 'text-[1.0625rem]',
  md: 'text-[1.1875rem]',
  lg: 'text-[1.625rem] sm:text-[1.875rem]'
};

/**
 * Símbolo de la marca. `variant="tile"` (por defecto) lleva el tile blanco y sirve sobre cualquier fondo;
 * `variant="transparent"` es el mismo símbolo sin fondo, solo para superficies claras.
 * Si va junto al nombre en texto, usa `decorative` para no anunciar la marca dos veces.
 */
export function BrandMark({ className, variant = 'tile', decorative = false }: { className?: string; variant?: 'tile' | 'transparent'; decorative?: boolean }) {
  const src = variant === 'tile' ? '/brand/perucred-icon.png' : '/brand/perucred-symbol.png';
  const dim = variant === 'tile' ? 256 : 512;
  return (
    <img src={src} alt={decorative ? '' : BRAND.nombre} aria-hidden={decorative || undefined} width={dim} height={dim}
      className={cn('size-9 shrink-0 select-none object-contain', className)} draggable={false} />
  );
}

/**
 * Nombre de la marca en dos niveles: «Préstamos» (descriptor de la actividad) sobre «Castillo» (nombre principal).
 * `principalClassName` y `actividadClassName` permiten adaptar el color al fondo sin salir de los tokens.
 */
export function BrandName({ className, size = 'sm', principalClassName = 'text-ink', actividadClassName = 'text-teal-ink' }: {
  className?: string;
  size?: BrandSize;
  principalClassName?: string;
  actividadClassName?: string;
}) {
  return (
    <span className={cn('flex min-w-0 flex-col whitespace-nowrap', size === 'lg' && '-space-y-0.5', className)}>
      <span className={cn('font-medium leading-none tracking-[0.01em]', ACTIVIDAD[size], actividadClassName)}>{BRAND.actividad}</span>{' '}
      <span className={cn('font-[650] leading-none tracking-[-0.02em]', PRINCIPAL[size], principalClassName)}>{BRAND.principal}</span>
    </span>
  );
}

/** Símbolo + nombre con proporciones y separación fijas por tamaño. Es la forma estándar de mostrar la marca. */
export function BrandLockup({ className, size = 'sm', variant = 'tile', principalClassName, actividadClassName }: {
  className?: string;
  size?: BrandSize;
  variant?: 'tile' | 'transparent';
  principalClassName?: string;
  actividadClassName?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center', GAP[size], className)}>
      <BrandMark variant={variant} decorative className={MARK[size]} />
      <BrandName size={size} principalClassName={principalClassName} actividadClassName={actividadClassName} />
    </span>
  );
}
