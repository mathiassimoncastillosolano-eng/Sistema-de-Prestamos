/* Genera de verdad el PDF con jsPDF (en jsdom) y revisa su contenido de texto. */
import { describe, expect, it } from 'vitest';
import { datosPdfRegistrado, datosPdfSimulacion } from '@/features/loans/pdf-datos';
import { crearDocumentoPdf, generarPdf } from '@/lib/pdf';
import { DETALLE, armarSimulacion } from './helpers/fake-server';

const ahora = new Date('2026-10-18T20:42:00Z'); // 15:42 en Lima

const textoDe = async (datos: Parameters<typeof crearDocumentoPdf>[0]) => {
  const doc = await crearDocumentoPdf(datos, ahora);
  // jsPDF guarda el texto sin comprimir en el flujo de salida: basta para comprobar frases clave.
  return doc.output();
};

describe('PDF del cronograma', () => {
  it('propuesta: una sola leyenda referencial, datos del cliente, sin código de préstamo y con hora de Lima', async () => {
    const txt = await textoDe(datosPdfSimulacion(armarSimulacion(1000, 2), { cliente: { nombre: 'Cliente de prueba', tipoDocumento: 'DNI', numeroDocumento: '99999991', numero: 1, telefono: '999999999' } }));
    expect(txt.match(/Documento referencial previo a la formalizaci/g)).toHaveLength(1);
    expect(txt).toContain('Cliente de prueba');
    expect(txt).toContain('99999991');
    expect(txt).toContain('999999999');
    expect(txt).not.toMatch(/PR-\d{4}/);
    expect(txt).toContain('15:42');
  });

  it('60 cuotas: todas están en el documento y se numeran las páginas', async () => {
    const doc = await crearDocumentoPdf(datosPdfSimulacion(armarSimulacion(6000, 60)), ahora);
    const txt = doc.output();
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(txt).toContain(`Página ${doc.getNumberOfPages()} de ${doc.getNumberOfPages()}`);
    expect(txt).toContain('Totales');
  });

  it('préstamo registrado: lleva el código real y el estado', async () => {
    const txt = await textoDe(datosPdfRegistrado(DETALLE as never));
    expect(txt).toContain('PR-1001');
    expect(txt).toContain('En mora');
    expect(txt).toContain('999999999'); // teléfono real del cliente, ahora entregado por el backend
    expect(txt).not.toContain('Documento referencial');
  });

  it('genera un Blob PDF no vacío', async () => {
    const blob = await generarPdf(datosPdfSimulacion(armarSimulacion(1000, 2)));
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
