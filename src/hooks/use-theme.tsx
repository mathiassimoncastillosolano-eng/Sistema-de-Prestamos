import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/config';
import { storage } from '@/services/storage';

export type Tema = 'light' | 'dark';

interface ThemeCtx { tema: Tema; alternar: () => void }
const Ctx = createContext<ThemeCtx | null>(null);

const leerInicial = (): Tema => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

/** El tema inicial lo fija el script de index.html antes de pintar (sin destello); aquí solo se mantiene y persiste. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leerInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.style.colorScheme = tema;
    document.documentElement.style.backgroundColor = '';
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((t) => {
      const siguiente: Tema = t === 'dark' ? 'light' : 'dark';
      storage.set(STORAGE_KEYS.tema, siguiente);
      return siguiente;
    });
  }, []);

  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return c;
}
