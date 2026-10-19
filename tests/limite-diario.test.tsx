/* Límite diario de colocación del asesor (S/ 50,000) en «Registrar préstamo».
   Usan el servidor FALSO (tests/helpers/fake-server.ts), que imita GET /api/prestamos/limite-diario y el rechazo
   LIMITE_DIARIO_EXCEDIDO del registro. La suma real, la fecha de Lima y la concurrencia las cubren las pruebas del backend. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { estadoLimiteDiario, puedeIniciarSolicitud } from '@/features/loans/loan-utils';
import { money as formato } from '@/lib/format';
import { ASESORA, crearServidor } from './helpers/fake-server';

const money = (x: number) => formato(x).replace(' ', ' ');
const CLIENTE = '11111111-1111-4111-8111-111111111111';

function montar(preparar?: (srv: ReturnType<typeof crearServidor>) => void) {
  window.location.hash = '#/solicitud';
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  preparar?.(srv);
  render(<App />);
  return { srv, u: userEvent.setup() };
}

const panel = () => screen.getByRole('region', { name: 'Límite diario de colocación' });
const monto = () => screen.getByLabelText(/Monto solicitado/);
const continuar = () => screen.getByRole('button', { name: 'Continuar' });

async function hastaCondiciones(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
  await u.click(continuar());
  await screen.findByRole('heading', { name: 'Condiciones del préstamo' });
}

async function escribir(u: ReturnType<typeof userEvent.setup>, capital: string, plazo = '12') {
  await u.clear(screen.getByLabelText(/Plazo/));
  await u.type(screen.getByLabelText(/Plazo/), plazo);
  await u.clear(monto());
  await u.type(monto(), capital);
}

describe('Límite diario · cálculo del estado', () => {
  const con = (colocadoHoy: number) => ({
    fecha: '2026-10-18', limite: 50000, colocadoHoy, capitalMinimo: 1000,
    disponible: Math.round((50000 - colocadoHoy) * 100) / 100
  });

  it.each([
    [0, 'disponible', true],
    [32000, 'disponible', true],
    [47500, 'cerca', true],
    [48000, 'cerca', true],
    [49000, 'cerca', true],
    [49500, 'insuficiente', false],
    [49999.99, 'insuficiente', false],
    [50000, 'agotado', false]
  ] as const)('con %s colocados el estado es %s y puede iniciar: %s', (colocado, estado, puede) => {
    expect(estadoLimiteDiario(con(colocado))).toBe(estado);
    expect(puedeIniciarSolicitud(con(colocado))).toBe(puede);
  });
});

describe('Registrar préstamo · límite diario del asesor', () => {
  it('muestra límite, colocado hoy, disponible y mínimo con datos del servidor', async () => {
    montar((srv) => srv.fijarColocadoHoy(32000));
    await waitFor(() => expect(panel()).toHaveTextContent(money(18000)));
    expect(panel()).toHaveTextContent(money(50000));
    expect(panel()).toHaveTextContent(money(32000));
    expect(panel()).toHaveTextContent(money(1000));
    expect(panel()).toHaveTextContent('Puedes iniciar una nueva solicitud.');
    expect(within(panel()).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  });

  it('cerca del límite avisa cuánto queda sin bloquear', async () => {
    const { u } = montar((srv) => srv.fijarColocadoHoy(47500));
    await waitFor(() => expect(panel()).toHaveTextContent('Cerca del límite'));
    expect(panel()).toHaveTextContent(`Te quedan ${money(2500)} para hoy`);
    await hastaCondiciones(u);
  });

  it('con S/ 500 disponibles deja ver y elegir clientes pero no iniciar la solicitud', async () => {
    const { u } = montar((srv) => srv.fijarColocadoHoy(49500));
    await waitFor(() => expect(panel()).toHaveTextContent('Saldo insuficiente'));
    expect(panel()).toHaveTextContent(`te quedan ${money(500)} y el monto mínimo de un préstamo es ${money(1000)}`);

    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(screen.getByRole('button', { name: /Cliente de prueba/ })).toHaveAttribute('aria-pressed', 'true');
    expect(continuar()).toBeDisabled();
  });

  it('con S/ 0.01 disponibles tampoco se puede iniciar', async () => {
    const { u } = montar((srv) => srv.fijarColocadoHoy(49999.99));
    await waitFor(() => expect(panel()).toHaveTextContent(money(0.01)));
    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(continuar()).toBeDisabled();
  });

  it('con S/ 50,000 colocados muestra el límite agotado', async () => {
    const { u } = montar((srv) => srv.fijarColocadoHoy(50000));
    await waitFor(() => expect(panel()).toHaveTextContent('Límite agotado'));
    expect(panel()).toHaveTextContent(`Alcanzaste tu límite diario de ${money(50000)}`);
    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(continuar()).toBeDisabled();
  });

  it('con S/ 49,000 colocados admite exactamente S/ 1,000 y no S/ 1,000.01', async () => {
    const { u } = montar((srv) => srv.fijarColocadoHoy(49000));
    await hastaCondiciones(u);
    await waitFor(() => expect(screen.getByText(`Máximo disponible: ${money(1000)} (tu límite del día) · Mínimo ${money(1000)}`)).toBeInTheDocument());

    await escribir(u, '1000.01');
    expect(await screen.findByText(`El monto supera lo que te queda de tu límite diario (${money(1000)}).`)).toBeInTheDocument();
    expect(continuar()).toBeDisabled();

    await escribir(u, '1000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
  });

  it('si el cliente puede menos que el asesor, manda la capacidad del cliente', async () => {
    const { u } = montar((srv) => { srv.fijarColocadoHoy(45000); srv.fijarCapacidad(CLIENTE, 9000); });
    await hastaCondiciones(u);
    await waitFor(() => expect(screen.getByText(`Máximo disponible: ${money(1000)} · Mínimo ${money(1000)}`)).toBeInTheDocument());

    await escribir(u, '2000');
    expect(await screen.findByText(`El monto supera la capacidad disponible del cliente (${money(1000)}).`)).toBeInTheDocument();
    expect(continuar()).toBeDisabled();
  });

  it('si otro registro usa el cupo antes de confirmar, muestra el rechazo del servidor y actualiza el panel', async () => {
    const { u, srv } = montar((s) => s.fijarColocadoHoy(45000));
    await hastaCondiciones(u);
    await escribir(u, '5000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
    await u.click(continuar());
    await screen.findByRole('heading', { name: 'Revisión y confirmación' });
    await waitFor(() => expect(panel()).toHaveTextContent(money(5000)));

    srv.fijarColocadoHoy(48000); // otro préstamo del mismo asesor, registrado en otra pestaña
    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await screen.findByRole('button', { name: 'Registrar' }));

    const aviso = await screen.findByText('Se supera tu límite diario de colocación');
    const caja = aviso.closest('[role="alert"]') as HTMLElement;
    expect(caja).toHaveTextContent(money(48000));
    expect(caja).toHaveTextContent(money(2000));
    expect(caja).toHaveTextContent('El préstamo no se registró');
    await waitFor(() => expect(panel()).toHaveTextContent(money(48000)));
  });

  it('después de registrar un préstamo el panel muestra lo colocado', async () => {
    const { u } = montar();
    await hastaCondiciones(u);
    await escribir(u, '5000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
    await u.click(continuar());
    await screen.findByRole('heading', { name: 'Revisión y confirmación' });
    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await screen.findByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(window.location.hash).not.toBe('#/solicitud'));

    act(() => { window.location.hash = '#/solicitud'; });
    await waitFor(() => expect(panel()).toHaveTextContent(money(45000)));
    expect(panel()).toHaveTextContent(money(5000));
  });
});
