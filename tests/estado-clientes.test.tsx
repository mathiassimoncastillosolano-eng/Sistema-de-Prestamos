/* Estado del cliente (ACTIVO / MOROSO / EXTRAJUDICIAL) en la lista, la ficha y «Registrar préstamo».
   Usan el servidor FALSO (tests/helpers/fake-server.ts): prueban lo que hace el frontend con el estado que entrega la API.
   El cálculo del estado y el rechazo del registro los cubren las pruebas del backend. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { ASESORA, crearServidor } from './helpers/fake-server';

const ACTIVO = '11111111-1111-4111-8111-111111111111';
const MOROSO = '44444444-4444-4444-8444-444444444444';
const EXTRAJUDICIAL = '55555555-5555-4555-8555-555555555555';

function montar(hash: string) {
  window.location.hash = hash;
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  srv.agregarCliente({ id: MOROSO, numero: 4, numeroDocumento: '44444444', nombre: 'Cliente Moroso Prueba', estado: 'MOROSO' });
  srv.agregarCliente({ id: EXTRAJUDICIAL, numero: 5, numeroDocumento: '55555555', nombre: 'Cliente Extrajudicial Prueba', estado: 'EXTRAJUDICIAL' });
  render(<App />);
  return { srv, u: userEvent.setup() };
}

/** La tabla se dibuja en escritorio (≥ 768 px); en jsdom matchMedia no coincide y se ven las tarjetas móviles. */
async function enEscritorio(fn: () => Promise<void>) {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  return fn().finally(() => { window.matchMedia = original; });
}

describe('Estado del cliente', () => {
  it('la lista muestra la columna Estado antes de la acción de detalle', () => enEscritorio(async () => {
    montar('#/clientes');
    const tabla = await screen.findByRole('table', { name: 'Listado de clientes' });
    await within(tabla).findByText('Cliente Moroso Prueba');

    const cabeceras = within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(cabeceras.indexOf('Estado')).toBe(cabeceras.indexOf('Detalle') - 1);
    expect(within(tabla).getByText('ACTIVO')).toBeInTheDocument();
    expect(within(tabla).getByText('MOROSO')).toBeInTheDocument();
    expect(within(tabla).getByText('EXTRAJUDICIAL')).toBeInTheDocument();
  }));

  it('en móvil cada tarjeta de cliente muestra su estado', async () => {
    montar('#/clientes');
    const lista = await screen.findByRole('list', { name: 'Listado de clientes' });
    await within(lista).findByText('Cliente Moroso Prueba');
    expect(within(lista).getByText('ACTIVO')).toBeInTheDocument();
    expect(within(lista).getByText('MOROSO')).toBeInTheDocument();
    expect(within(lista).getByText('EXTRAJUDICIAL')).toBeInTheDocument();
  });

  it('un cliente ACTIVO conserva «Nueva solicitud» habilitado y sin aviso', async () => {
    montar(`#/clientes/${ACTIVO}`);
    const boton = await screen.findByRole('button', { name: /Nueva solicitud/ }, { timeout: 5000 });
    expect(boton).toBeEnabled();
    expect(screen.getByText('ACTIVO')).toBeInTheDocument();
    expect(screen.queryByText(/no puede solicitar nuevos préstamos/)).not.toBeInTheDocument();
  });

  it.each([
    [MOROSO, 'MOROSO'],
    [EXTRAJUDICIAL, 'EXTRAJUDICIAL']
  ])('la ficha de un cliente %s muestra su estado, avisa y deshabilita «Nueva solicitud»', async (id, estado) => {
    const { srv } = montar(`#/clientes/${id}`);
    const boton = await screen.findByRole('button', { name: /Nueva solicitud/ }, { timeout: 5000 });
    expect(boton).toBeDisabled();
    expect(screen.getAllByText(estado).length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('no puede solicitar nuevos préstamos');
    expect(srv.llamadas.some((l) => l.ruta.startsWith('/api/prestamos/condiciones'))).toBe(false);
  });

  it('entrar por /solicitud/:id con un cliente MOROSO no pasa a las condiciones', async () => {
    montar(`#/solicitud/${MOROSO}`);
    expect(await screen.findByText(/está en estado/, {}, { timeout: 5000 })).toHaveTextContent('MOROSO');
    expect(screen.getByRole('heading', { name: 'Selecciona al cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('al elegir un cliente EXTRAJUDICIAL no se puede continuar; con uno ACTIVO sí', async () => {
    const { u } = montar('#/solicitud');
    await u.click(await screen.findByRole('button', { name: /Cliente Extrajudicial Prueba/ }, { timeout: 5000 }));
    expect(screen.getByText(/está en estado/)).toHaveTextContent('EXTRAJUDICIAL');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await u.click(screen.getByRole('button', { name: /Cliente de prueba/ }));
    expect(screen.queryByText(/está en estado/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled());
  });
});
