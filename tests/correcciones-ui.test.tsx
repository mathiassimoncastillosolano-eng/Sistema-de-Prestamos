/* Pruebas de las tres correcciones: segundo inicio de sesión, ojo de la contraseña y selector desplegable.
   Usan el servidor FALSO de tests/helpers/fake-server.ts (no prueban el backend real). */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from '@/app/App';
import { Select } from '@/components/ui/select';
import { ASESORA, GERENTE, crearServidor, type CuentaFalsa } from './helpers/fake-server';

async function iniciar(u: ReturnType<typeof userEvent.setup>, c: Pick<CuentaFalsa, 'correo' | 'clave'>) {
  await u.type(await screen.findByLabelText('Correo electrónico'), c.correo);
  await u.type(screen.getByLabelText('Contraseña'), c.clave);
  await u.click(screen.getByRole('button', { name: /Ingresar/ }));
}
async function cerrarSesion(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole('button', { name: 'Menú de cuenta' }));
  await u.click(await screen.findByRole('menuitem', { name: /Cerrar sesión/ }));
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
}

describe('1 · volver a iniciar sesión tras cerrar sesión', () => {
  it('el segundo inicio de sesión funciona al primer clic, sin aviso de sesión expirada', async () => {
    const srv = crearServidor([ASESORA, GERENTE]); srv.instalar();
    render(<App />);
    const u = userEvent.setup();

    await iniciar(u, ASESORA);
    await screen.findByRole('button', { name: 'Menú de cuenta' });
    await cerrarSesion(u);
    expect(document.cookie).not.toContain('XSRF-TOKEN=token'); // el logout borró la cookie CSRF, como Spring

    const antes = srv.llamadas.filter((l) => l.ruta === '/api/auth/login').length;
    await iniciar(u, ASESORA);
    await screen.findByRole('button', { name: 'Menú de cuenta' });
    expect(screen.queryByText(/Tu sesión ha expirado/)).not.toBeInTheDocument();
    expect(srv.llamadas.filter((l) => l.ruta === '/api/auth/login').length - antes).toBe(1); // un solo POST: sin reintentos
  });

  it('con otra cuenta también entra al primer clic y no queda nada de la anterior', async () => {
    const srv = crearServidor([ASESORA, GERENTE]); srv.instalar();
    render(<App />);
    const u = userEvent.setup();
    await iniciar(u, ASESORA);
    await screen.findByRole('button', { name: 'Menú de cuenta' });
    await cerrarSesion(u);

    await iniciar(u, GERENTE);
    await waitFor(() => expect(screen.getAllByText('Mateo Rivas').length).toBeGreaterThan(0));
    expect(screen.queryByText('Valeria Quintana')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tu sesión ha expirado/)).not.toBeInTheDocument();
  });

  it('credenciales incorrectas tras cerrar sesión siguen mostrando el error real', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar();
    render(<App />);
    const u = userEvent.setup();
    await iniciar(u, ASESORA);
    await screen.findByRole('button', { name: 'Menú de cuenta' });
    await cerrarSesion(u);
    await iniciar(u, { correo: ASESORA.correo, clave: 'incorrecta' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('una revalidación lanzada antes de cerrar sesión no pinta «sesión expirada» en el login nuevo', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar();
    render(<App />);
    const u = userEvent.setup();
    await iniciar(u, ASESORA);
    await screen.findByRole('button', { name: 'Menú de cuenta' });

    const soltar = srv.retenerMe();                       // la consulta /me queda en vuelo…
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    window.dispatchEvent(new Event('focus'));
    await cerrarSesion(u);                                // …y se cierra la sesión mientras tanto
    soltar();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Tu sesión ha expirado/)).not.toBeInTheDocument();
  });
});

