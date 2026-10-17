/* =========================================================
   DOCUMENTO PDF — "Ficha y cronograma del préstamo".
   Se genera en el navegador con jsPDF + autotable (carga diferida: no pesa hasta que se pide el PDF).
   Es un documento informativo: no contiene operaciones de pago y no afirma validez legal.
   La paginación la resuelve autotable: la cabecera de la tabla se repite en cada página, ninguna fila se parte
   y el total aparece una sola vez, al final. Todos los importes salen de lib/finance.ts (no se recalculan aquí).
   ========================================================= */
import type { Cliente, Prestamo } from '@/types';
import { BRAND, CFG } from './config';
import { fecha } from './dates';
import { resumen } from './finance';
import { money } from './format';

const MARGEN = 15;
const TINTA: [number, number, number] = [26, 32, 44];
const APAGADO: [number, number, number] = [92, 102, 118];
const LINEA: [number, number, number] = [214, 219, 227];
const MARCA: [number, number, number] = [18, 54, 90]; // azul corporativo #12365A
const FONDO_CABECERA: [number, number, number] = [236, 241, 245];

/** Los PDF usan fuentes estándar (WinAnsi): se sustituyen los pocos caracteres fuera de Latin-1. */
const seguro = (t: string) => t.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u00A0/g, ' ');

export const nombreArchivoPdf = (p: Prestamo) => `PeruCred-${p.id}-cronograma.pdf`;

/** Construye el documento (jsPDF). Se separa de la generación del Blob para poder inspeccionarlo en pruebas. */
export async function crearDocumentoPdf(p: Prestamo, c: Cliente | undefined) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const r = resumen(p);
  const ultima = p.cronograma[p.cronograma.length - 1];
  const primera = p.cronograma[0];

  /* ---- Encabezado ---- */
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...MARCA);
  doc.text(BRAND.nombre, MARGEN, 16);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
  doc.text(BRAND.descriptor, MARGEN, 19.8);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...APAGADO);
  doc.text(`Emitido el ${fecha(CFG.hoy)}`, ancho - MARGEN, 16, { align: 'right' });
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...TINTA);
  doc.text('Ficha y cronograma del préstamo', MARGEN, 26);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...APAGADO);
  doc.text(`Código ${p.id}`, MARGEN, 32);
  doc.setDrawColor(...LINEA).setLineWidth(0.3).line(MARGEN, 36, ancho - MARGEN, 36);

  /* ---- Bloques de datos (dos columnas, texto con ajuste para nombres largos) ---- */
  const columna = (x: number, y: number, titulo: string, filas: [string, string][], w: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MARCA);
    doc.text(titulo, x, y);
    let yy = y + 5;
    filas.forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...APAGADO);
      doc.text(seguro(k), x, yy);
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...TINTA);
      const lineas = doc.splitTextToSize(seguro(v || '-'), w) as string[];
      doc.text(lineas, x, yy + 4.2);
      yy += 4.2 + lineas.length * 4.4 + 1.6;
    });
    return yy;
  };

  const colW = (util - 8) / 2;
  const x2 = MARGEN + colW + 8;
  const cliFilas: [string, string][] = [
    [c?.tipo === 'RUC 20' ? 'Razón social' : 'Cliente', c?.nombre ?? p.clienteId],
    ['Documento', c ? `${c.tipo} ${c.doc}` : '-']
  ];
  if (c?.representante) cliFilas.push(['Representante legal', `${c.representante.nombre} (DNI ${c.representante.dni})`]);
  if (c?.tipo === 'RUC 10' && c.negocio) cliFilas.push(['Negocio', c.negocio]);
  cliFilas.push(['Agencia / asesor', `${p.agencia} / ${p.asesor}`]);

  const conFilas: [string, string][] = [
    ['Capital', money(p.capital)],
    ['Plazo y tasa', `${p.plazo} cuotas · TEA ${(p.tea * 100).toFixed(0)} %`],
    ['Fecha de desembolso registrada', fecha(p.desembolso)],
    ['Primer y último vencimiento', `${primera ? fecha(primera.fecha) : '-'} · ${ultima ? fecha(ultima.fecha) : '-'}`]
  ];

  const y1 = columna(MARGEN, 43, 'Cliente', cliFilas, colW);
  const y2 = columna(x2, 43, 'Condiciones del préstamo', conFilas, colW);
  let y = Math.max(y1, y2) + 1;

  /* ---- Resumen de importes ---- */
  doc.setFillColor(...FONDO_CABECERA).roundedRect(MARGEN, y, util, 19, 1.5, 1.5, 'F');
  const celdas: [string, string][] = [
    ['Capital', money(p.capital)], ['Intereses pactados', money(r.interes)],
    ['Importe contractual total', money(r.total)], ['Capital pendiente', money(r.capitalPend)]
  ];
  const cw = util / celdas.length;
  celdas.forEach(([k, v], i) => {
    const cx = MARGEN + cw * i + 4;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...APAGADO).text(k, cx, y + 6.5);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA).text(seguro(v), cx, y + 13.5);
  });
  y += 19;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
  const nota = r.cubierto > 0
    ? 'Capital pendiente calculado con el registro historico importado; el sistema no registra pagos.'
    : 'Sin registro historico de amortizaciones: el capital pendiente es el capital original. El sistema no registra pagos.';
  doc.text(nota, MARGEN, y + 4.5);
  y += 9;

  /* ---- Cronograma ---- */
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MARCA).text('Cronograma de cuotas', MARGEN, y + 3);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: MARGEN, right: MARGEN, top: 18, bottom: 18 },
    tableWidth: util,
    theme: 'plain',
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head: [['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo de capital']],
    body: p.cronograma.map((q) => [String(q.n), fecha(q.fecha), money(q.capital), money(q.interes), money(q.cuota), money(q.saldo)].map(seguro)),
    foot: [[{ content: 'Totales', colSpan: 2, styles: { halign: 'left' as const } }, seguro(money(p.capital)), seguro(money(r.interes)), seguro(money(r.total)), '']],
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, overflow: 'linebreak', valign: 'middle', lineColor: LINEA, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: FONDO_CABECERA, textColor: APAGADO, fontStyle: 'bold', fontSize: 8, lineWidth: { bottom: 0.4 } },
    footStyles: { fillColor: FONDO_CABECERA, textColor: TINTA, fontStyle: 'bold', lineWidth: { top: 0.4 } },
    columnStyles: {
      0: { cellWidth: 11, halign: 'left' }, 1: { cellWidth: 25 },
      2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 'auto', halign: 'right' }
    },
    didParseCell: (d) => {
      if (d.section === 'head' && [2, 3, 4, 5].includes(d.column.index)) d.cell.styles.halign = 'right';
      if (d.section === 'foot' && [2, 3, 4, 5].includes(d.column.index)) d.cell.styles.halign = 'right';
    }
  });

  /* ---- Pie y numeración en todas las páginas ---- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, alto - 14, ancho - MARGEN, alto - 14);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
    doc.text(`${p.id} · Documento informativo generado por ${BRAND.nombre} · Datos de demostración`, MARGEN, alto - 9);
    doc.text(`Página ${i} de ${total}`, ancho - MARGEN, alto - 9, { align: 'right' });
  }

  return doc;
}

export async function generarPdfPrestamo(p: Prestamo, c: Cliente | undefined): Promise<Blob> {
  return (await crearDocumentoPdf(p, c)).output('blob');
}

/** Dispara la descarga del PDF en el navegador. */
export async function descargarPdfPrestamo(p: Prestamo, c: Cliente | undefined) {
  const blob = await generarPdfPrestamo(p, c);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivoPdf(p);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}
