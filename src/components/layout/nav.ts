import { ClipboardCheck, FilePlus2, Landmark, LayoutDashboard, Users, Vault, Wallet, type LucideIcon } from 'lucide-react';
import { BRAND } from '@/lib/config';
import type { Modulo } from '@/lib/permissions';
import type { PendientesApi } from '@/services/caja-api';

export interface NavItem {
  to: string; label: string; icon: LucideIcon; modulo: Modulo; end?: boolean;
  /** Cuántas cosas esperan al usuario en este módulo (consulta periódica al servidor; no es tiempo real). */
  aviso?: (p: PendientesApi) => number;
}
export interface NavGroup { titulo: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { titulo: 'Resumen', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard', end: true }] },
  { titulo: 'Cartera', items: [{ to: '/prestamos', label: 'Préstamos', icon: Landmark, modulo: 'prestamos' }] },
  {
    titulo: 'Caja',
    items: [
      { to: '/caja', label: 'Caja y reposiciones', icon: Wallet, modulo: 'caja', aviso: (p) => p.observadas + p.recepcionesPorRegistrar },
      { to: '/reposiciones', label: 'Gestión de reposiciones', icon: ClipboardCheck, modulo: 'reposiciones', aviso: (p) => p.solicitudesPorRevisar + p.porConciliar },
      { to: '/supervision', label: 'Supervisión de cajas', icon: Vault, modulo: 'supervision', aviso: (p) => p.incidenciasAbiertas }
    ]
  },
  { titulo: 'Clientes', items: [{ to: '/clientes', label: 'Clientes', icon: Users, modulo: 'clientes' }, { to: '/solicitud', label: 'Nueva solicitud', icon: FilePlus2, modulo: 'solicitud' }] }
];

/** Menú que corresponde al rol: sin permiso no se renderiza (los grupos que quedan vacíos desaparecen). */
export function gruposPara(puede: (m: Modulo) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => puede(i.modulo)) })).filter((g) => g.items.length > 0);
}

/** Título de sección para la cabecera según la ruta. */
export function tituloDeRuta(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  const base = '/' + (pathname.split('/')[1] ?? '');
  const mapa: Record<string, string> = { '/clientes': 'Clientes', '/solicitud': 'Nueva solicitud', '/prestamos': 'Préstamos', '/caja': 'Caja y reposiciones', '/reposiciones': 'Gestión de reposiciones', '/supervision': 'Supervisión de cajas' };
  return mapa[base] ?? BRAND.nombre;
}
