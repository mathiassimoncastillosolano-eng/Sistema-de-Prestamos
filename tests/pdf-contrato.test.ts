/* Genera de verdad el PDF del contrato con jsPDF (jsdom) y revisa su contenido de texto. */
import { describe, expect, it } from 'vitest';
import { ContratoIlegibleError, crearDocumentoContrato, generarPdfContrato, leerContrato, nombreArchivoContrato } from '@/lib/pdf-contrato';
import { armarContrato } from './helpers/contrato';

describe('PDF del contrato', () => {
  it('borrador: se identifica como BORRADOR, sin código y sin afirmar vigencia', async () => {
    const doc = await crearDocumentoContrato(armarContrato('BORRADOR'));
    const txt = doc.output();
    expect(txt).toContain('CONTRATO DE PR');
    expect(txt).toContain('BORRADOR');
    expect(txt).not.toMatch(/PR-\d{4}/);
    expect(txt).toContain('Cliente de prueba');
    expect(txt).toContain('99999991');
  });

  it('definitivo: lleva código, versión y huella, y ninguna marca de borrador', async () => {
    const txt = (await crearDocumentoContrato(armarContrato('DEFINITIVO'))).output();
    expect(txt).toContain('PR-1001');
    expect(txt).toContain('aaaaaaaaaaaaaaaa');
    expect(txt).not.toContain('BORRADOR');
  });

  it('muestra monto en números y en letras, condiciones y las 12 cuotas del anexo', async () => {
    const api = armarContrato('DEFINITIVO', 1000, 12);
    const d = leerContrato(api);
    const doc = await crearDocumentoContrato(api);
    const txt = doc.output();
    expect(txt).toContain('MIL CON 00/100 SOLES');
    expect(txt).toContain('ANEXO 1');
    expect(txt).toContain('Totales');
    expect(d.cronograma).toHaveLength(12);
    expect(txt).toContain(`Página ${doc.getNumberOfPages()} de ${doc.getNumberOfPages()}`);
  });

  it('declara lo no definido, no inventa cláusulas y no afirma firma electrónica', async () => {
    const txt = (await crearDocumentoContrato(armarContrato('DEFINITIVO'))).output();
    expect(txt).toContain('ASPECTOS NO DEFINIDOS');
    expect(txt).toContain('Intereses moratorios');
    expect(txt).toContain('firma manuscrita');
    expect(txt).toContain('No incluye firma electr');
    expect(txt).not.toMatch(/firmado electr/i);
  });

  it('60 cuotas: el anexo ocupa varias páginas y conserva todas', async () => {
    const doc = await crearDocumentoContrato(armarContrato('DEFINITIVO', 6000, 60));
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });

  it('RUC 10 con DNI de titular y RUC 20 con representante muestran sus datos propios', async () => {
    const base = leerContrato(armarContrato('DEFINITIVO'));
    const ruc10 = armarContrato('DEFINITIVO', 1000, 12, { prestatario: { ...base.prestatario, nombre: 'Bodega Perez', tipoDocumento: 'RUC 10', numeroDocumento: '10999999911', dniTitular: '99999991' } });
    expect((await crearDocumentoContrato(ruc10)).output()).toContain('DNI del titular');
    const ruc20 = armarContrato('DEFINITIVO', 1000, 12, { prestatario: { ...base.prestatario, nombre: 'Servicios SAC', tipoDocumento: 'RUC 20', numeroDocumento: '20999999991', representanteNombre: 'Rosa Gil', representanteDni: '12345678' } });
    const txt = (await crearDocumentoContrato(ruc20)).output();
    expect(txt).toContain('Rosa Gil');
    expect(txt).toContain('12345678');
  });

  it('nombres de archivo distintos al del cronograma', () => {
    expect(nombreArchivoContrato(armarContrato('DEFINITIVO'))).toMatch(/PR-1001-contrato\.pdf$/);
    expect(nombreArchivoContrato(armarContrato('BORRADOR'))).toMatch(/contrato-borrador\.pdf$/);
  });

  it('no dibuja un contrato ilegible, incompleto o de una plantilla desconocida', async () => {
    const ok = armarContrato('DEFINITIVO');
    await expect(crearDocumentoContrato({ ...ok, datos: '{no es json' })).rejects.toBeInstanceOf(ContratoIlegibleError);
    await expect(crearDocumentoContrato({ ...ok, datos: '{}' })).rejects.toBeInstanceOf(ContratoIlegibleError);
    const otra = armarContrato('DEFINITIVO', 1000, 12, { plantillaVersion: 'CONTRATO-MUTUO-9.9' });
    await expect(crearDocumentoContrato(otra)).rejects.toThrow(/9\.9/);
  });

  it('genera un Blob PDF no vacío', async () => {
    const blob = await generarPdfContrato(armarContrato('BORRADOR'));
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
