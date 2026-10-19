import { BRAND } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * IDENTIDAD VISUAL — único punto de la app donde se dibuja la marca. Recursos oficiales en /public/brand/
 * (el original está en /brand-source/):
 *  - perucred-logo.png   logo completo (símbolo + «PerúCred» + descriptor), fondo transparente: solo sobre fondos CLAROS.
 *  - perucred-icon.png   símbolo sobre tile blanco redondeado: el mismo de los favicons; funciona en fondos claros y oscuros.
 *  - logo-perucred-transparente.png   copia independiente del logo completo, con fondo transparente real y recortada al contenido;
 *    EXCLUSIVA de la pantalla de inicio de sesión (LoginLogo). No sustituye a perucred-logo.png, que permanece sin cambios.
 */

/** Logo completo. Úsalo sobre superficies claras (el texto del logo es azul marino). */
export function BrandLogo({ className }: { className?: string }) {
  return <img src="/brand/perucred-logo.png" alt={`${BRAND.nombre} · ${BRAND.descriptor}`} width={1203} height={738} className={cn('h-auto w-full select-none', className)} draggable={false} />;
}

/**
 * Logo completo para la pantalla de inicio de sesión: mismo diseño oficial, con transparencia real, sin tarjeta ni baldosa detrás.
 * Su texto es azul marino, por eso el login siempre se pinta sobre fondo claro. No usar fuera de esa pantalla.
 */
export function LoginLogo({ className }: { className?: string }) {
  return <img src="/brand/logo-perucred-transparente.png" alt={`${BRAND.nombre} · ${BRAND.descriptor}`} width={1196} height={732} className={cn('h-auto w-full select-none', className)} draggable={false} />;
}

/** Símbolo de la marca (igual que el favicon). Válido sobre cualquier fondo gracias a su tile blanco. */
export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/perucred-icon.png" alt={BRAND.nombre} width={256} height={256} className={cn('size-9 shrink-0 select-none', className)} draggable={false} />;
}

/**
 * Nombre en texto, para fondos oscuros o espacios reducidos donde el logo completo no se lee.
 * Usa los colores de la marca («Perú» hereda el color del texto; «Cred» va en turquesa) y, opcionalmente, el descriptor.
 */
export function BrandName({ className, descriptor = true, accentClassName = 'text-teal-ink' }: { className?: string; descriptor?: boolean; accentClassName?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-col leading-tight', className)}>
      <span className="whitespace-nowrap text-[1.0625rem] font-bold tracking-[-0.01em]">Perú<span className={accentClassName}>Cred</span></span>
      {descriptor && <span className="truncate text-[0.6875rem] font-medium opacity-70">{BRAND.descriptor}</span>}
    </span>
  );
}
