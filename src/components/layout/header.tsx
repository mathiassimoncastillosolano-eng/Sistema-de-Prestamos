import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth, useUsuario } from '@/hooks/use-auth';
import { AgencyCard } from './agency-card';
import { GlobalSearch } from './global-search';
import { tituloDeRuta } from './nav';
import { Notifications } from './notifications';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Header({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation();
  const usuario = useUsuario();
  const { puede } = useAuth();
  // Búsqueda y avisos recorren clientes y préstamos: solo se ofrecen a quien puede abrir esos módulos.
  const veNegocio = puede('clientes') || puede('prestamos');
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú de navegación" onClick={onMenu}><Menu className="size-5" /></Button>
        <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink md:hidden">{tituloDeRuta(pathname)}</p>
        <p className="hidden shrink-0 pr-2 text-[0.9375rem] font-semibold text-ink lg:block">{tituloDeRuta(pathname)}</p>
        <div className="flex justify-end md:flex-1 md:justify-start">{veNegocio && <GlobalSearch />}</div>
        {usuario.agencia && <AgencyCard agencia={usuario.agencia} className="hidden md:inline-flex" />}
        {veNegocio && <Notifications />}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
