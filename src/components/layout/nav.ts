import { FilePlus2, Landmark, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';
import { BRAND } from '@/lib/config';
import type { Modulo } from '@/lib/permissions';

export interface NavItem { to: string; label: string; icon: LucideIcon; modulo: Modulo; end?: boolean }
export interface NavGroup { titulo: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { titulo: 'Resumen', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard', end: true }] },
  { titulo: 'Clientes', items: [{ to: '/clientes', label: 'Clientes', icon: Users, modulo: 'clientes' }, { to: '/solicitud', label: 'Nueva solicitud', icon: FilePlus2, modulo: 'solicitud' }] },
  { titulo: 'Cartera', items: [{ to: '/prestamos', label: 'Préstamos', icon: Landmark, modulo: 'prestamos' }] }
];

/** Menú que corresponde al rol: sin permiso no se renderiza (los grupos que quedan vacíos desaparecen). */
export function gruposPara(puede: (m: Modulo) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => puede(i.modulo)) })).filter((g) => g.items.length > 0);
}

/** Título de sección para la cabecera según la ruta. */
export function tituloDeRuta(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  const base = '/' + (pathname.split('/')[1] ?? '');
  const mapa: Record<string, string> = { '/clientes': 'Clientes', '/solicitud': 'Nueva solicitud', '/prestamos': 'Préstamos' };
  return mapa[base] ?? BRAND.nombre;
}
