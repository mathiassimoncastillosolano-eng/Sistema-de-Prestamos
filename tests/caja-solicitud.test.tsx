/* Efectivo de la caja del asesor en «Registrar préstamo» (reemplaza al antiguo límite diario de S/ 50,000).
   Usan el servidor FALSO (tests/helpers/fake-server.ts), que imita GET /api/caja y el rechazo SALDO_CAJA_INSUFICIENTE del
   registro. La contabilidad real (libro, triggers, concurrencia) la cubren las pruebas del backend con PostgreSQL. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { estadoCaja, puedeDesembolsar } from '@/features/caja/caja-utils';
import { money as formato } from '@/lib/format';
import { ASESORA, crearServidor } from './helpers/fake-server';

const money = (x: number) => formato(x).replace(' ', ' ');
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

const panel = () => screen.getByRole('region', { name: 'Caja del asesor' });
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

describe('Caja · estado según el efectivo', () => {
  const con = (saldo: number, estado: 'ABIERTA' | 'CERRADA' = 'ABIERTA') => ({ estado, saldo, limite: 50000 });

  it.each([
    [50000, 'ABIERTA', 'llena'],
    [30000, 'ABIERTA', 'normal'],
    [10000, 'ABIERTA', 'normal'],
    [9999.99, 'ABIERTA', 'baja'],
    [0.01, 'ABIERTA', 'baja'],
    [0, 'ABIERTA', 'vacia'],
    [30000, 'CERRADA', 'cerrada']
  ] as const)('con %s en una caja %s el estado es %s', (saldo, estado, esperado) => {
    expect(estadoCaja(con(saldo, estado))).toBe(esperado);
  });

  it('solo se puede desembolsar con la caja abierta y efectivo para el mínimo', () => {
    expect(puedeDesembolsar(con(1000), 1000)).toBe(true);
    expect(puedeDesembolsar(con(999.99), 1000)).toBe(false);
    expect(puedeDesembolsar(con(0), 1000)).toBe(false);
    expect(puedeDesembolsar(con(50000, 'CERRADA'), 1000)).toBe(false);
  });
});

describe('Registrar préstamo · efectivo de la caja del asesor', () => {
  it('muestra el efectivo y lo que puede solicitar con datos del servidor', async () => {
    montar((srv) => srv.fijarSaldoCaja(32000));
    await waitFor(() => expect(panel()).toHaveTextContent(money(32000)));
    expect(panel()).toHaveTextContent(money(50000));
    expect(panel()).toHaveTextContent(money(18000));
    expect(panel()).toHaveTextContent('Puedes registrar préstamos hasta el efectivo que tienes en caja.');
    expect(within(panel()).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  });

  it('con poco efectivo avisa cuánto queda sin bloquear', async () => {
    const { u } = montar((srv) => srv.fijarSaldoCaja(2500));
    await waitFor(() => expect(panel()).toHaveTextContent('Efectivo bajo'));
    expect(panel()).toHaveTextContent(`Te quedan ${money(2500)}`);
    await hastaCondiciones(u);
  });

  it('con S/ 500 deja elegir cliente pero no iniciar la solicitud', async () => {
    const { u } = montar((srv) => srv.fijarSaldoCaja(500));
    await waitFor(() => expect(panel()).toHaveTextContent(money(500)));
    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(screen.getByRole('button', { name: /Cliente de prueba/ })).toHaveAttribute('aria-pressed', 'true');
    expect(continuar()).toBeDisabled();
  });

  it('con la caja en cero indica que se necesita una reposición', async () => {
    const { u } = montar((srv) => srv.fijarSaldoCaja(0));
    await waitFor(() => expect(panel()).toHaveTextContent('Sin efectivo'));
    expect(panel()).toHaveTextContent('Solicita una reposición a gerencia.');
    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(continuar()).toBeDisabled();
  });

  it('con la caja cerrada no se puede iniciar', async () => {
    const { u } = montar((srv) => srv.fijarEstadoCaja('CERRADA'));
    await waitFor(() => expect(panel()).toHaveTextContent('Caja cerrada'));
    await u.click(await screen.findByRole('button', { name: /Cliente de prueba/ }));
    expect(continuar()).toBeDisabled();
  });

  it('con S/ 1,000 de efectivo admite exactamente S/ 1,000 y no S/ 1,000.01', async () => {
    const { u } = montar((srv) => srv.fijarSaldoCaja(1000));
    await hastaCondiciones(u);
    await waitFor(() => expect(screen.getByText(`Máximo disponible: ${money(1000)} (el efectivo de tu caja) · Mínimo ${money(1000)}`)).toBeInTheDocument());

    await escribir(u, '1000.01');
    expect(await screen.findByText(`El monto supera el efectivo de tu caja (${money(1000)}). Solicita una reposición a gerencia.`)).toBeInTheDocument();
    expect(continuar()).toBeDisabled();

    await escribir(u, '1000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
  });

  it('ya no existe tope por día: con la caja llena se pueden registrar más de S/ 50,000 acumulados mientras haya efectivo', async () => {
    const { u } = montar((srv) => srv.fijarSaldoCaja(50000));
    await hastaCondiciones(u);
    await escribir(u, '9000'); // el cliente de prueba tiene S/ 10,000 de capacidad
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
  });

  it('si el cliente puede menos que la caja, manda la capacidad del cliente', async () => {
    const { u } = montar((srv) => { srv.fijarSaldoCaja(45000); srv.fijarCapacidad(CLIENTE, 9000); });
    await hastaCondiciones(u);
    await waitFor(() => expect(screen.getByText(`Máximo disponible: ${money(1000)} · Mínimo ${money(1000)}`)).toBeInTheDocument());

    await escribir(u, '2000');
    expect(await screen.findByText(`El monto supera la capacidad disponible del cliente (${money(1000)}).`)).toBeInTheDocument();
    expect(continuar()).toBeDisabled();
  });

  it('si otro registro gasta el efectivo antes de confirmar, muestra el rechazo del servidor y actualiza el panel', async () => {
    const { u, srv } = montar((s) => s.fijarSaldoCaja(8000));
    await hastaCondiciones(u);
    await escribir(u, '5000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
    await u.click(continuar());
    await screen.findByRole('heading', { name: 'Revisión y confirmación' });

    srv.fijarSaldoCaja(3000); // otro préstamo del mismo asesor, registrado en otra pestaña
    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await screen.findByRole('button', { name: 'Registrar' }));

    const aviso = await screen.findByText('Tu caja no tiene efectivo suficiente');
    const cuadro = aviso.closest('[role="alert"]') as HTMLElement;
    expect(cuadro).toHaveTextContent(money(3000));
    expect(cuadro).toHaveTextContent(money(5000));
    expect(cuadro).toHaveTextContent(money(2000));
    expect(cuadro).toHaveTextContent('El préstamo no se registró');
    await waitFor(() => expect(panel()).toHaveTextContent(money(3000)));
    expect(srv.saldoCajaActual()).toBe(3000); // el rechazado no descontó nada
  });

  it('después de registrar un préstamo, el servidor descontó el desembolso de la caja', async () => {
    const { u, srv } = montar();
    await hastaCondiciones(u);
    await escribir(u, '5000');
    await waitFor(() => expect(continuar()).toBeEnabled(), { timeout: 4000 });
    await u.click(continuar());
    await screen.findByRole('heading', { name: 'Revisión y confirmación' });
    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await screen.findByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(window.location.hash).not.toBe('#/solicitud'));
    expect(srv.saldoCajaActual()).toBe(45000);
  });
});
