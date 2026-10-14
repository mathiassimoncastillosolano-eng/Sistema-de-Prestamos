/* Autenticación de DEMOSTRACIÓN: se compara contra credenciales públicas en el cliente.
   No ofrece seguridad real: no hay servidor, ni autorización, ni protección de datos. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, USUARIO_DEMO } from '@/lib/config';
import { storage } from '@/services/storage';

interface AuthCtx {
  autenticado: boolean;
  usuario: typeof USUARIO_DEMO;
  entrar: (usuario: string, clave: string) => boolean;
  salir: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(() => storage.get(STORAGE_KEYS.sesion) === '1');

  const entrar = useCallback((usuario: string, clave: string) => {
    const ok = usuario.trim() === USUARIO_DEMO.usuario && clave === USUARIO_DEMO.clave;
    if (ok) { storage.set(STORAGE_KEYS.sesion, '1'); setAutenticado(true); }
    return ok;
  }, []);

  const salir = useCallback(() => { storage.del(STORAGE_KEYS.sesion); setAutenticado(false); }, []);

  const valor = useMemo(() => ({ autenticado, usuario: USUARIO_DEMO, entrar, salir }), [autenticado, entrar, salir]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}
