import { describe, expect, it } from 'vitest';
import { CFG } from '@/lib/config';
import { generarCronograma } from '@/lib/finance';
import { crearDocumentoPdf } from '@/lib/pdf';
import type { Cliente, Prestamo } from '@/types';

const cliente: Cliente = {
  id: 'C-T', nombre: 'Constructora e Inversiones Pacífico Norte del Perú Sociedad Anónima Cerrada SAC', tipo: 'RUC 20', doc: '20548712390',
  agencia: 'Lima Centro', telefono: '987654321', asesor: 'Camila Ortiz', alta: '2026-01-01', domicilio: 'Av. El Sol 214, Cusco',
  representante: { nombre: 'María del Pilar Núñez de la Cruz Quispe', dni: '09845231' }
};
const prestamo = (capital: number, plazo: number): Prestamo => ({
  id: 'PR-T', clienteId: cliente.id, agencia: 'Lima Centro', capital, plazo, tea: CFG.tea, desembolso: CFG.hoy, asesor: 'Camila Ortiz',
  cronograma: generarCronograma(capital, plazo, CFG.hoy), historico: [], observaciones: ''
});

describe('PDF del préstamo', () => {
  it.each([[6, 1], [12, 1], [60, 3]])('cronograma de %i cuotas: %i página(s) como mínimo, con paginación coherente', async (plazo, minPaginas) => {
    const doc = await crearDocumentoPdf(prestamo(10000, plazo), cliente);
    const paginas = doc.getNumberOfPages();
    expect(paginas).toBeGreaterThanOrEqual(minPaginas);
    if (plazo === 60) expect(paginas).toBeLessThanOrEqual(4);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
