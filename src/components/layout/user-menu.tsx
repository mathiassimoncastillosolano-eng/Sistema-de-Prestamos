import { ChevronDown, LogOut, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { useAuth } from '@/hooks/use-auth';
import { RestoreDialog } from './restore-dialog';

export function UserMenu() {
  const { usuario, salir } = useAuth();
  const [restaurar, setRestaurar] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownTrigger asChild>
          <button type="button" aria-label="Menú de cuenta" className="flex h-11 items-center gap-2.5 rounded-control px-1.5 transition-colors hover:bg-surface-2 sm:h-10 sm:pr-2.5">
            <Avatar nombre={usuario.nombre} size="md" />
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-sm font-medium text-ink">{usuario.nombre}</span>
              <span className="block text-xs text-ink-muted">{usuario.rol}</span>
            </span>
            <ChevronDown className="hidden size-4 text-ink-muted lg:block" aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownLabel>{usuario.nombre} · {usuario.agencia}</DropdownLabel>
          <DropdownItem onSelect={() => setRestaurar(true)}><RotateCcw className="size-4 text-ink-muted" aria-hidden />Restaurar datos de demostración</DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={salir}><LogOut className="size-4 text-ink-muted" aria-hidden />Cerrar sesión</DropdownItem>
        </DropdownContent>
      </DropdownMenu>
      <RestoreDialog open={restaurar} onOpenChange={setRestaurar} />
    </>
  );
}
