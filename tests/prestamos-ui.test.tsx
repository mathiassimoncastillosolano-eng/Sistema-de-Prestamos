/* Pruebas de la interfaz remasterizada de Préstamos y Cuotas. Usan el servidor FALSO a nivel de fetch (tests/helpers/fake-server.ts):
   comprueban lo que hace el frontend con las respuestas del contrato, NO la fórmula ni la base de datos reales
   (eso lo cubren las pruebas del backend). */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/app/App';
import { datosPdfRegistrado, datosPdfSimulacion } from '@/features/loans/pdf-datos';
import { nombreArchivoPdf } from '@/lib/pdf';
import { ASESORA, DETALLE, armarSimulacion, crearServidor } from './helpers/fake-server';

function montar(hash: string) {
  window.location.hash = hash;
  const srv = crearServidor([ASESORA]);
  srv.instalar();
  srv.abrirSesion(ASESORA);
  render(<App />);
  return srv;
}

/** Simula una pantalla de escritorio para que las listas se pinten como tabla y no como tarjetas. */
function conEscritorio<T>(fn: () => Promise<T>) {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  return fn().finally(() => { window.matchMedia = original; });
}

async function irACondiciones(u: ReturnType<typeof userEvent.setup>) {
  const grupo = await screen.findByRole('group', { name: 'Clientes' });
  await u.click(within(grupo).getAllByRole('button')[0]);
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByRole('heading', { name: 'Condiciones del préstamo' });
  await screen.findByText('Fecha de desembolso'); // condiciones cargadas
}

