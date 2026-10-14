import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/app/App';
import { STORAGE_KEYS } from '@/lib/config';
import { restaurarDb } from '@/services/store';

/** Pruebas de interfaz: la app real, con enrutado, estado y persistencia (sin mocks de la lógica). */
const abrir = (hash: string, sesion = true) => {
  localStorage.clear();
  if (sesion) localStorage.setItem(STORAGE_KEYS.sesion, '1');
  restaurarDb();
  window.location.hash = hash;
  return render(<App />);
};

beforeEach(() => { document.documentElement.setAttribute('data-theme', 'light'); });

describe('acceso de demostración', () => {
  it('rechaza credenciales incorrectas y acepta las de demostración', async () => {
    const user = userEvent.setup();
    abrir('#/', false);
    await user.type(screen.getByLabelText('Usuario'), 'x');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrectos/i);

    await user.click(screen.getByRole('button', { name: /completar con las credenciales/i }));
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('heading', { name: /hola, camila/i }, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('todas las rutas renderizan sin errores', () => {
  const rutas: [string, RegExp][] = [
    ['#/', /hola, camila/i], ['#/clientes', /^clientes$/i], ['#/clientes/C013', /inversiones andes/i], ['#/solicitud', /nueva solicitud/i],
    ['#/prestamos', /^préstamos$/i], ['#/prestamos/PR-1003', /^PR-1003/], ['#/cuotas', /^cuotas y cronogramas$/i],
    ['#/pagos', /página no encontrada/i], ['#/pagos/PR-1003', /página no encontrada/i], ['#/clientes/C999', /cliente no encontrado/i], ['#/prestamos/PR-0000', /préstamo no encontrado/i], ['#/no-existe', /página no encontrada/i]
  ];
  it.each(rutas)('%s', async (hash, titulo) => {
    abrir(hash);
    expect(await screen.findByRole('heading', { name: titulo }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo mostrar esta pantalla/i)).not.toBeInTheDocument();
  });
});

describe('alcance: la interfaz no ofrece operativa de pagos', () => {
  const PAGOS = /registrar pago|pagar|abono|cancelaci[oó]n anticipada|liquidar|marcar como pagad/i;

  it('el menú lateral no tiene accesos a pagos y sí a cuotas y cronogramas', async () => {
    abrir('#/');
    await screen.findByRole('heading', { name: /hola, camila/i }, { timeout: 4000 });
    const nav = screen.getAllByRole('navigation')[0]!;
    expect(within(nav).queryByText(PAGOS)).not.toBeInTheDocument();
    expect(within(nav).queryByText(/pagos/i)).not.toBeInTheDocument();
    expect(within(nav).getByText(/cuotas y cronogramas/i)).toBeInTheDocument();
  });

  it.each(['#/', '#/prestamos/PR-1003', '#/clientes/C001', '#/cuotas'])('%s no muestra botones ni acciones de pago', async (hash) => {
    abrir(hash);
    await screen.findAllByRole('heading', {}, { timeout: 4000 });
    for (const b of screen.queryAllByRole('button')) expect(b.textContent ?? '', b.outerHTML).not.toMatch(PAGOS);
    for (const l of screen.queryAllByRole('link')) expect(l.textContent ?? '', l.outerHTML).not.toMatch(PAGOS);
  });

  it('el detalle del préstamo ofrece descarga de PDF y cronograma de solo consulta', async () => {
    abrir('#/prestamos/PR-1003');
    expect(await screen.findByRole('button', { name: /descargar pdf/i }, { timeout: 4000 })).toBeInTheDocument();
    // jsdom no cumple (min-width: 768px): se renderiza la presentación móvil (lista) del mismo cronograma
    expect(screen.getByRole('list', { name: /cronograma de cuotas/i })).toBeInTheDocument();
    expect(screen.queryByText(/historial de pagos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/abonado/i)).not.toBeInTheDocument();
  });
});

describe('consulta de cuotas', () => {
  it('filtra por estado y por búsqueda de forma funcional', async () => {
    const user = userEvent.setup();
    abrir('#/cuotas');
    await screen.findByRole('heading', { name: /cuotas y cronogramas/i }, { timeout: 4000 });
    await user.selectOptions(screen.getByLabelText('Estado de la cuota'), 'Vencida');
    const lista = await screen.findByRole('list', { name: /cuotas programadas/i });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas.length).toBeGreaterThan(0);
    filas.forEach((f) => expect(f).toHaveTextContent(/vencida/i));
    await user.type(screen.getByLabelText(/buscar por préstamo/i), 'zzzzzz');
    expect(await screen.findByText(/no hay cuotas con estos filtros/i)).toBeInTheDocument();
  });
});

describe('flujos funcionales', () => {
  it('solicitud: bloquea montos que superan el límite y no avanza de paso', async () => {
    const user = userEvent.setup();
    abrir('#/solicitud/C001'); // Rosa Elena: ~S/ 9,039 de capital pendiente
    const monto = await screen.findByLabelText(/monto solicitado/i);
    await user.clear(monto);
    await user.type(monto, '5000');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((await screen.findAllByText(/capacidad disponible/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('Condiciones del préstamo')).toBeInTheDocument();
  });
});
