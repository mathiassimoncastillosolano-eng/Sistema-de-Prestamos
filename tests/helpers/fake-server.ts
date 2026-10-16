/* Servidor FALSO a nivel de fetch: imita el contrato de /api/auth (login, me, logout) y la comprobación CSRF.
   Sirve para probar el frontend; NO prueba el backend ni la base de datos reales. */
import { vi } from 'vitest';
import type { Agencia, Perfil } from '@/types/auth';

export interface CuentaFalsa {
  correo: string;
  clave: string;
  perfil: Perfil;
  agencia: Agencia | null;
  /** Error que el servidor devuelve DESPUÉS de acertar la contraseña (cuenta desactivada, etc.). */
  bloqueo?: { status: number; codigo: string };
}

const json = (status: number, cuerpo?: unknown) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export const CSRF = 'token-csrf-de-prueba';

export function crearServidor(cuentas: CuentaFalsa[]) {
  document.cookie = `XSRF-TOKEN=${CSRF}; path=/`;
  let sesionDe: CuentaFalsa | null = null;
  let retenerMe: Promise<void> | null = null;
  let logoutFalla = false;
  const llamadas: { ruta: string; metodo: string; cuerpo?: unknown }[] = [];

  const handler = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const ruta = String(entrada);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ ruta, metodo, cuerpo });

    const cabeceras = new Headers(init?.headers);
    if (metodo !== 'GET' && cabeceras.get('X-XSRF-TOKEN') !== CSRF) return json(403); // sin CSRF correcto el servidor rechaza

    if (ruta === '/api/auth/me') {
      if (retenerMe) await retenerMe;
      return sesionDe ? json(200, { perfil: sesionDe.perfil, agencia: sesionDe.agencia }) : json(401);
    }
    if (ruta === '/api/auth/login') {
      const c = cuentas.find((x) => x.correo === String(cuerpo?.correo).trim().toLowerCase() && x.clave === cuerpo?.clave);
      if (!c) return json(401, { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'x' });
      if (c.bloqueo) return json(c.bloqueo.status, { codigo: c.bloqueo.codigo, mensaje: 'x' });
      sesionDe = c;
      return json(200, { perfil: c.perfil, agencia: c.agencia });
    }
    if (ruta === '/api/auth/logout') {
      if (logoutFalla) return json(500);
      sesionDe = null;
      return json(204);
    }
    return json(404);
  });

  return {
    handler,
    llamadas,
    instalar: () => vi.stubGlobal('fetch', handler),
    /** Simula una sesión ya abierta (p. ej. el usuario recarga la página). */
    abrirSesion: (c: CuentaFalsa) => { sesionDe = c; },
    expirarSesion: () => { sesionDe = null; },
    fallarLogout: (v: boolean) => { logoutFalla = v; },
    retenerMe: () => { let soltar!: () => void; retenerMe = new Promise<void>((r) => { soltar = r; }); return () => { retenerMe = null; soltar(); }; }
  };
}

const ubicacion = { departamento: 'Departamento Prueba', provincia: 'Provincia Prueba', distrito: 'Distrito Prueba', direccion: 'Av. Ficticia 123' };
export const AGENCIA_PRUEBA: Agencia = { id: 'a1', nombre: 'Sur Prueba', activa: true, ubicacion };

export const ASESORA: CuentaFalsa = {
  correo: 'valeria@ejemplo.com', clave: 'clave-de-prueba',
  perfil: { id: 'p1', nombres: 'Valeria', apellidos: 'Quintana', correo: 'valeria@ejemplo.com', rol: 'asesor', agenciaId: 'a1', activo: true },
  agencia: AGENCIA_PRUEBA
};
export const GERENTE: CuentaFalsa = {
  correo: 'gerente@ejemplo.com', clave: 'clave-de-prueba',
  perfil: { id: 'p2', nombres: 'Mateo', apellidos: 'Rivas', correo: 'gerente@ejemplo.com', rol: 'gerencia', agenciaId: null, activo: true },
  agencia: null
};
