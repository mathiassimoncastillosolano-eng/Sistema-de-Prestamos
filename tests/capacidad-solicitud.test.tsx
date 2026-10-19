/* Capacidad de endeudamiento en «Registrar préstamo» y navegación global.
   Usan el servidor FALSO (tests/helpers/fake-server.ts): prueban lo que hace el frontend con la capacidad que entrega
   GET /api/prestamos/capacidad. La fórmula y la validación del registro las cubren las pruebas del backend. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { money as formato } from '@/lib/format';
import { ASESORA, crearServidor } from './helpers/fake-server';

/** Importe como lo lee la prueba (la app separa «S/» con un espacio de no separación). */
const money = (x: number) => formato(x).replace('\u00A0', ' ');

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const OTRO = '33333333-3333-4333-8333-333333333333';

function montar(hash: string, preparar?: (srv: ReturnType<typeof crearServidor>) => void) {
  window.location.hash = hash;
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  srv.agregarCliente({ id: OTRO, numero: 7, numeroDocumento: '77777777', nombre: 'Segundo Cliente Prueba' });
  preparar?.(srv);
  render(<App />);
  return { srv, u: userEvent.setup() };
}

async function elegir(u: ReturnType<typeof userEvent.setup>, nombre: RegExp) {
  await u.click(await screen.findByRole('button', { name: nombre }));
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByRole('heading', { name: 'Condiciones del préstamo' });
}

const capacidad = () => screen.getByRole('region', { name: 'Capacidad de endeudamiento' });
const monto = () => screen.getByLabelText(/Monto solicitado/);

async function escribirMonto(u: ReturnType<typeof userEvent.setup>, valor: string) {
  await u.clear(monto());
  await u.type(monto(), valor);
}