describe('2 · botón de mostrar/ocultar contraseña', () => {
  it('empieza oculta, alterna con clic y con teclado, conserva el texto y no envía el formulario', async () => {
    const srv = crearServidor([ASESORA]); srv.instalar();
    render(<App />);
    const u = userEvent.setup();
    const clave = await screen.findByLabelText('Contraseña');
    await u.type(clave, 'secreto123');
    expect(clave).toHaveAttribute('type', 'password');

    // jsdom no aplica CSS: se comprueba que el ojo no esté dentro de un contenedor con pointer-events-none (causa real del fallo)
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' }).closest('.pointer-events-none')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(clave).toHaveAttribute('type', 'text');
    expect(clave).toHaveValue('secreto123');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();

    const ojo = screen.getByRole('button', { name: 'Ocultar contraseña' });
    ojo.focus();
    await u.keyboard('{Enter}');
    expect(clave).toHaveAttribute('type', 'password');
    await u.keyboard(' ');
    expect(clave).toHaveAttribute('type', 'text');
    expect(clave).toHaveValue('secreto123');

    expect(srv.llamadas.some((l) => l.ruta === '/api/auth/login')).toBe(false); // nunca envió el formulario
  });
});

describe('3 · selector desplegable', () => {
  function Prueba({ onValor }: { onValor?: (v: string) => void }) {
    const [v, setV] = useState('');
    return (
      <Select aria-label="Estado" value={v} onChange={(e) => { setV(e.target.value); onValor?.(e.target.value); }}>
        <option value="">Todos</option>
        <option value="a">Alfa</option>
        <option value="b" disabled>Beta</option>
        <option value="c">Gamma</option>
        <option>Delta</option>
      </Select>
    );
  }

  it('muestra la opción elegida, marca la seleccionada y envía el valor de la opción', async () => {
    const alCambiar = vi.fn();
    render(<Prueba onValor={alCambiar} />);
    const u = userEvent.setup();
    const caja = screen.getByRole('combobox', { name: 'Estado' });
    expect(caja).toHaveTextContent('Todos');

    await u.click(caja);
    const lista = await screen.findByRole('listbox');
    expect(within(lista).getAllByRole('option')).toHaveLength(5);
    expect(within(lista).getByRole('option', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true');
    await u.click(within(lista).getByRole('option', { name: 'Gamma' }));
    expect(alCambiar).toHaveBeenCalledWith('c');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(caja).toHaveTextContent('Gamma');

    await u.click(caja);
    await u.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Delta' }));
    expect(alCambiar).toHaveBeenLastCalledWith('Delta'); // <option> sin value usa su texto, como el select nativo
  });

  it('teclado: flechas saltan las opciones deshabilitadas, Enter elige, Esc cierra y devuelve el foco', async () => {
    const alCambiar = vi.fn();
    render(<Prueba onValor={alCambiar} />);
    const u = userEvent.setup();
    const caja = screen.getByRole('combobox', { name: 'Estado' });
    caja.focus();
    await u.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await u.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // Todos → Alfa → (salta Beta) → Gamma
    expect(alCambiar).toHaveBeenCalledWith('c');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(caja).toHaveFocus();

    await u.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(caja).toHaveFocus();
  });

  it('clic fuera lo cierra y una opción deshabilitada no se puede elegir', async () => {
    const alCambiar = vi.fn();
    render(<Prueba onValor={alCambiar} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('combobox', { name: 'Estado' }));
    await u.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Beta' }));
    expect(alCambiar).not.toHaveBeenCalled();
    await u.click(document.body);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('estados de carga y sin opciones', async () => {
    const { rerender } = render(<Select aria-label="X" value="" loading><option value="">a</option></Select>);
    const u = userEvent.setup();
    await u.click(screen.getByRole('combobox', { name: 'X' }));
    expect(await screen.findByText('Cargando…')).toBeInTheDocument();
    await u.keyboard('{Escape}');
    rerender(<Select aria-label="X" value="" />);
    await u.click(screen.getByRole('combobox', { name: 'X' }));
    expect(await screen.findByText('No hay opciones disponibles')).toBeInTheDocument();
  });

  it('deshabilitado no se abre', async () => {
    render(<Select aria-label="X" value="" disabled><option value="">a</option></Select>);
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'X' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
