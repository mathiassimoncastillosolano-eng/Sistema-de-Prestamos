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
  const cliente = {
    id: '11111111-1111-4111-8111-111111111111', numero: 1,
    tipoDocumento: 'DNI', numeroDocumento: '99999991',
    nombre: 'Cliente de prueba', telefono: '999999999', correo: 'cliente@example.com',
    dniTitular: null, domicilio: null, estadoSunat: null, condicionSunat: null,
    representanteNombre: null, representanteDni: null,
    agenciaId: 'a1', creadoEn: '2026-10-17T10:00:00-05:00'
  };
  const clientes: Array<Record<string, unknown>> = [cliente];

  const handler = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const ruta = String(entrada);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ ruta, metodo, cuerpo });

    const cabeceras = new Headers(init?.headers);
    // Como el backend real: la cookie XSRF-TOKEN se emite en cualquier respuesta (también en las 401) si el navegador no la trae.
    if (!document.cookie.includes('XSRF-TOKEN=')) document.cookie = `XSRF-TOKEN=${CSRF}; path=/`;
    // Sin CSRF correcto el servidor rechaza. En producción el 403 de Spring pasa por /error, que está denegado a anónimos,
    // y llega al navegador como 401 (sin cuerpo JSON).
    if (metodo !== 'GET' && cabeceras.get('X-XSRF-TOKEN') !== CSRF) return json(401);

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
      document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; // CsrfLogoutHandler borra la cookie
      return json(204);
    }
    if (ruta.startsWith('/api/clientes/consulta?') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      const parametros = new URL(ruta, 'http://localhost').searchParams;
      return json(200, {
        tipoDocumento: parametros.get('tipo'), numeroDocumento: parametros.get('numero'),
        nombre: 'Ana Salazar Quispe', dniTitular: null, domicilio: null,
        estadoSunat: null, condicionSunat: null, representanteNombre: null,
        representanteDni: null, habilitado: true, motivo: null
      });
    }
    if (ruta === '/api/clientes' && metodo === 'POST') {
      if (!sesionDe) return json(401);
      const nuevo = {
        ...cliente, id: '22222222-2222-4222-8222-222222222222', numero: 2,
        tipoDocumento: cuerpo.tipoDocumento, numeroDocumento: cuerpo.numeroDocumento,
        nombre: 'Ana Salazar Quispe', telefono: cuerpo.telefono, correo: cuerpo.correo
      };
      clientes.push(nuevo);
      return json(201, nuevo);
    }
    if (ruta === '/api/clientes' && metodo === 'GET') {
      return sesionDe ? json(200, clientes) : json(401);
    }
    if (ruta.startsWith('/api/clientes/') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      const encontrado = clientes.find((c) => c.id === ruta.slice('/api/clientes/'.length));
      return encontrado ? json(200, encontrado) : json(404);
    }
    return json(404);
  });

  return {
    handler,
    llamadas,
    instalar: () => vi.stubGlobal('fetch', handler),
    agregarCliente: (datos: Record<string, unknown>) => clientes.push({ ...cliente, ...datos }),
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
