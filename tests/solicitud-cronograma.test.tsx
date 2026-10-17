/* Pruebas de la interfaz del rediseño: Nueva solicitud, cronograma en Préstamos y estados de cuota (demostración).
   Usan el servidor de autenticación FALSO y los datos ficticios del navegador. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { ASESORA, crearServidor } from './helpers/fake-server';

const menu = () => within(screen.getByRole('navigation', { name: 'Navegación principal' }));

function montarComoAsesora(hash: string) {
  window.location.hash = hash;
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  render(<App />);
}

/** Simula una pantalla de escritorio para que el cronograma se pinte como tabla y no como tarjetas. */
function conEscritorio<T>(fn: () => Promise<T>) {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  return fn().finally(() => { window.matchMedia = original; });
}

describe('Nueva solicitud', () => {
  it('paso Cliente: sin resumen lateral ni importes; buscador, listado y registro de cliente nuevo', async () => {
    montarComoAsesora('#/solicitud');
    expect(await screen.findByRole('heading', { name: 'Nueva solicitud', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Registrar cliente nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar cliente' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Clientes' })).getAllByRole('button').length).toBeGreaterThan(0);

    expect(screen.queryByText('Resumen en tiempo real')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resumen de la solicitud')).not.toBeInTheDocument();
    for (const t of [/Cuota mensual estimada/, /Total contractual/, /Primer vencimiento/, /Intereses estimados/, /Uso del límite tras el préstamo/]) {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    }
  });

  it('flujo completo: Cliente → Condiciones (sin vista previa con valores por defecto) → Revisión con resumen y cronograma proyectado', async () => {
    montarComoAsesora('#/solicitud');
    const u = userEvent.setup();
    const grupo = await screen.findByRole('group', { name: 'Clientes' });
    await u.click(within(grupo).getAllByRole('button')[0]);
    await u.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Condiciones del préstamo' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Vista previa de la cuota')).not.toBeInTheDocument();
    expect(screen.queryByText('Resumen en tiempo real')).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Revisión y confirmación' })).toBeInTheDocument();
    for (const t of ['Capital solicitado', 'Tasa aplicada', 'Plazo', 'Frecuencia de pago', 'Desembolso previsto', 'Primer vencimiento', 'Cuota estimada', 'Total de intereses estimados', 'Total contractual estimado']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.getByRole('region', { name: 'Cronograma proyectado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar a evaluación/ })).toBeEnabled();

    // volver al paso 1 y cambiar de cliente no deja resultados de la simulación a la vista
    await u.click(screen.getByRole('button', { name: 'Atrás' }));
    await screen.findByRole('heading', { name: 'Condiciones del préstamo' }); // espera a que termine la transición entre pasos
    await u.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(await screen.findByRole('heading', { name: 'Selecciona al cliente' })).toBeInTheDocument();
    expect(screen.queryByText(/Cuota estimada/)).not.toBeInTheDocument();
  });
});

describe('Cronograma en Préstamos', () => {
  it('el detalle muestra el cronograma con la columna Estado y un estado por cuota', async () => {
    await conEscritorio(async () => {
      montarComoAsesora('#/prestamos/PR-1030'); // vencida con pago parcial, próxima a vencer y pagadas
      const tabla = await screen.findByRole('table', { name: 'Cronograma de cuotas' });
      const cabeceras = within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim());
      expect(cabeceras).toEqual(expect.arrayContaining(['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo cap.', 'Estado']));
      expect(within(tabla).getByText('Totales')).toBeInTheDocument();
      for (const t of ['Pagada', 'Vencida', 'Próxima a vencer', 'Pendiente']) {
        expect(within(tabla).getAllByText(t).length).toBeGreaterThan(0);
      }
      // la cuota con pago parcial figura vencida (no pagada) y deja a la vista lo cubierto
      expect(within(tabla).getByText(/Cubierto S\/ \d/)).toBeInTheDocument();
    });
  });

  it('el diálogo de una cuota conserva los importes contractuales y muestra su estado', async () => {
    await conEscritorio(async () => {
      montarComoAsesora('#/prestamos/PR-1001');
      const u = userEvent.setup();
      await u.click(await screen.findByRole('button', { name: 'Ver detalle de la cuota 1' }));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByText('Importe de la cuota')).toBeInTheDocument();
      expect(within(dialogo).getByText('Saldo de capital programado')).toBeInTheDocument();
      expect(within(dialogo).getByText('Estado')).toBeInTheDocument();
      expect(within(dialogo).getByText('Pagada')).toBeInTheDocument();
    });
  });

  it('una solicitud en evaluación muestra un cronograma proyectado sin estados de cuota y sin saldo', async () => {
    await conEscritorio(async () => {
      montarComoAsesora('#/prestamos/PR-1031');
      expect(await screen.findByText('Cronograma proyectado')).toBeInTheDocument();
      const tabla = await screen.findByRole('table', { name: 'Cronograma de cuotas' });
      expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim())).not.toContain('Estado');
      expect(screen.getAllByText('En evaluación').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Aún sin desembolsar').length).toBeGreaterThan(0);
    });
  });
});

describe('Listado de préstamos', () => {
  it('muestra la columna Estado y el filtro por estado funciona sobre los datos mock', async () => {
    await conEscritorio(async () => {
      montarComoAsesora('#/prestamos');
      const u = userEvent.setup();
      const tabla = await screen.findByRole('table', { name: 'Listado de préstamos' });
      expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(expect.arrayContaining(['Estado']));

      await u.click(screen.getByRole('radio', { name: /Rechazado/ }));
      await waitFor(() => expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).getAllByRole('row').length).toBe(3)); // cabecera + 2 rechazadas
      const filas = within(screen.getByRole('table', { name: 'Listado de préstamos' }));
      expect(filas.getByText('PR-1035')).toBeInTheDocument();
      expect(filas.getByText('PR-1036')).toBeInTheDocument();
      expect(filas.queryByText('PR-1001')).not.toBeInTheDocument();

      await u.click(screen.getByRole('radio', { name: /En mora/ }));
      await waitFor(() => expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).queryByText('PR-1035')).not.toBeInTheDocument());
      expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).getAllByText('En mora').length).toBeGreaterThan(0);
    });
  });
});

describe('Navegación', () => {
  it('el menú ya no ofrece «Cuotas y cronogramas» y el enlace antiguo redirige a Préstamos', async () => {
    montarComoAsesora('#/cuotas');
    await waitFor(() => expect(window.location.hash).toBe('#/prestamos'));
    expect(await screen.findByRole('heading', { name: 'Préstamos', level: 1 })).toBeInTheDocument();
    const etiquetas = menu().getAllByRole('link').map((l) => l.textContent?.trim());
    expect(etiquetas).toEqual(['Dashboard', 'Clientes', 'Nueva solicitud', 'Préstamos']);
    expect(screen.queryByText('Cuotas y cronogramas')).not.toBeInTheDocument();
  });
});
