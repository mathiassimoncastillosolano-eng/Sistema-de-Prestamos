import { CalendarDays, FilePlus2, Landmark, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavGroup { titulo: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { titulo: 'Resumen', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { titulo: 'Clientes', items: [{ to: '/clientes', label: 'Clientes', icon: Users }, { to: '/solicitud', label: 'Nueva solicitud', icon: FilePlus2 }] },
  { titulo: 'Cartera', items: [{ to: '/prestamos', label: 'Préstamos', icon: Landmark }, { to: '/cuotas', label: 'Cuotas y cronogramas', icon: CalendarDays }] }
];

/** Título de sección para la cabecera según la ruta. */
export function tituloDeRuta(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  const base = '/' + (pathname.split('/')[1] ?? '');
  const mapa: Record<string, string> = { '/clientes': 'Clientes', '/solicitud': 'Nueva solicitud', '/prestamos': 'Préstamos', '/cuotas': 'Cuotas y cronogramas' };
  return mapa[base] ?? 'NEXORA FINANCE';
}
