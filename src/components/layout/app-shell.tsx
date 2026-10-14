import { motion } from 'motion/react';
import { TriangleAlert, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useFallosAlmacenamiento } from '@/hooks/use-db';
import { STORAGE_KEYS } from '@/lib/config';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { storage } from '@/services/storage';
import { ErrorBoundary } from './error-boundary';
import { Header } from './header';
import { DesktopSidebar, SidebarContent } from './sidebar';

export function PageFallback() {
  return (
    <div className="space-y-5" role="status" aria-label="Cargando pantalla">
      <Skeleton className="h-9 w-64" /><Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-72" />
    </div>
  );
}

function AvisoAlmacenamiento() {
  const fallos = useFallosAlmacenamiento();
  const [oculto, setOculto] = useState(0);
  if (!fallos || oculto === fallos) return null;
  return (
    <div role="alert" className="no-print border-b border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning-ink">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">No se pudo guardar en este navegador (modo privado o sin espacio). Los cambios seguirán en pantalla, pero se perderán al recargar.</p>
        <button type="button" onClick={() => setOculto(fallos)} aria-label="Ocultar aviso" className="rounded p-1 hover:bg-warning/20"><X className="size-4" /></button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [colapsado, setColapsado] = useState(() => storage.get(STORAGE_KEYS.side) === '1');
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const primera = useRef(true);

  const alternar = () => setColapsado((c) => { storage.set(STORAGE_KEYS.side, c ? '0' : '1'); return !c; });

  // Al navegar: cierra el drawer, vuelve arriba y mueve el foco al contenido (útil con teclado y lectores de pantalla)
  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
    if (primera.current) { primera.current = false; return; }
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div data-app-shell className={cn('min-h-dvh transition-[padding] duration-[320ms] ease-out', colapsado ? 'lg:pl-[76px]' : 'lg:pl-64')}>
      <button type="button" onClick={() => main.current?.focus()} className="no-print sr-only z-[100] rounded-md bg-brand px-4 py-2 text-brand-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido</button>
      <DesktopSidebar colapsado={colapsado} onToggle={alternar} />
      <Sheet open={drawer} onOpenChange={setDrawer} side="left" title="Menú de navegación" hideHeader className="max-w-[18rem] border-r border-side-line">
        <SidebarContent colapsado={false} onNavigate={() => setDrawer(false)} />
      </Sheet>
      <Header onMenu={() => setDrawer(true)} />
      <AvisoAlmacenamiento />
      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageFallback />}><Outlet /></Suspense>
          </ErrorBoundary>
        </motion.div>
      </main>
    </div>
  );
}
