/* =========================================================
   PERMISOS — única fuente de verdad de la autorización por rol en la interfaz.
   OJO: es control de NAVEGACIÓN y PRESENTACIÓN. Los módulos de negocio siguen siendo datos ficticios
   en el navegador; no hay un servidor que proteja esos datos. Si algún día se conectan a endpoints
   reales, el servidor debe autorizar cada petición por su cuenta.
   ========================================================= */
import type { Rol } from '@/types/auth';

export type Modulo = 'dashboard' | 'clientes' | 'solicitud' | 'prestamos' | 'cuotas';

/** Qué roles pueden usar cada módulo. Un rol que no aparezca aquí no tiene acceso a nada. */
const ACCESO: Record<Modulo, readonly Rol[]> = {
  dashboard: ['asesor', 'gerencia'],
  clientes: ['asesor'],
  solicitud: ['asesor'],
  prestamos: ['asesor'],
  cuotas: ['asesor']
};

export const ROLES_VALIDOS: readonly Rol[] = ['asesor', 'gerencia'];

/** Etiquetas visuales; el valor persistido no cambia. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  asesor: 'Asesor de préstamos',
  gerencia: 'Gerencia'
};

/** Type guard: cualquier cadena que no sea exactamente un rol conocido se trata como desconocida (sin permisos). */
export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES_VALIDOS as readonly string[]).includes(valor);
}

export function puedeAccederAModulo(rol: unknown, modulo: Modulo): boolean {
  return esRolValido(rol) && ACCESO[modulo].includes(rol);
}

/** Primer segmento de la ruta → módulo. Devuelve `null` para rutas desconocidas (las gestiona el 404). */
export function moduloDeRuta(pathname: string): Modulo | null {
  const base = pathname.split('/')[1] ?? '';
  if (base === '') return 'dashboard';
  if (base === 'clientes' || base === 'solicitud' || base === 'prestamos' || base === 'cuotas') return base;
  return null;
}

/** Autorización por URL: rutas desconocidas se permiten (caen en el 404), las de módulos se comprueban. */
export function puedeAccederARuta(rol: unknown, pathname: string): boolean {
  const modulo = moduloDeRuta(pathname);
  return modulo === null ? esRolValido(rol) : puedeAccederAModulo(rol, modulo);
}

/** Ruta a la que se redirige cuando se intenta entrar a un módulo no permitido. */
export const RUTA_INICIO = '/';
