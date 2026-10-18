/* Pruebas de la interfaz con un servidor FALSO (tests/helpers/fake-server.ts).
   Demuestran el comportamiento del frontend; no prueban el backend ni la base de datos reales. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '@/app/App';
import { ASESORA, GERENTE, AGENCIA_PRUEBA, crearServidor, type CuentaFalsa } from './helpers/fake-server';

const menu = () => within(screen.getByRole('navigation', { name: 'Navegación principal' }));
const etiquetasMenu = () => menu().getAllByRole('link').map((l) => l.textContent?.trim());

async function iniciarSesion(cuenta: Pick<CuentaFalsa, 'correo' | 'clave'>) {
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText('Correo electrónico'), cuenta.correo);
  await u.type(screen.getByLabelText('Contraseña'), cuenta.clave);
  await u.click(screen.getByRole('button', { name: /Ingresar/ }));
  return u;
}

function montar(cuentas: CuentaFalsa[] = [ASESORA, GERENTE]) {
  const srv = crearServidor(cuentas);
  srv.instalar();
  render(<App />);
  return srv;
}

describe('A · login correcto como asesor', () => {
  it('muestra la sesión real y permite abrir un cliente obtenido de la API', async () => {
    montar();
    await iniciarSesion(ASESORA);

    await waitFor(() => expect(etiquetasMenu()).toEqual(['Dashboard', 'Clientes', 'Nueva solicitud', 'Préstamos']));
    expect(screen.getAllByText('Valeria Quintana').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Agencia Sur Prueba/ })).toBeInTheDocument();
    expect(screen.getAllByText('Asesor de préstamos').length).toBeGreaterThan(0);
    // nada de la identidad ficticia anterior
    expect(screen.queryByText(/Camila Ortiz/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lima Centro/)).not.toBeInTheDocument();

    // El listado usa la API de clientes y la ficha consulta el mismo ID.
    window.location.hash = '#/clientes';
    const enlace = await screen.findByRole('link', { name: /Ver detalle/ });
    await userEvent.setup().click(enlace);
    expect(await screen.findByRole('heading', { name: 'Datos del cliente' })).toBeInTheDocument();
    expect(screen.getAllByText('99999991').length).toBeGreaterThan(0);
    expect(screen.getByText('cliente@example.com')).toBeInTheDocument();
  });

  it('abre la ficha con el UUID devuelto por el registro real', async () => {
    const servidor = montar();
    const usuario = await iniciarSesion(ASESORA);
    await usuario.click(await screen.findByRole('button', { name: 'Registrar cliente' }));

    const formulario = screen.getByRole('dialog', { name: 'Registrar cliente' });
    await usuario.type(within(formulario).getByPlaceholderText('8 dígitos'), '88887777');
    await usuario.click(within(formulario).getByRole('button', { name: 'Consultar DNI' }));
    expect(await within(formulario).findByDisplayValue('Ana Salazar Quispe')).toBeInTheDocument();
    await usuario.type(within(formulario).getByLabelText('Celular'), '988877766');
    await usuario.type(within(formulario).getByLabelText('Correo electrónico'), 'ana.salazar@example.com');
    await usuario.click(within(formulario).getByRole('button', { name: 'Revisar y registrar' }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar registro' }));

    await waitFor(() => expect(window.location.hash).toBe('#/clientes/22222222-2222-4222-8222-222222222222'));
    expect(await screen.findByRole('heading', { name: 'Datos del cliente' })).toBeInTheDocument();
    expect(servidor.llamadas.some((llamada) => llamada.ruta === '/api/clientes' && llamada.metodo === 'POST')).toBe(true);
  });

  it('muestra en la ficha solo los campos que corresponden a RUC 10 o RUC 20', async () => {
    const servidor = montar();
    servidor.agregarCliente({
      id: '33333333-3333-4333-8333-333333333333', tipoDocumento: 'RUC 10',
      numeroDocumento: '10888877771', nombre: 'Ana Salazar Quispe',
      dniTitular: '88887777', estadoSunat: 'ACTIVO', condicionSunat: 'HABIDO'
    });
    servidor.agregarCliente({
      id: '44444444-4444-4444-8444-444444444444', tipoDocumento: 'RUC 20',
      numeroDocumento: '20888877771', nombre: 'Andes del Sur SAC',
      domicilio: 'Av. Los Andes 123', representanteNombre: 'Lucía Torres Vega',
      representanteDni: '77776666', estadoSunat: 'ACTIVO', condicionSunat: 'HABIDO'
    });
    await iniciarSesion(ASESORA);

    window.location.hash = '#/clientes/33333333-3333-4333-8333-333333333333';
    expect(await screen.findByRole('heading', { name: 'Datos de RUC 10' })).toBeInTheDocument();
    expect(screen.getByText('DNI del titular')).toBeInTheDocument();
    expect(screen.queryByText('DNI del representante')).not.toBeInTheDocument();

    window.location.hash = '#/clientes/44444444-4444-4444-8444-444444444444';
    expect(await screen.findByRole('heading', { name: 'Datos de RUC 20' })).toBeInTheDocument();
    expect(screen.getByText('DNI del representante')).toBeInTheDocument();
    expect(screen.queryByText('DNI del titular')).not.toBeInTheDocument();
  });

  it('no guarda ningún token ni sesión en el almacenamiento del navegador', async () => {
    montar();
    await iniciarSesion(ASESORA);
    await waitFor(() => expect(etiquetasMenu()).toContain('Clientes'));
    const claves = Object.keys(localStorage).join(' ').toLowerCase();
    expect(claves).not.toMatch(/sesion|token|clave|auth/);
    expect(JSON.stringify({ ...localStorage })).not.toContain(ASESORA.clave);
  });

  it('muestra un mensaje si el cliente solicitado no existe', async () => {
    montar();
    await iniciarSesion(ASESORA);
    window.location.hash = '#/clientes/00000000-0000-0000-0000-000000000000';
    expect(await screen.findByText('Cliente no encontrado')).toBeInTheDocument();
  });
});

describe('B · login correcto como gerencia', () => {
  it('el menú solo tiene Dashboard y las rutas de asesor redirigen al dashboard', async () => {
    montar();
    await iniciarSesion(GERENTE);
    await waitFor(() => expect(etiquetasMenu()).toEqual(['Dashboard']));
    expect(screen.getAllByText('Mateo Rivas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gerencia').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Ver ubicación/ })).not.toBeInTheDocument(); // agencia_id NULL: sin chip

    for (const ruta of ['#/clientes', '#/clientes/C001', '#/solicitud', '#/prestamos', '#/prestamos/PR-1001', '#/cuotas']) {
      window.location.hash = ruta;
      await waitFor(() => expect(window.location.hash).toBe('#/'));
      expect(etiquetasMenu()).toEqual(['Dashboard']);
    }
    expect(await screen.findAllByText('Tu rol no tiene acceso a ese módulo.')).not.toHaveLength(0);
    // Búsqueda global y avisos (recorren clientes y préstamos) no se ofrecen a gerencia
    expect(screen.queryByRole('button', { name: /Notificaciones/ })).not.toBeInTheDocument();
  });

  it('el dashboard de gerencia muestra el resumen por agencia y los morosos', async () => {
    montar();
    const u = await iniciarSesion(GERENTE);
    expect(await screen.findByText('Resumen por agencia', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Clientes morosos')).toBeInTheDocument();
    expect(screen.getByText('En proceso extrajudicial')).toBeInTheDocument();
    // datos reales de GET /api/dashboard: el cliente moroso y las agencias de la base
    expect(screen.getAllByText('Rosa Moroso Prueba').length).toBeGreaterThan(0);
    await u.click(screen.getByRole('combobox', { name: 'Alcance de los indicadores' }));
    expect(await screen.findByRole('option', { name: 'Agencia Norte Prueba' })).toBeInTheDocument();
  });

  it('entrar por la URL de un módulo prohibido nunca llega a montar ese módulo', async () => {
    window.location.hash = '#/prestamos';
    const srv = crearServidor([GERENTE]); srv.instalar(); srv.abrirSesion(GERENTE);
    render(<App />);
    await waitFor(() => expect(etiquetasMenu()).toEqual(['Dashboard']));
    expect(screen.queryByRole('heading', { name: 'Préstamos' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
  });
});

describe('C · credenciales incorrectas', () => {
  it('no crea sesión y muestra un mensaje en español', async () => {
    montar();
    await iniciarSesion({ correo: 'valeria@ejemplo.com', clave: 'incorrecta' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue(''); // la contraseña no se conserva
  });

  it('valida el formato del correo antes de llamar al servidor', async () => {
    const srv = montar();
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Correo electrónico'), 'no-es-un-correo');
    await u.type(screen.getByLabelText('Contraseña'), 'x');
    await u.click(screen.getByRole('button', { name: /Ingresar/ }));
    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument();
    expect(srv.llamadas.some((l) => l.ruta === '/api/auth/login')).toBe(false);
  });

  it('un fallo de red lo dice con claridad y no cuenta como credenciales incorrectas', async () => {
    montar();
    vi.stubGlobal('fetch', vi.fn(async (r: RequestInfo | URL) => { if (String(r).endsWith('/login')) throw new TypeError('x'); return new Response(null, { status: 401 }); }));
    await iniciarSesion(ASESORA);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });
});

describe('D · usuario desactivado y otros bloqueos', () => {
  it.each([
    ['CUENTA_DESACTIVADA', 'Tu cuenta está desactivada. Contacta con el administrador.'],
    ['AGENCIA_INACTIVA', 'Tu agencia está inactiva. Contacta con el administrador.'],
    ['ROL_NO_RECONOCIDO', 'Tu cuenta tiene un rol no reconocido. Contacta con el administrador.'],
    ['DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.']
  ])('%s deniega el acceso sin mostrar contenido protegido', async (codigo, mensaje) => {
    montar([{ ...ASESORA, bloqueo: { status: 403, codigo } }]);
    await iniciarSesion(ASESORA);
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });

  it('un rol no reconocido que llegue al cliente no recibe ningún módulo', async () => {
    const raro: CuentaFalsa = { ...ASESORA, perfil: { ...ASESORA.perfil, rol: 'auditor' } };
    const srv = crearServidor([raro]); srv.instalar(); srv.abrirSesion(raro);
    render(<App />);
    expect(await screen.findByText('Tu cuenta no tiene acceso')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });
});

describe('E · recarga del navegador', () => {
  it('mientras se consulta la sesión no se pinta nada protegido y luego se restaura el perfil real', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar(); srv.abrirSesion(ASESORA);
    const soltar = srv.retenerMe();
    render(<App />);

    expect(screen.getByText('Verificando tu sesión…')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument(); // tampoco parpadea el login

    soltar();
    await waitFor(() => expect(etiquetasMenu()).toContain('Clientes'));
    expect(screen.getAllByText('Valeria Quintana').length).toBeGreaterThan(0);
    expect(srv.llamadas.filter((l) => l.ruta === '/api/auth/me')).toHaveLength(1); // sin consultas duplicadas
  });

  it('sin sesión vigente se muestra el login', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('si el servidor no responde, ofrece reintentar en lugar de mostrar el login o el contenido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x'); }));
    render(<App />);
    expect(await screen.findByText('No se pudo verificar tu sesión')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('al volver a la pestaña, una sesión caducada o revocada en el servidor devuelve al login con aviso', async () => {
    const srv = montar();
    await iniciarSesion(ASESORA);
    await waitFor(() => expect(etiquetasMenu()).toContain('Clientes'));

    srv.expirarSesion();
    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 120_000); // supera el intervalo mínimo entre comprobaciones
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByText('Tu sesión ha expirado. Inicia sesión nuevamente.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });
});

describe('F · cierre de sesión', () => {
  async function abrirMenuUsuario() {
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Menú de cuenta' }));
    return u;
  }

  it('cierra en el servidor, vuelve al login y la ruta protegida deja de ser accesible', async () => {
    const srv = montar();
    await iniciarSesion(ASESORA);
    await waitFor(() => expect(etiquetasMenu()).toContain('Clientes'));
    window.location.hash = '#/prestamos/PR-1001';

    const u = await abrirMenuUsuario();
    await u.click(await screen.findByRole('menuitem', { name: /Cerrar sesión/ }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(srv.llamadas.some((l) => l.ruta === '/api/auth/logout' && l.metodo === 'POST')).toBe(true);
    expect(window.location.hash).toBe('#/'); // el siguiente usuario no hereda el enlace profundo
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });

  it('si el servidor no confirma el cierre, la sesión NO se da por cerrada', async () => {
    const srv = montar();
    await iniciarSesion(ASESORA);
    await waitFor(() => expect(etiquetasMenu()).toContain('Clientes'));
    srv.fallarLogout(true);

    const u = await abrirMenuUsuario();
    await u.click(await screen.findByRole('menuitem', { name: /Cerrar sesión/ }));

    expect(await screen.findByText(/No se pudo cerrar la sesión/)).toBeInTheDocument();
    expect(etiquetasMenu()).toContain('Clientes'); // sigue dentro
  });
});

describe('G · tarjeta de ubicación de la agencia', () => {
  async function entrarComoAsesora(cuenta: CuentaFalsa = ASESORA) {
    const srv = crearServidor([cuenta]); srv.instalar(); srv.abrirSesion(cuenta);
    render(<App />);
    return screen.findByRole('button', { name: /Ver ubicación/ });
  }

  it('al pasar el cursor muestra los datos reales de la ubicación y se cierra al salir', async () => {
    const chip = await entrarComoAsesora();
    const u = userEvent.setup();
    await u.hover(chip);
    const tarjeta = await screen.findByRole('dialog', { name: /Ubicación de Agencia Sur Prueba/ });
    expect(within(tarjeta).getByText('Av. Ficticia 123')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Distrito Prueba')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Provincia Prueba')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Departamento Prueba')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Activa')).toBeInTheDocument();

    await u.unhover(chip);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Ubicación de/ })).not.toBeInTheDocument());
  });

  it('con teclado: Enter la abre y Escape la cierra', async () => {
    const chip = await entrarComoAsesora();
    const u = userEvent.setup();
    chip.focus();
    await u.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: /Ubicación de/ })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Ubicación de/ })).not.toBeInTheDocument());
  });

  it('con un clic se fija abierta y otro clic fuera la cierra', async () => {
    const chip = await entrarComoAsesora();
    const u = userEvent.setup();
    await u.click(chip);
    expect(await screen.findByRole('dialog', { name: /Ubicación de/ })).toBeInTheDocument();
    await u.unhover(chip); // fijada: no se cierra al retirar el cursor
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByRole('dialog', { name: /Ubicación de/ })).toBeInTheDocument();
    await u.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Ubicación de/ })).not.toBeInTheDocument());
  });

  it('campos faltantes: dirección no registrada y se omiten los vacíos; agencia inactiva se indica', async () => {
    const sinDireccion: CuentaFalsa = {
      ...GERENTE,
      perfil: { ...GERENTE.perfil, agenciaId: 'a1' },
      agencia: { ...AGENCIA_PRUEBA, activa: false, ubicacion: { departamento: 'Departamento Prueba', provincia: '  ', distrito: 'Distrito Prueba', direccion: null } }
    };
    const chip = await entrarComoAsesora(sinDireccion);
    await userEvent.setup().click(chip);
    const tarjeta = await screen.findByRole('dialog', { name: /Ubicación de/ });
    expect(within(tarjeta).getByText('Dirección no registrada')).toBeInTheDocument();
    expect(within(tarjeta).queryByText('Provincia')).not.toBeInTheDocument();
    expect(within(tarjeta).getByText('Distrito')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Inactiva')).toBeInTheDocument();
  });
});
