import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/app/App';
import { STORAGE_KEYS } from '@/lib/config';
import { resumen } from '@/lib/finance';
import { getDb, restaurarDb } from '@/services/store';

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
    ['#/prestamos', /^préstamos$/i], ['#/prestamos/PR-1003', /^PR-1003/], ['#/pagos', /pagos y cancelaciones/i], ['#/pagos/PR-1003', /pagos y cancelaciones/i],
    ['#/clientes/C999', /cliente no encontrado/i], ['#/prestamos/PR-0000', /préstamo no encontrado/i], ['#/no-existe', /página no encontrada/i]
  ];
  it.each(rutas)('%s', async (hash, titulo) => {
    abrir(hash);
    expect(await screen.findByRole('heading', { name: titulo }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo mostrar esta pantalla/i)).not.toBeInTheDocument();
  });
});

describe('regresiones detectadas en pruebas de navegador', () => {
  it('escribir en el importe de un pago no provoca un bucle de renderizado (DataTable con referencias estables)', async () => {
    const user = userEvent.setup();
    abrir('#/pagos/PR-1001');
    const importe = await screen.findByLabelText('Importe');
    await user.clear(importe);
    await user.type(importe, '123.45');
    expect(importe).toHaveValue(123.45);
    expect(await screen.findByText(/saldo tras la operación/i)).toBeInTheDocument();
  });

  it('el formulario de pagos sigue la URL cuando solo cambia ?modo=anticipada estando ya en la pantalla', async () => {
    abrir('#/pagos/PR-1001');
    await screen.findByLabelText('Cuota a pagar');
    await act(async () => { window.location.hash = '#/pagos/PR-1001?modo=anticipada'; });
    expect(await screen.findByRole('group', { name: /cálculo de la cancelación anticipada/i })).toBeInTheDocument();
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

  it('pago de cuota: confirma, actualiza el saldo y muestra el resultado', async () => {
    const user = userEvent.setup();
    abrir('#/pagos/PR-1001');
    const antes = resumen(getDb().prestamos.find((p) => p.id === 'PR-1001')!).pendiente;
    await user.click(await screen.findByRole('button', { name: /revisar y confirmar/i }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Operación registrada', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(resumen(getDb().prestamos.find((p) => p.id === 'PR-1001')!).pendiente).toBeLessThan(antes));
  });
});