describe('Registrar préstamo · capacidad disponible', () => {
  it('muestra límite, capital pendiente y capacidad junto al cliente, y el máximo bajo el monto', async () => {
    const { u } = montar('#/solicitud', (srv) => srv.fijarCapacidad(CLIENTE, 3738.29, 5658.04));
    await elegir(u, /Cliente de prueba/);

    await waitFor(() => expect(capacidad()).toHaveTextContent(money(6261.71)));
    expect(capacidad()).toHaveTextContent(money(10000));
    expect(capacidad()).toHaveTextContent(money(3738.29));
    expect(screen.getByText(`Máximo disponible: ${money(6261.71)} · Mínimo ${money(1000)}`)).toBeInTheDocument();
  });

  it('con S/ 6,261.71 disponibles admite 6,261.71 y rechaza 6,261.72', async () => {
    const { u, srv } = montar('#/solicitud', (s) => s.fijarCapacidad(CLIENTE, 3738.29));
    await elegir(u, /Cliente de prueba/);
    await waitFor(() => expect(capacidad()).toHaveTextContent(money(6261.71)));
    await u.type(screen.getByLabelText(/Plazo/), '12');

    await escribirMonto(u, '6261.72');
    expect(await screen.findByText(`El monto supera la capacidad disponible del cliente (${money(6261.71)}).`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(srv.llamadas.some((l) => l.ruta === '/api/prestamos/simulacion' && (l.cuerpo as { capital: number }).capital === 6261.72)).toBe(false);

    await escribirMonto(u, '6261.71');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled(), { timeout: 4000 });
    expect(screen.queryByText(/supera la capacidad/)).not.toBeInTheDocument();
  });

  it('el monto no deja escribir más de 2 decimales', async () => {
    const { u } = montar('#/solicitud', (s) => s.fijarCapacidad(CLIENTE, 0));
    await elegir(u, /Cliente de prueba/);

    await escribirMonto(u, '5098.49885515');
    expect(monto()).toHaveValue('5098.49');
    await escribirMonto(u, '1500,756');
    expect(monto()).toHaveValue('1500,75');
  });

  it('al cambiar de cliente usa la capacidad del nuevo, nunca la del anterior', async () => {
    const { u } = montar('#/solicitud', (srv) => {
      srv.fijarCapacidad(CLIENTE, 2000);  // disponible 8,000
      srv.fijarCapacidad(OTRO, 7000);     // disponible 3,000
    });
    await elegir(u, /Cliente de prueba/);
    await waitFor(() => expect(capacidad()).toHaveTextContent(money(8000)));
    await escribirMonto(u, '5000');
    expect(screen.queryByText(/supera la capacidad/)).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Atrás' }));
    await u.click(await screen.findByRole('button', { name: /Segundo Cliente Prueba/ }));
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Condiciones del préstamo' });

    await waitFor(() => expect(capacidad()).toHaveTextContent(money(3000)));
    expect(capacidad()).not.toHaveTextContent(money(8000));
    // los 5,000 escritos para el cliente anterior ya no valen para este
    expect(await screen.findByText(`El monto supera la capacidad disponible del cliente (${money(3000)}).`)).toBeInTheDocument();
    await escribirMonto(u, '3000');
    expect(await screen.findByText(`Máximo disponible: ${money(3000)} · Mínimo ${money(1000)}`)).toBeInTheDocument();
  });

  it('con capacidad S/ 0.00 avisa que no puede pedir un préstamo y no deja continuar', async () => {
    const { u } = montar('#/solicitud', (srv) => srv.fijarCapacidad(CLIENTE, 10000));
    await elegir(u, /Cliente de prueba/);

    expect(await screen.findByText(/no tiene capacidad suficiente para un préstamo nuevo: dispone de/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Plazo/), '12');
    await escribirMonto(u, '1000');
    expect(await screen.findByText('El cliente no tiene capacidad suficiente para un préstamo nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('con capacidad menor al mínimo (S/ 900) tampoco deja continuar', async () => {
    const { u } = montar('#/solicitud', (srv) => srv.fijarCapacidad(CLIENTE, 9100));
    await elegir(u, /Cliente de prueba/);

    expect(await screen.findByText(new RegExp(`dispone de ${money(900)} y el monto mínimo es ${money(1000)}`))).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Plazo/), '12');
    await escribirMonto(u, '1000');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('si la consulta de capacidad falla no permite avanzar con un valor inventado y ofrece reintentar', async () => {
    const { u, srv } = montar('#/solicitud', (s) => s.fijarCapacidad(CLIENTE, 'error'));
    await elegir(u, /Cliente de prueba/);

    const aviso = await screen.findByRole('alert', { name: 'Capacidad de endeudamiento' });
    expect(aviso).toHaveTextContent('No se pudo consultar la capacidad del cliente');
    await u.type(screen.getByLabelText(/Plazo/), '12');
    await escribirMonto(u, '1000');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(srv.llamadas.some((l) => l.ruta === '/api/prestamos/simulacion')).toBe(false);

    srv.fijarCapacidad(CLIENTE, 0);
    await u.click(within(aviso).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(capacidad()).toHaveTextContent(money(10000)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled(), { timeout: 4000 });
  });

  it('mientras se consulta la capacidad no se puede continuar', async () => {
    let soltar: () => void = () => {};
    const { u } = montar('#/solicitud', (srv) => { soltar = srv.retenerCapacidad(); });
    await elegir(u, /Cliente de prueba/);

    expect(screen.getByText('Consultando la capacidad del cliente…')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Plazo/), '12');
    await escribirMonto(u, '1000');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    soltar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled(), { timeout: 4000 });
  });

  it('el perfil del cliente y la solicitud muestran la misma capacidad', async () => {
    const { u } = montar(`#/clientes/${CLIENTE}`, (srv) => srv.fijarCapacidad(CLIENTE, 3738.29, 5658.04));

    await waitFor(() => expect(screen.getAllByText(money(6261.71)).length).toBeGreaterThan(0));
    expect(screen.getAllByText(money(3738.29)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(money(5658.04)).length).toBeGreaterThan(0);

    await u.click(screen.getByRole('button', { name: /Nueva solicitud/ }));
    await screen.findByRole('heading', { name: 'Condiciones del préstamo' });
    await waitFor(() => expect(capacidad()).toHaveTextContent(money(6261.71)));
  });

  it('la tarjeta del cliente seleccionado ya no muestra el código, pero el perfil sí', async () => {
    const { u } = montar('#/solicitud');
    await elegir(u, /Segundo Cliente Prueba/);

    const tarjeta = screen.getByRole('region', { name: 'Cliente seleccionado' });
    expect(tarjeta).toHaveTextContent('DNI 77777777');
    expect(tarjeta).toHaveTextContent('999999999');
    expect(tarjeta).not.toHaveTextContent('Código de cliente');
    expect(tarjeta.textContent).not.toMatch(/#|\b7\b/);
  });
});

describe('Navegación global', () => {
  const encabezado = async () => within(await screen.findByRole('banner'));

  it.each([
    ['#/', 'Dashboard'],
    ['#/clientes', 'Clientes'],
    [`#/clientes/${CLIENTE}`, 'Clientes'],
    ['#/solicitud', 'Nueva solicitud'],
    ['#/prestamos', 'Préstamos']
  ])('%s muestra «› %s» en el encabezado', async (hash, titulo) => {
    montar(hash);
    const barra = await encabezado();
    expect(await barra.findByText(titulo)).toBeInTheDocument();
    expect(barra.getByText('›')).toBeInTheDocument();
  });

  it('la barra superior ya no muestra la fecha y conserva agencia, tema y usuario', async () => {
    montar('#/clientes');
    const barra = await encabezado();
    await barra.findByText('Clientes');
    expect(screen.getByRole('banner').textContent).not.toMatch(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/i);
    expect(barra.getByRole('button', { name: /Agencia Sur Prueba/ })).toBeInTheDocument();
  });

  it('el menú lateral solo tiene «Minimizar» abajo (sin el perfil repetido) y sigue minimizando', async () => {
    const { u } = montar('#/clientes');
    const barra = await screen.findByRole('complementary', { name: 'Barra lateral' });
    expect(within(barra).queryByText('Valeria Quintana')).not.toBeInTheDocument();
    expect(within(barra).queryByText('Asesor de préstamos')).not.toBeInTheDocument();

    await u.click(within(barra).getByRole('button', { name: 'Minimizar el menú' }));
    expect(within(barra).getByRole('button', { name: 'Expandir el menú' })).toBeInTheDocument();
    await u.click(within(barra).getByRole('button', { name: 'Expandir el menú' }));
    expect(within(barra).getByRole('button', { name: 'Minimizar el menú' })).toHaveTextContent('Minimizar');
  });
});
