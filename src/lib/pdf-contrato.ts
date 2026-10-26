/* =========================================================
   PDF DEL CONTRATO DE PRÉSTAMO.
   - Se dibuja a partir de la instantánea (JSON) que entrega el servidor: no recalcula importes, fechas ni datos del
     cliente. Un contrato guardado se ve siempre igual, aunque luego cambien las tasas o los datos del cliente.
   - «BORRADOR»: antes de confirmar el préstamo. Lleva la marca BORRADOR en todas las páginas y no tiene código.
   - «DEFINITIVO»: el guardado con el préstamo. Muestra código, versión y huella de integridad.
   - Solo recoge lo que el sistema conoce. Lo que no está definido (mora, penalidades, pagos anticipados, garantías,
     datos del prestamista sin configurar) se declara en un apartado propio y pendiente de revisión legal: no se inventa.
   - Prevé firmas MANUSCRITAS. No afirma firma electrónica ni validez legal por sí mismo.
   - Cada versión de plantilla tiene su propio dibujo (RENDERIZADORES): subir la redacción no altera contratos viejos.
   ========================================================= */
import type { ContratoApi } from '@/services/prestamos-api';
import { BRAND } from './config';
import { fecha } from './dates';
import { money } from './format';
import { montoEnLetras } from './numero-letras';

const MARGEN = 20;
const TINTA: [number, number, number] = [26, 32, 44];
const APAGADO: [number, number, number] = [92, 102, 118];
const LINEA: [number, number, number] = [214, 219, 227];
const MARCA: [number, number, number] = [18, 54, 90];
const FONDO: [number, number, number] = [236, 241, 245];
const ALERTA: [number, number, number] = [160, 60, 40];

const seguro = (t: string) => t.replace(/[‐-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');

/* ---- Forma del JSON guardado (espejo de ContratoPrestamo.Datos del servidor) ---- */
export interface DatosContrato {
  plantillaVersion: string;
  estado: 'BORRADOR' | 'DEFINITIVO';
  codigo: string | null;
  numero: number | null;
  generadoEn: string;
  lugarCelebracion: string | null;
  fechaCelebracion: string;
  agencia: string | null;
  asesor: string | null;
  prestamista: { denominacion: string | null; ruc: string | null; domicilio: string | null; representante: string | null };
  prestatario: {
    nombre: string; tipoDocumento: string; numeroDocumento: string; telefono: string | null; correo: string | null;
    dniTitular: string | null; domicilio: string | null; representanteNombre: string | null; representanteDni: string | null;
  };
  condiciones: {
    moneda: string; capital: number; plazoMeses: number; tea: number; modalidadTasa: string; frecuenciaPago: string;
    fechaDesembolso: string; fechaPrimerVencimiento: string; fechaUltimoVencimiento: string; cuotaMensual: number;
    totalIntereses: number; totalContractual: number; observaciones: string | null;
  };
  cronograma: { numero: number; fechaVencimiento: string; capital: number; interes: number; importeCuota: number; saldo: number }[];
  noDefinido: string[];
}

export class ContratoIlegibleError extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = 'ContratoIlegibleError'; }
}

/** Lee la instantánea guardada. Si no se puede leer o no tiene lo mínimo, falla con un mensaje claro (no dibuja un contrato a medias). */
export function leerContrato(api: ContratoApi): DatosContrato {
  let d: DatosContrato;
  try { d = JSON.parse(api.datos) as DatosContrato; } catch { throw new ContratoIlegibleError('El contrato guardado no se pudo leer.'); }
  if (!d || !d.condiciones || !d.prestatario || !Array.isArray(d.cronograma) || d.cronograma.length === 0) {
    throw new ContratoIlegibleError('El contrato guardado está incompleto.');
  }
  return d;
}

