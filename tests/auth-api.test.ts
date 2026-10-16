import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authApi } from '@/services/auth-api';
import { ASESORA, CSRF, crearServidor } from './helpers/fake-server';

describe('cliente de la API de autenticación', () => {
  beforeEach(() => { crearServidor([ASESORA]).instalar(); });

  it('sin sesión, sesionActual() devuelve null (401 no es un error)', async () => {
    expect(await authApi.sesionActual()).toBeNull();
  });

  it('el login envía el token CSRF en la cabecera y las credenciales solo en el cuerpo', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar();
    const s = await authApi.login(ASESORA.correo, ASESORA.clave);
    expect(s.perfil.nombres).toBe('Valeria');
    const init = srv.handler.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe(CSRF);
    expect(init.credentials).toBe('same-origin');
    expect(srv.llamadas[0]!.ruta).not.toContain(ASESORA.clave); // nunca en la URL
  });

  it('credenciales incorrectas → ApiError con mensaje en español', async () => {
    const e = await authApi.login('nadie@ejemplo.com', 'x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).codigo).toBe('CREDENCIALES_INVALIDAS');
    expect((e as ApiError).message).toBe('Correo o contraseña incorrectos.');
  });

  it('un fallo de red se distingue de unas credenciales incorrectas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(authApi.sesionActual()).rejects.toMatchObject({ codigo: 'RED' });
    await expect(authApi.login('a@b.co', 'x')).rejects.toMatchObject({ codigo: 'RED' });
  });

  it('una respuesta 5xx o HTML de un proxy no se interpreta como «sin sesión»', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(authApi.sesionActual()).rejects.toMatchObject({ codigo: 'DESCONOCIDO', status: 502 });
  });

  it('logout solo resuelve si el servidor lo confirma', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar();
    srv.fallarLogout(true);
    await expect(authApi.logout()).rejects.toBeInstanceOf(ApiError);
    srv.fallarLogout(false);
    await expect(authApi.logout()).resolves.toBeUndefined();
  });
});
