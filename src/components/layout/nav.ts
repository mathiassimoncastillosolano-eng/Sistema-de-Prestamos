import { CreditCard, FilePlus2, Landmark, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavGroup { titulo: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { titulo: 'Resumen', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { titulo: 'Clientes', items: [{ to: '/clientes', label: 'Clientes', icon: Users }, { to: '/solicitud', label: 'Nueva solicitud', icon: FilePlus2 }] },
  { titulo: 'Cartera', items: [{ to: '/prestamos', label: 'Préstamos', icon: Landmark }, { to: '/pagos', label: 'Pagos y cancelaciones', icon: CreditCard }] }
];

/** Título de sección para la cabecera según la ruta. */
export function tituloDeRuta(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  const base = '/' + (pathname.split('/')[1] ?? '');
  const mapa: Record<string, string> = { '/clientes': 'Clientes', '/solicitud': 'Nueva solicitud', '/prestamos': 'Préstamos', '/pagos': 'Pagos y cancelaciones' };
  return mapa[base] ?? 'NEXORA FINANCE';
}