describe('Registrar préstamo · condiciones', () => {
  it('arranca con monto 0.00, plazo 0, sin errores ni simulación, con fechas profesionales', async () => {
    const srv = montar('#/solicitud');
    const u = userEvent.setup();
    await irACondiciones(u);

    expect(screen.getByLabelText(/Monto solicitado/)).toHaveValue('0.00');
    expect(screen.getByLabelText(/Plazo/)).toHaveValue('0');
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(screen.getByText('Fecha actual · Lima, Perú')).toBeInTheDocument();
    expect(screen.getByText('Primera cuota')).toBeInTheDocument();
    expect(screen.queryByText(/Un mes después/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver cronograma de cuotas/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(srv.llamadas.some((l) => l.ruta === '/api/prestamos/simulacion')).toBe(false);
  });

  it('con datos válidos pide la simulación al servidor, habilita el cronograma y permite descargar el PDF sin código', async () => {
    await conEscritorio(async () => {
      const srv = montar('#/solicitud');
      const u = userEvent.setup();
      await irACondiciones(u);
      await u.type(screen.getByLabelText(/Monto solicitado/), '1000');
      await u.type(screen.getByLabelText(/Plazo/), '2');

      const boton = screen.getByRole('button', { name: /Ver cronograma de cuotas/ });
      await waitFor(() => expect(boton).toBeEnabled(), { timeout: 4000 });
      const pedido = srv.llamadas.filter((l) => l.ruta === '/api/prestamos/simulacion').at(-1);
      expect(pedido?.cuerpo).toEqual({ capital: 1000, plazoMeses: 2 });

      await u.click(boton);
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByText(/Simulación no registrada/)).toBeInTheDocument();
      expect(within(dialogo).queryByText(/PR-\d+/)).not.toBeInTheDocument();
      const tabla = within(dialogo).getByRole('table', { name: 'Cronograma de cuotas simulado' });
      expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo cap.']);
      expect(within(dialogo).getByRole('button', { name: 'Descargar cronograma PDF' })).toBeEnabled();
    });
  });

  it('si se vacía el monto vuelve a bloquear el cronograma y limpia el resultado', async () => {
    montar('#/solicitud');
    const u = userEvent.setup();
    await irACondiciones(u);
    const monto = screen.getByLabelText(/Monto solicitado/);
    await u.type(monto, '1000');
    await u.type(screen.getByLabelText(/Plazo/), '2');
    await waitFor(() => expect(screen.getByRole('button', { name: /Ver cronograma de cuotas/ })).toBeEnabled(), { timeout: 4000 });

    await u.clear(monto);
    await waitFor(() => expect(screen.getByRole('button', { name: /Ver cronograma de cuotas/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });
});

describe('Registrar préstamo · confirmación', () => {
  async function hastaConfirmacion(srv: ReturnType<typeof montar>) {
    const u = userEvent.setup();
    await irACondiciones(u);
    await u.type(screen.getByLabelText(/Monto solicitado/), '1000');
    await u.type(screen.getByLabelText(/Plazo/), '2');
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    await waitFor(() => expect(continuar).toBeEnabled(), { timeout: 4000 });
    await u.click(continuar);
    await screen.findByRole('heading', { name: 'Revisión y confirmación' });
    expect(srv).toBeDefined();
    return u;
  }

  it('repite el cronograma completo, registra con lo revisado y redirige al detalle real', async () => {
    const srv = montar('#/solicitud');
    const u = await hastaConfirmacion(srv);
    const region = screen.getByRole('region', { name: 'Cronograma de cuotas' });
    expect(within(region).getByText(/Simulación no registrada/)).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Descargar cronograma PDF' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(window.location.hash).toBe(`#/prestamos/${DETALLE.id}`));
    const envios = srv.llamadas.filter((l) => l.ruta === '/api/prestamos' && l.metodo === 'POST');
    expect(envios).toHaveLength(1); // sin doble envío
    const sim = armarSimulacion(1000, 2);
    expect(envios[0]?.cuerpo).toMatchObject({ capital: 1000, plazoMeses: 2, fechaDesembolsoEsperada: sim.fechaDesembolso, totalContractualEsperado: sim.totalContractual });
  });

  it('si el servidor responde CONDICIONES_DESACTUALIZADAS lo explica, recalcula y no navega', async () => {
    const srv = montar('#/solicitud');
    const u = await hastaConfirmacion(srv);
    srv.desactualizarCondiciones(true);
    await u.click(screen.getByRole('button', { name: /Registrar préstamo/ }));
    await u.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Registrar' }));

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Las condiciones cambiaron')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/solicitud');
    await waitFor(() => expect(srv.llamadas.filter((l) => l.ruta === '/api/prestamos/simulacion').length).toBeGreaterThan(1));
  });
});

describe('Listado de préstamos', () => {
  it('usa datos reales, ofrece solo tres estados con contadores, filas clicables y sin icono de ojo', async () => {
    await conEscritorio(async () => {
      montar('#/prestamos');
      const u = userEvent.setup();
      const tabla = await screen.findByRole('table', { name: 'Listado de préstamos' });
      expect(within(tabla).getByText('PR-1001')).toBeInTheDocument();
      expect(within(tabla).getByText('PR-1002')).toBeInTheDocument();

      const estados = screen.getAllByRole('radio').map((r) => r.textContent?.replace(/\s+/g, ' ').trim());
      expect(estados).toEqual(['Todos 2', 'Vigente 1', 'En mora 1', 'Cancelado 0']);
      expect(screen.queryByRole('radio', { name: /Rechazado|Aprobado|En evaluación/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Ver detalle del préstamo/ })).not.toBeInTheDocument();

      await u.click(screen.getByRole('radio', { name: /En mora/ }));
      await waitFor(() => expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).queryByText('PR-1002')).not.toBeInTheDocument());
    });
  });

  it('busca por código, cliente o documento y abre el detalle con clic o con teclado', async () => {
    await conEscritorio(async () => {
      montar('#/prestamos');
      const u = userEvent.setup();
      await screen.findByRole('table', { name: 'Listado de préstamos' });

      await u.type(screen.getByRole('searchbox', { name: 'Buscar préstamos' }), '88888882');
      await waitFor(() => expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).queryByText('PR-1001')).not.toBeInTheDocument());
      const fila = within(screen.getByRole('table', { name: 'Listado de préstamos' })).getAllByRole('row')[1] as HTMLElement;
      fila.focus();
      await u.keyboard('{Enter}');
      await waitFor(() => expect(window.location.hash).toBe('#/prestamos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
    });
  });

  it('«Solo mis préstamos» se apoya en el dato real `propio`', async () => {
    await conEscritorio(async () => {
      montar('#/prestamos');
      const u = userEvent.setup();
      await screen.findByRole('table', { name: 'Listado de préstamos' });
      await u.click(screen.getByRole('checkbox', { name: 'Solo mis préstamos' }));
      await waitFor(() => expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).queryByText('PR-1002')).not.toBeInTheDocument());
      expect(within(screen.getByRole('table', { name: 'Listado de préstamos' })).getByText('PR-1001')).toBeInTheDocument();
    });
  });
});

