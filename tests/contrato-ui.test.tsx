/* Pruebas de la interfaz del contrato y del perfil consolidado. Usan el servidor FALSO a nivel de fetch: comprueban lo que hace
   el frontend con las respuestas del contrato de la API, NO el backend ni la base de datos reales. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/app/App';
import { ASESORA, DETALLE, crearServidor } from './helpers/fake-server';

const CLIENTE = '11111111-1111-4111-8111-111111111111';

function montar(hash: string) {
  window.location.hash = hash;
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  render(<App />);
  return srv;
}

function conEscritorio<T>(fn: () => Promise<T>) {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  return fn().finally(() => { window.matchMedia = original; });
}

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:contrato-prueba'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { vi.restoreAllMocks(); });

async function hastaConfirmacion() {
  const u = userEvent.setup();
  const grupo = await screen.findByRole('group', { name: 'Clientes' });
  await u.click(within(grupo).getAllByRole('button')[0]);
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Fecha de desembolso');
  await u.type(screen.getByLabelText(/Monto solicitado/), '1000');
  await u.type(screen.getByLabelText(/Plazo/), '2');
  const continuar = screen.getByRole('button', { name: 'Continuar' });
  await waitFor(() => expect(continuar).toBeEnabled(), { timeout: 4000 });
  await u.click(continuar);
  await screen.findByRole('heading', { name: 'Revisión y confirmación' });
  return u;
}

describe('Confirmación · borrador del contrato', () => {
  it('pide el borrador con lo revisado, ofrece ver y descargar, mantiene el PDF del cronograma y no registra nada', async () => {
    const srv = montar('#/solicitud');
    await hastaConfirmacion();
    const tarjeta = await screen.findByRole('region', { name: 'Contrato del préstamo' });
    await within(tarjeta).findByRole('button', { name: /Ver contrato/ });
    expect(within(tarjeta).getByRole('button', { name: /Descargar borrador PDF/ })).toBeInTheDocument();
    expect(within(tarjeta).getByText(/BORRADOR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar cronograma PDF' })).toBeInTheDocument();

    const pedido = srv.llamadas.filter((l) => l.ruta === '/api/prestamos/contrato-preliminar').at(-1);
    expect(pedido?.metodo).toBe('POST');
    expect(pedido?.cuerpo).toMatchObject({ clienteId: CLIENTE, capital: 1000, plazoMeses: 2 });
    expect((pedido?.cuerpo as { totalContractualEsperado?: number }).totalContractualEsperado).toBeGreaterThan(0);
    expect(srv.llamadas.some((l) => l.ruta === '/api/prestamos' && l.metodo === 'POST')).toBe(false);
  });

  it('«Ver contrato» abre la vista previa del borrador sin registrar el préstamo', async () => {
    const srv = montar('#/solicitud');
    const u = await hastaConfirmacion();
    await u.click(await screen.findByRole('button', { name: /Ver contrato/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Contrato (borrador)')).toBeInTheDocument();
    await waitFor(() => expect(within(dialogo).getByTitle('Vista previa del contrato')).toBeInTheDocument(), { timeout: 5000 });
    expect(srv.llamadas.some((l) => l.ruta === '/api/prestamos' && l.metodo === 'POST')).toBe(false);
  });

  it('sin borrador no se puede registrar: si falla, se explica y se reintenta', async () => {
    const srv = montar('#/solicitud');
    srv.fallarContrato(true);
    const u = await hastaConfirmacion();
    const alerta = await screen.findByText(/No se pudo completar la operaci/);
    expect(alerta).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar préstamo/ })).toBeDisabled();
    srv.fallarContrato(false);
    await u.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('button', { name: /Ver contrato/ });
    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar préstamo/ })).toBeEnabled());
  });
});

describe('Detalle y listado · acciones del contrato', () => {
  it('el detalle ofrece los tres documentos por separado y «Ver contrato» muestra el contrato guardado', async () => {
    const srv = montar(`#/prestamos/${DETALLE.id}`);
    const u = userEvent.setup();
    await screen.findByText('PR-1001');
    expect(screen.getByRole('button', { name: 'Descargar cronograma PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar contrato PDF' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Ver contrato/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Contrato PR-1001')).toBeInTheDocument();
    expect(srv.llamadas.some((l) => l.ruta === `/api/prestamos/${DETALLE.id}/contrato` && l.metodo === 'GET')).toBe(true);
  });

  it('un préstamo sin contrato guardado muestra el motivo y no inventa uno', async () => {
    // El préstamo PR-1002 del listado no tiene contrato en el servidor falso (se registró antes de que existiera).
    await conEscritorio(async () => {
      const srv = montar('#/prestamos');
      const u = userEvent.setup();
      const tabla = await screen.findByRole('table', { name: 'Listado de préstamos' });
      await u.click(within(tabla).getByRole('button', { name: /Acciones del préstamo PR-1002/ }));
      await u.click(await screen.findByRole('menuitem', { name: /Ver contrato/ }));
      await screen.findByText(/no tiene contrato guardado/);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(srv.llamadas.some((l) => /\/contrato$/.test(l.ruta))).toBe(true);
    });
  });

  it('el menú de acciones del listado ofrece los tres documentos y abrirlo no navega al detalle', async () => {
    await conEscritorio(async () => {
      montar('#/prestamos');
      const u = userEvent.setup();
      const tabla = await screen.findByRole('table', { name: 'Listado de préstamos' });
      await u.click(within(tabla).getByRole('button', { name: /Acciones del préstamo PR-1001/ }));
      for (const n of [/Descargar cronograma PDF/, /Ver contrato/, /Descargar contrato PDF/]) expect(await screen.findByRole('menuitem', { name: n })).toBeInTheDocument();
      expect(window.location.hash).toBe('#/prestamos');
    });
  });
});

describe('Perfil financiero consolidado', () => {
  const integrante = (o: Record<string, unknown>) => ({ clienteId: 'x', nombre: 'X', tipoDocumento: 'DNI', numeroDocumento: '1', relacion: 'TITULAR', consultado: false, detalleVisible: true, capitalPendiente: 0, importePendiente: 0, prestamosConSaldo: 0, cuotasPendientes: 0, cuotasVencidas: 0, cuotasPagadas: 0, ...o });

  it('muestra los cuatro indicadores y las entidades vinculadas con su deuda', async () => {
    const srv = crearServidor([ASESORA]);
    srv.instalar(); srv.abrirSesion(ASESORA);
    srv.fijarPerfil(CLIENTE, {
      clienteId: CLIENTE, tipoDocumento: 'DNI', numeroDocumento: '99999991', nombre: 'Cliente de prueba',
      limite: 10000, capitalPendiente: 8000, importePendiente: 9100, disponible: 2000, deudaPropia: 0, deudaVinculada: 8000, consolidada: true,
      cuotasPendientes: 3, cuotasVencidas: 1, cuotasPagadas: 5,
      integrantes: [
        integrante({ clienteId: CLIENTE, nombre: 'Cliente de prueba', numeroDocumento: '99999991', consultado: true }),
        integrante({ clienteId: 'r10', nombre: 'Bodega Perez', tipoDocumento: 'RUC 10', numeroDocumento: '10999999911', relacion: 'NEGOCIO_DEL_TITULAR', capitalPendiente: 8000 })
      ],
      prestamos: []
    });
    window.location.hash = `#/clientes/${CLIENTE}`;
    render(<App />);
    for (const k of ['Deuda consolidada', 'Cuotas pendientes', 'Límite de endeudamiento', 'Capacidad disponible']) expect(await screen.findByText(k)).toBeInTheDocument();
    expect(screen.getByText(/Propia .*0\.00 · Vinculada .*8,000\.00/)).toBeInTheDocument();
    const vinculadas = screen.getByRole('region', { name: 'Entidades vinculadas' });
    expect(within(vinculadas).getByText('Bodega Perez')).toBeInTheDocument();
    expect(within(vinculadas).getByText(/RUC 10 10999999911/)).toBeInTheDocument();
  });

  it('un cliente sin vinculados lo indica y un fallo del perfil se avisa sin romper la ficha', async () => {
    const srv = crearServidor([ASESORA]);
    srv.instalar(); srv.abrirSesion(ASESORA);
    window.location.hash = `#/clientes/${CLIENTE}`;
    render(<App />);
    expect(await screen.findByText(/no tiene personas ni negocios vinculados/)).toBeInTheDocument();
  });

  it('si el perfil falla se avisa y la ficha sigue mostrando la capacidad', async () => {
    const srv = crearServidor([ASESORA]);
    srv.instalar(); srv.abrirSesion(ASESORA);
    srv.fijarPerfil(CLIENTE, 'error');
    window.location.hash = `#/clientes/${CLIENTE}`;
    render(<App />);
    expect(await screen.findByText(/No se pudo consultar el perfil financiero consolidado/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actividad crediticia' })).toBeInTheDocument();
  });
});