const porcentaje = (t: number) => `${(t * 100).toFixed(2).replace(/\.00$/, '')} %`;
const horaLima = (iso: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${fecha(m[1])}, ${m[2]}` : iso;
};

type Contexto = { api: ContratoApi; d: DatosContrato };

/** Construye el documento. Separado del Blob para poder inspeccionarlo en pruebas. */
export async function crearDocumentoContrato(api: ContratoApi) {
  const d = leerContrato(api);
  const render = RENDERIZADORES[d.plantillaVersion];
  if (!render) throw new ContratoIlegibleError(`No hay un formato para la versión de contrato ${d.plantillaVersion}.`);
  return render({ api, d });
}

async function renderMutuo1({ api, d }: Contexto) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const borrador = d.estado === 'BORRADOR';
  const c = d.condiciones;
  const p = d.prestatario;
  const pr = d.prestamista;
  const esEmpresa = p.tipoDocumento.startsWith('RUC');
  let y = 0;

  const salto = (necesario: number) => {
    if (y + necesario > alto - 22) { doc.addPage(); y = 26; }
  };
  const titulo = (t: string) => {
    salto(14);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...MARCA).text(seguro(t.toUpperCase()), MARGEN, y);
    doc.setDrawColor(...LINEA).setLineWidth(0.25).line(MARGEN, y + 1.6, ancho - MARGEN, y + 1.6);
    y += 7;
  };
  const parrafo = (t: string, opciones: { negrita?: boolean; color?: [number, number, number]; tam?: number } = {}) => {
    doc.setFont('helvetica', opciones.negrita ? 'bold' : 'normal').setFontSize(opciones.tam ?? 9.5).setTextColor(...(opciones.color ?? TINTA));
    const lineas = doc.splitTextToSize(seguro(t), util) as string[];
    for (const l of lineas) { salto(5); doc.text(l, MARGEN, y); y += 4.7; }
    y += 1.6;
  };
  const dato = (k: string, v: string | null | undefined) => {
    const lineas = doc.splitTextToSize(seguro(v && v.trim() ? v : 'No indicado'), util - 52) as string[];
    salto(lineas.length * 4.6 + 1);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...APAGADO).text(seguro(k), MARGEN, y);
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TINTA).text(lineas, MARGEN + 52, y);
    y += lineas.length * 4.6 + 1;
  };

  /* ---- Encabezado ---- */
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...MARCA).text(BRAND.nombre, MARGEN, 16);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO).text(seguro(BRAND.descriptor), MARGEN, 20);
  doc.setFontSize(8).text(seguro(`Generado: ${horaLima(d.generadoEn)} (hora de Lima)`), ancho - MARGEN, 16, { align: 'right' });
  doc.setDrawColor(...MARCA).setLineWidth(0.6).line(MARGEN, 24, ancho - MARGEN, 24);

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...TINTA).text('CONTRATO DE PRÉSTAMO (MUTUO)', ancho / 2, 35, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...(borrador ? ALERTA : APAGADO));
  doc.text(seguro(borrador
    ? 'BORRADOR para revisión · aún no es un préstamo registrado ni un contrato vigente'
    : `Código ${d.codigo ?? '-'} · Versión del contrato ${api.version}`), ancho / 2, 41, { align: 'center' });
  y = 52;

  /* ---- Lugar y fecha ---- */
  parrafo(`${d.lugarCelebracion ? `En ${d.lugarCelebracion}, a` : 'A'} ${fecha(d.fechaCelebracion)}, se celebra el presente contrato de préstamo entre las partes siguientes.`);

  /* ---- I. Partes ---- */
  titulo('I. Las partes');
  parrafo('EL PRESTAMISTA', { negrita: true, tam: 9 });
  dato('Denominación', pr.denominacion ?? BRAND.nombre);
  dato('RUC', pr.ruc);
  dato('Domicilio', pr.domicilio);
  dato('Representante', pr.representante);
  y += 2;
  parrafo('EL PRESTATARIO', { negrita: true, tam: 9 });
  dato(esEmpresa ? 'Razón social / nombre' : 'Nombre completo', p.nombre);
  dato('Documento', `${p.tipoDocumento} ${p.numeroDocumento}`);
  if (p.tipoDocumento === 'RUC 10' && p.dniTitular) dato('DNI del titular', p.dniTitular);
  if (p.representanteNombre) dato('Representante', `${p.representanteNombre}${p.representanteDni ? ` (DNI ${p.representanteDni})` : ''}`);
  dato('Domicilio', p.domicilio);
  dato('Teléfono', p.telefono);
  dato('Correo', p.correo);
  y += 2;

  /* ---- II. Condiciones ---- */
  titulo('II. Condiciones del préstamo');
  dato('Monto del préstamo', `${money(c.capital)}`);
  dato('Monto en letras', montoEnLetras(c.capital, c.moneda === 'PEN' ? 'SOLES' : c.moneda));
  dato('Moneda', c.moneda === 'PEN' ? 'Soles (PEN)' : c.moneda);
  dato('Tasa efectiva anual (TEA)', porcentaje(c.tea));
  parrafo(`Modalidad de la tasa: ${c.modalidadTasa}`, { tam: 8.5, color: APAGADO });
  dato('Plazo', `${c.plazoMeses} cuota${c.plazoMeses === 1 ? '' : 's'}`);
  dato('Frecuencia de pago', c.frecuenciaPago);
  dato('Fecha de desembolso', fecha(c.fechaDesembolso));
  dato('Primera cuota', fecha(c.fechaPrimerVencimiento));
  dato('Última cuota', fecha(c.fechaUltimoVencimiento));
  dato('Cuota mensual', money(c.cuotaMensual));
  dato('Total de intereses', money(c.totalIntereses));
  dato('Total a pagar', money(c.totalContractual));
  if (c.observaciones) dato('Observaciones', c.observaciones);
  y += 2;

  /* ---- III. Pago ---- */
  titulo('III. Pago del préstamo');
  parrafo(`EL PRESTATARIO se obliga a pagar el préstamo en ${c.plazoMeses} cuota${c.plazoMeses === 1 ? '' : 's'} en las fechas y por los importes del Anexo 1 (cronograma de pagos), hasta completar ${money(c.totalContractual)}, que comprende el capital de ${money(c.capital)} y los intereses de ${money(c.totalIntereses)}.`);
  parrafo('Los importes del Anexo 1 son los calculados por el sistema en la fecha de este documento y no se recalculan.');

  /* ---- IV. Lo que no está definido ---- */
  titulo('IV. Aspectos no definidos en este documento');
  parrafo('El sistema no contiene texto aprobado sobre los puntos siguientes, por lo que este documento no los regula. Deben ser completados o revisados por el área legal antes de usar este contrato como documento formal:', { color: APAGADO, tam: 9 });
  for (const t of d.noDefinido) parrafo(`- ${t}`, { tam: 9 });

  /* ---- V. Firmas manuscritas ---- */
  salto(48);
  y += 8;
  titulo('V. Firmas');
  parrafo('Este documento prevé la firma manuscrita de las partes. No incluye firma electrónica.', { color: APAGADO, tam: 8.5 });
  y += 16;
  const mitad = util / 2;
  doc.setDrawColor(...TINTA).setLineWidth(0.3);
  doc.line(MARGEN, y, MARGEN + mitad - 10, y);
  doc.line(MARGEN + mitad + 10, y, ancho - MARGEN, y);
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...TINTA);
  doc.text('EL PRESTAMISTA', MARGEN, y + 5);
  doc.text('EL PRESTATARIO', MARGEN + mitad + 10, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...APAGADO);
  doc.text(seguro(pr.denominacion ?? BRAND.nombre), MARGEN, y + 9.5, { maxWidth: mitad - 10 });
  doc.text(seguro(`${p.nombre} · ${p.tipoDocumento} ${p.numeroDocumento}`), MARGEN + mitad + 10, y + 9.5, { maxWidth: mitad - 10 });
  y += 14;

  /* ---- Anexo 1: cronograma ---- */
  doc.addPage();
  y = 26;
  titulo('Anexo 1 · Cronograma de pagos');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN, top: 26, bottom: 20 },
    tableWidth: util,
    theme: 'plain',
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head: [['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo de capital']],
    body: d.cronograma.map((q) => [String(q.numero), fecha(q.fechaVencimiento), money(q.capital), money(q.interes), money(q.importeCuota), money(q.saldo)].map(seguro)),
    foot: [[{ content: 'Totales', colSpan: 2, styles: { halign: 'left' as const } }, seguro(money(c.capital)), seguro(money(c.totalIntereses)), seguro(money(c.totalContractual)), '']],
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 }, lineColor: LINEA, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: FONDO, textColor: APAGADO, fontStyle: 'bold', fontSize: 8, lineWidth: { bottom: 0.4 } },
    footStyles: { fillColor: FONDO, textColor: TINTA, fontStyle: 'bold', lineWidth: { top: 0.4 } },
    columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 26 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' } },
    didParseCell: (cel) => {
      if ((cel.section === 'head' || cel.section === 'foot') && cel.column.index >= 2) cel.cell.styles.halign = 'right';
    }
  });

  /* ---- Pie, numeración y marca BORRADOR en todas las páginas ---- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...APAGADO);
      doc.text(BRAND.nombre, MARGEN, 11);
      doc.text(seguro(borrador ? 'Contrato de préstamo · BORRADOR' : `Contrato de préstamo · ${d.codigo ?? ''}`), ancho - MARGEN, 11, { align: 'right' });
      doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, 13.5, ancho - MARGEN, 13.5);
    }
    doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, alto - 16, ancho - MARGEN, alto - 16);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...APAGADO);
    const pie = borrador
      ? `BORRADOR sin valor contractual hasta confirmar el préstamo · ${d.plantillaVersion}`
      : `${d.codigo ?? ''} · v${api.version} · ${d.plantillaVersion} · Huella SHA-256: ${api.huella.slice(0, 16)}…`;
    doc.text(seguro(pie), MARGEN, alto - 11);
    doc.text(`Página ${i} de ${total}`, ancho - MARGEN, alto - 11, { align: 'right' });
    if (borrador) {
      doc.saveGraphicsState();
      doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => object }).GState({ opacity: 0.09 }) as never);
      doc.setFont('helvetica', 'bold').setFontSize(90).setTextColor(...ALERTA);
      doc.text('BORRADOR', ancho / 2, alto / 2 + 10, { align: 'center', angle: 40 });
      doc.restoreGraphicsState();
    }
  }
  return doc;
}

/** Un dibujo por versión de plantilla: los contratos guardados con una versión antigua se siguen viendo con ella. */
const RENDERIZADORES: Record<string, (c: Contexto) => Promise<Awaited<ReturnType<typeof renderMutuo1>>>> = {
  'CONTRATO-MUTUO-1.0': renderMutuo1
};

export const nombreArchivoContrato = (api: ContratoApi) =>
  api.estado === 'BORRADOR' ? `${BRAND.archivo}-contrato-borrador.pdf` : `${BRAND.archivo}-${api.codigo ?? 'prestamo'}-contrato.pdf`;

export async function generarPdfContrato(api: ContratoApi): Promise<Blob> {
  return (await crearDocumentoContrato(api)).output('blob');
}

/** Descarga el PDF del contrato. Es independiente del PDF del cronograma. No toca la base de datos. */
export async function descargarPdfContrato(api: ContratoApi) {
  const blob = await generarPdfContrato(api);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivoContrato(api);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}
