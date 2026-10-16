/* =========================================================
   SESIÓN — fuente única de verdad de la identidad autenticada.
   El perfil, el rol y la agencia vienen del servidor (public.perfiles / agencias / ubicaciones).
   Aquí no hay credenciales, tokens ni datos ficticios: la sesión vive en una cookie HttpOnly.
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { esRolValido, ETIQUETA_ROL, puedeAccederAModulo, type Modulo } from '@/lib/permissions';
import { iniciales } from '@/lib/utils';
import { ApiError, authApi, mensajeDe } from '@/services/auth-api';
import { storage } from '@/services/storage';
import type { Agencia, IdentidadOperativa, Rol, Sesion } from '@/types/auth';

type Fase =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo'; aviso?: string }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'autenticado'; sesion: Sesion };

/** Vista derivada de la sesión: lo único que consumen los componentes. */
export interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  /** «Nombres Apellidos», tal como están en el perfil. */
  nombre: string;
  correo: string;
  /** Valor persistido, sin traducir. `null` si el servidor envió un rol no reconocido. */
  rol: Rol | null;
  rolEtiqueta: string;
  iniciales: string;
  agencia: Agencia | null;
}

interface AuthCtx {
  fase: Fase['tipo'];
  /** Mensaje para el login (p. ej. sesión expirada). */
  aviso: string | null;
  mensajeError: string | null;
  usuario: Usuario | null;
  entrar: (correo: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
  reintentar: () => void;
  /** Autorización de navegación/presentación. Siempre `false` sin sesión o con rol desconocido. */
  puede: (modulo: Modulo) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const REVALIDAR_CADA_MS = 5 * 60_000;
const REVALIDAR_MIN_MS = 30_000;

/** Evita consultas duplicadas (StrictMode, foco + intervalo simultáneos). */
let enVuelo: Promise<Sesion | null> | null = null;
function consultarSesion(): Promise<Sesion | null> {
  if (!enVuelo) enVuelo = authApi.sesionActual().finally(() => { enVuelo = null; });
  return enVuelo;
}

function derivar(s: Sesion): Usuario {
  const { perfil, agencia } = s;
  const nombre = `${perfil.nombres} ${perfil.apellidos}`.replace(/\s+/g, ' ').trim();
  const rol = esRolValido(perfil.rol) ? perfil.rol : null;
  return {
    id: perfil.id, nombres: perfil.nombres, apellidos: perfil.apellidos, nombre, correo: perfil.correo,
    rol, rolEtiqueta: rol ? ETIQUETA_ROL[rol] : 'Rol no reconocido', iniciales: iniciales(nombre), agencia
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'cargando' });
  const enCurso = useRef(false);
  const ultimaComprobacion = useRef(0);
  /** Cambia en cada inicio/cierre de sesión: una revalidación lanzada antes no puede alterar la sesión posterior. */
  const generacion = useRef(0);

  const aplicar = useCallback((s: Sesion | null, avisoSiNoHay?: string) => {
    ultimaComprobacion.current = Date.now();
    setFase(s ? { tipo: 'autenticado', sesion: s } : { tipo: 'anonimo', aviso: avisoSiNoHay });
  }, []);

  const inicializar = useCallback(() => {
    setFase({ tipo: 'cargando' });
    consultarSesion().then((s) => aplicar(s), (e: unknown) => {
      setFase({ tipo: 'error', mensaje: e instanceof ApiError ? e.message : mensajeDe('RED') });
    });
  }, [aplicar]);

  useEffect(() => {
    storage.del('nx-sesion'); // clave de la autenticación de demostración anterior
    inicializar();
  }, [inicializar]);

  // Revalida con el servidor: detecta expiración, desactivación de la cuenta o cambios de rol/agencia.
  const autenticado = fase.tipo === 'autenticado';
  useEffect(() => {
    if (!autenticado) return;
    const revalidar = () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaComprobacion.current < REVALIDAR_MIN_MS) return;
      const g = generacion.current;
      consultarSesion().then(
        (s) => { if (g === generacion.current) aplicar(s, mensajeDe('NO_AUTENTICADO')); },
        () => { /* fallo de red transitorio: se conserva la vista actual y se reintenta luego */ }
      );
    };
    const id = window.setInterval(revalidar, REVALIDAR_CADA_MS);
    document.addEventListener('visibilitychange', revalidar);
    window.addEventListener('focus', revalidar);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', revalidar); window.removeEventListener('focus', revalidar); };
  }, [autenticado, aplicar]);

  const entrar = useCallback(async (correo: string, clave: string) => {
    if (enCurso.current) return; // evita envíos repetidos
    enCurso.current = true;
    try {
      const s = await authApi.login(correo.trim(), clave);
      if (!esRolValido(s.perfil.rol)) {
        await authApi.logout().catch(() => undefined);
        throw new ApiError('ROL_NO_RECONOCIDO', mensajeDe('ROL_NO_RECONOCIDO'));
      }
      generacion.current++;
      aplicar(s);
    } finally {
      enCurso.current = false;
    }
  }, [aplicar]);

  const salir = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // 403 = cookie CSRF caducada: se renueva con una consulta y se reintenta una vez.
      if (e instanceof ApiError && e.status === 403) {
        await consultarSesion().catch(() => undefined);
        await authApi.logout();
      } else throw e;
    }
    // Solo se limpia el estado cuando el servidor confirmó el cierre.
    // La ruta se reinicia para que el siguiente usuario no herede el enlace profundo del anterior.
    try { history.replaceState(null, '', window.location.pathname + window.location.search + '#/'); } catch { /* sin acceso al historial */ }
    generacion.current++;
    setFase({ tipo: 'anonimo' });
  }, []);

  const usuario = useMemo(() => (fase.tipo === 'autenticado' ? derivar(fase.sesion) : null), [fase]);
  const puede = useCallback((m: Modulo) => puedeAccederAModulo(usuario?.rol, m), [usuario]);

  const valor = useMemo<AuthCtx>(() => ({
    fase: fase.tipo,
    aviso: fase.tipo === 'anonimo' ? fase.aviso ?? null : null,
    mensajeError: fase.tipo === 'error' ? fase.mensaje : null,
    usuario, entrar, salir, reintentar: inicializar, puede
  }), [fase, usuario, entrar, salir, inicializar, puede]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}

/** Para pantallas que solo se montan con sesión válida: garantiza un usuario no nulo. */
export function useUsuario(): Usuario {
  const { usuario } = useAuth();
  if (!usuario) throw new Error('useUsuario solo puede usarse con una sesión iniciada');
  return usuario;
}

/** Identidad (asesor + agencia) con la que se firman los registros ficticios creados en el navegador. */
export function useIdentidad(): IdentidadOperativa {
  const u = useUsuario();
  return useMemo(() => ({ nombre: u.nombre, agencia: u.agencia?.nombre ?? '' }), [u.nombre, u.agencia?.nombre]);
}