describe('Detalle del préstamo y cuotas', () => {
  it('muestra cabecera, las cinco tarjetas, condiciones, historial real y el cronograma con estados', async () => {
    await conEscritorio(async () => {
      montar(`#/prestamos/${DETALLE.id}`);
      expect(await screen.findByText('PR-1001')).toBeInTheDocument();
      expect(screen.getByText(/Sur Prueba · Asesor Valeria Quintana/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mensaje para el cliente/ })).toBeInTheDocument();
      for (const k of ['Capital original', 'Intereses pactados', 'Importe contractual total', 'Capital pendiente', 'Pendiente contractual']) {
        expect(screen.getByText(k)).toBeInTheDocument();
      }
      expect(screen.getByText('Alta de préstamo')).toBeInTheDocument();

      const tabla = screen.getByRole('table', { name: 'Cronograma de cuotas' });
      expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toContain('Estado');
      expect(within(tabla).getByText('VENCIDA')).toBeInTheDocument();
      expect(within(tabla).getByText('PENDIENTE')).toBeInTheDocument();
      expect(within(tabla).queryByRole('button', { name: /Ver detalle de la cuota/ })).not.toBeInTheDocument(); // sin botón-ojo: la fila es el control
    });
  });

  it('abrir una cuota (clic en la fila) muestra datos reales y aclara que no hay pagos registrados', async () => {
    await conEscritorio(async () => {
      montar(`#/prestamos/${DETALLE.id}`);
      const u = userEvent.setup();
      await u.click(await screen.findByRole('row', { name: 'Ver detalle de la cuota 1' }));
      const dialogo = await screen.findByRole('dialog');
      expect(within(dialogo).getByText('VENCIDA')).toBeInTheDocument();
      expect(within(dialogo).getByText('Días de atraso')).toBeInTheDocument();
      expect(within(dialogo).getByText('Fecha de pago')).toBeInTheDocument();
      expect(within(dialogo).getByText('No registrada')).toBeInTheDocument();
    });
  });

  it('un préstamo inexistente muestra «no encontrado» y no datos de demostración', async () => {
    montar('#/prestamos/00000000-0000-4000-8000-000000000000');
    expect(await screen.findByText('Préstamo no encontrado')).toBeInTheDocument();
  });
});

describe('Datos del PDF', () => {
  it('la simulación no lleva código de préstamo y el registrado sí (PR-{número})', () => {
    const simulacion = datosPdfSimulacion(armarSimulacion(1000, 2), { clienteNombre: 'X' });
    expect(simulacion.tipo).toBe('simulacion');
    expect(simulacion.codigo).toBeUndefined();
    expect(nombreArchivoPdf(simulacion)).toBe('PeruCred-simulacion-cronograma.pdf');

    const registrado = datosPdfRegistrado(DETALLE as never);
    expect(registrado.tipo).toBe('registrado');
    expect(registrado.codigo).toBe('PR-1001');
    expect(registrado.totalContractual).toBe(DETALLE.totalContractual);
    expect(nombreArchivoPdf(registrado)).toBe('PeruCred-PR-1001-cronograma.pdf');
  });
});
