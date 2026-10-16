import { Bell, CircleAlert, Clock, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { useIdentidad } from '@/hooks/use-auth';
import { useDb } from '@/hooks/use-db';
import { calcularNotificaciones } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const iconos = { danger: CircleAlert, warning: Clock, info: ShieldAlert };
const colores = { danger: 'bg-danger-soft text-danger-ink', warning: 'bg-warning-soft text-warning-ink', info: 'bg-info-soft text-info-ink' };

/** Avisos derivados de la cartera propia (cuotas vencidas, próximos vencimientos, clientes cerca del límite). */
export function Notifications() {
  const db = useDb();
  const navigate = useNavigate();
  const yo = useIdentidad();
  const lista = useMemo(() => calcularNotificaciones(db, yo), [db, yo]);
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={lista.length ? `Notificaciones: ${lista.length} avisos` : 'Notificaciones: sin avisos'} className="relative">
          <Bell className="size-5" />
          {lista.length > 0 && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-canvas" />}
        </Button>
      </DropdownTrigger>
      <DropdownContent className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <DropdownLabel className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Avisos de tu cartera</DropdownLabel>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {lista.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-muted">Todo al día. No hay avisos pendientes.</p>}
          {lista.map((n) => {
            const Icono = iconos[n.tono];
            return (
              <DropdownItem key={n.id} onSelect={() => navigate(n.ruta)} className="items-start py-2.5">
                <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', colores[n.tono])}><Icono className="size-4" aria-hidden /></span>
                <span className="min-w-0"><span className="block text-sm font-medium text-ink">{n.titulo}</span><span className="block text-xs text-ink-muted">{n.detalle}</span></span>
              </DropdownItem>
            );
          })}
        </div>
      </DropdownContent>
    </DropdownMenu>
  );
}
