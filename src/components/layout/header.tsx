import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUsuario } from '@/hooks/use-auth';
import { AgencyCard } from './agency-card';
import { tituloDeRuta } from './nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Header({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation();
  const usuario = useUsuario();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú de navegación" onClick={onMenu}><Menu className="size-5" /></Button>
        {/* Módulo de la ruta activa (también en el detalle y las subrutas). */}
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.9375rem] font-semibold text-ink">
          <span aria-hidden className="text-ink-subtle">›</span>
          <span className="truncate">{tituloDeRuta(pathname)}</span>
        </p>
        {usuario.agencia && <AgencyCard agencia={usuario.agencia} className="hidden md:inline-flex" />}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
