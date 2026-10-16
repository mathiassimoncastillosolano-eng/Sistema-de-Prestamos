import { ChevronDown, LogOut, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { toast } from '@/components/ui/toast';
import { useAuth, useUsuario } from '@/hooks/use-auth';
import { etiquetaAgencia } from '@/lib/utils';
import { RestoreDialog } from './restore-dialog';

export function UserMenu() {
  const usuario = useUsuario();
  const { salir, puede } = useAuth();
  const [restaurar, setRestaurar] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  // El estado solo se limpia cuando el servidor confirma el cierre; si falla, la sesión sigue y se avisa.
  const cerrarSesion = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try { await salir(); } catch { toast.error('No se pudo cerrar la sesión. Revisa tu conexión e inténtalo nuevamente.'); setSaliendo(false); }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownTrigger asChild>
          <button type="button" aria-label="Menú de cuenta" className="flex h-11 items-center gap-2.5 rounded-control px-1.5 transition-colors hover:bg-surface-2 sm:h-10 sm:pr-2.5">
            <Avatar nombre={usuario.nombre} size="md" />
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-sm font-medium text-ink">{usuario.nombre}</span>
              <span className="block text-xs text-ink-muted">{usuario.rolEtiqueta}</span>
            </span>
            <ChevronDown className="hidden size-4 text-ink-muted lg:block" aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownLabel>{usuario.nombre}{usuario.agencia ? ` · ${etiquetaAgencia(usuario.agencia.nombre)}` : ''}</DropdownLabel>
          {usuario.correo && <p className="truncate px-2.5 pb-1.5 text-xs text-ink-subtle">{usuario.correo}</p>}
          {puede('clientes') && <DropdownItem onSelect={() => setRestaurar(true)}><RotateCcw className="size-4 text-ink-muted" aria-hidden />Restaurar datos de demostración</DropdownItem>}
          {puede('clientes') && <DropdownSeparator />}
          <DropdownItem onSelect={() => { void cerrarSesion(); }} disabled={saliendo}><LogOut className="size-4 text-ink-muted" aria-hidden />Cerrar sesión</DropdownItem>
        </DropdownContent>
      </DropdownMenu>
      <RestoreDialog open={restaurar} onOpenChange={setRestaurar} />
    </>
  );
}
