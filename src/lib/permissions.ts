/* =========================================================
   PERMISOS — única fuente de verdad de la autorización por rol en la interfaz.
   OJO: es control de NAVEGACIÓN y PRESENTACIÓN. El servidor autoriza cada petición por su cuenta.
   ========================================================= */
import type { Rol } from '@/types/auth';

export type Modulo = 'dashboard' | 'clientes' | 'solicitud' | 'prestamos';

/** Qué roles pueden usar cada módulo. Un rol que no aparezca aquí no tiene acceso a nada. */
const ACCESO: Record<Modulo, readonly Rol[]> = {
  dashboard: ['gerencia'],
  clientes: ['asesor'],
  solicitud: ['asesor'],
  prestamos: ['asesor']
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
  if (base === 'clientes' || base === 'solicitud' || base === 'prestamos') return base;
  /* El antiguo módulo «Cuotas y cronogramas» ya no existe: su URL redirige a Préstamos, así que se autoriza como tal. */
  if (base === 'cuotas') return 'prestamos';
  return null;
}

/** Autorización por URL: rutas desconocidas se permiten (caen en el 404), las de módulos se comprueban. */
export function puedeAccederARuta(rol: unknown, pathname: string): boolean {
  const modulo = moduloDeRuta(pathname);
  return modulo === null ? esRolValido(rol) : puedeAccederAModulo(rol, modulo);
}

/** Pantalla de entrada de cada rol: la gerencia ve el dashboard; el asesor empieza en Clientes. */
export function rutaInicio(rol: unknown): string {
  return puedeAccederAModulo(rol, 'dashboard') ? '/' : '/clientes';
}
