import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { useAuth, useUsuario } from '@/hooks/use-auth';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BrandMark, BrandName } from './brand-mark';
import { gruposPara } from './nav';

interface ContentProps {
  colapsado: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

/** Contenido de la barra lateral. Se reutiliza en escritorio (colapsable) y en el drawer móvil. */
export function SidebarContent({ colapsado, onToggle, onNavigate }: ContentProps) {
  const usuario = useUsuario();
  const { puede } = useAuth();
  const grupos = gruposPara(puede);
  return (
    <div className="pattern-steps flex h-full flex-col bg-side text-side-ink">
      <div className={cn('flex h-16 shrink-0 items-center gap-3 px-[1.125rem]', colapsado && 'justify-center px-0')}>
        <BrandMark tile="light" />
        {!colapsado && <BrandName className="text-side-ink" />}
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {grupos.map((g, gi) => (
          <div key={g.titulo} className={cn(gi > 0 && 'mt-5')}>
            {colapsado ? (gi > 0 && <div aria-hidden className="mx-2 mb-3 h-px bg-side-line" />) : <p className="mb-1.5 px-3 text-xs font-medium text-side-muted">{g.titulo}</p>}
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.to}>
                  <Tip label={it.label} side="right" disabled={!colapsado}>
                    <NavLink to={it.to} end={it.end} onClick={onNavigate} aria-label={colapsado ? it.label : undefined}
                      className={({ isActive }) => cn('group relative flex h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150', colapsado && 'justify-center px-0', isActive ? 'text-white' : 'text-side-ink/80 hover:bg-side-hover hover:text-white')}>
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span layoutId={colapsado ? 'nav-active-c' : 'nav-active'} className="absolute inset-0 rounded-control bg-side-active" transition={{ duration: DUR.base, ease: EASE }}>
                              <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-copper" />
                            </motion.span>
                          )}
                          <it.icon className={cn('relative size-5 shrink-0 transition-colors', isActive ? 'text-copper' : 'text-side-muted group-hover:text-side-ink')} aria-hidden />
                          {!colapsado && <span className="relative truncate">{it.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </Tip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-side-line p-3">
        {onToggle && (
          <Tip label={colapsado ? 'Expandir menú' : 'Minimizar menú'} side="right" disabled={!colapsado}>
            <button type="button" onClick={onToggle} aria-label={colapsado ? 'Expandir el menú' : 'Minimizar el menú'}
              className={cn('flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm text-side-muted transition-colors hover:bg-side-hover hover:text-white', colapsado && 'justify-center px-0')}>
              {colapsado ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
              {!colapsado && 'Minimizar'}
            </button>
          </Tip>
        )}
        <div className={cn('flex items-center gap-3 rounded-control px-2 py-1.5', colapsado && 'justify-center px-0')}>
          <Avatar nombre={usuario.nombre} size="md" className="bg-side-active text-side-ink" />
          {!colapsado && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{usuario.nombre}</p>
              <p className="truncate text-xs text-side-muted">{usuario.rolEtiqueta}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar({ colapsado, onToggle }: { colapsado: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      aria-label="Barra lateral"
      initial={false}
      animate={{ width: colapsado ? 76 : 256 }}
      transition={{ duration: DUR.slow, ease: EASE }}
      className="no-print fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-side-line lg:block"
    >
      <SidebarContent colapsado={colapsado} onToggle={onToggle} />
    </motion.aside>
  );
}
