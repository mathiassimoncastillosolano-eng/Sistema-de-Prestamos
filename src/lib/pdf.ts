/* =========================================================
   DOCUMENTOS PDF del cronograma de cuotas.
   - «simulacion»: previo al registro. Se identifica como SIMULACIÓN NO REGISTRADA y no lleva código de préstamo.
   - «registrado»: el préstamo guardado, con su cronograma persistido.
   Se generan en el navegador con jsPDF + autotable (carga diferida). NO recalculan nada: los importes y las fechas son los
   que entrega el servidor (la simulación y el detalle comparten fórmula y fecha de Lima). No registran ni modifican datos.
   Es un documento informativo: no afirma validez contractual ni legal.
   ========================================================= */
import { BRAND } from './config';
import { fecha } from './dates';
import { money } from './format';

const MARGEN = 15;
const TINTA: [number, number, number] = [26, 32, 44];
const APAGADO: [number, number, number] = [92, 102, 118];
const LINEA: [number, number, number] = [214, 219, 227];
const MARCA: [number, number, number] = [18, 54, 90]; // azul corporativo #12365A
const FONDO_CABECERA: [number, number, number] = [236, 241, 245];
const AVISO_FONDO: [number, number, number] = [251, 240, 217];
const AVISO_TEXTO: [number, number, number] = [143, 91, 10];

/** Los PDF usan fuentes estándar (WinAnsi): se sustituyen los pocos caracteres fuera de Latin-1. */
const seguro = (t: string) => t.replace(/[‐-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');

export interface CuotaPdf {
  numero: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  importeCuota: number;
  saldo: number;
  /** Solo en el préstamo registrado: PENDIENTE | PAGADA | VENCIDA. */
  estado?: string;
}

export interface DatosPdf {
  tipo: 'simulacion' | 'registrado';
  /** PR-1001. Solo existe en un préstamo registrado: una simulación NO tiene código. */
  codigo?: string;
  clienteNombre?: string;
  clienteDocumento?: string;
  agencia?: string;
  asesor?: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  estado?: string;
  capitalPendiente?: number;
  totalPendiente?: number;
  cuotas: CuotaPdf[];
}

const formatoGeneracion = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
/** «18 oct 2026, 15:42» en hora de Lima. */
export const marcaDeTiempoLima = (d: Date = new Date()) => formatoGeneracion.format(d).replace(/\./g, '');

export const nombreArchivoPdf = (d: DatosPdf) =>
  d.tipo === 'registrado' ? `PeruCred-${d.codigo ?? 'prestamo'}-cronograma.pdf` : 'PeruCred-simulacion-cronograma.pdf';

/** Construye el documento (jsPDF). Se separa de la generación del Blob para poder inspeccionarlo en pruebas. */
export async function crearDocumentoPdf(d: DatosPdf, generadoEn: Date = new Date()) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const simulacion = d.tipo === 'simulacion';
  const ultima = d.cuotas[d.cuotas.length - 1];
  const conEstado = !simulacion && d.cuotas.some((q) => q.estado);

  /* ---- Encabezado ---- */
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...MARCA);
  doc.text(BRAND.nombre, MARGEN, 16);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
  doc.text(BRAND.descriptor, MARGEN, 19.8);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...APAGADO);
  doc.text(seguro(`Generado el ${marcaDeTiempoLima(generadoEn)} (hora de Lima)`), ancho - MARGEN, 16, { align: 'right' });
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...TINTA);
  doc.text(simulacion ? 'Simulación de cronograma de cuotas' : 'Ficha y cronograma del préstamo', MARGEN, 26);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...APAGADO);
  doc.text(simulacion ? 'Simulación no registrada' : `Código ${d.codigo ?? '-'}${d.estado ? ` · Estado ${d.estado}` : ''}`, MARGEN, 32);
  doc.setDrawColor(...LINEA).setLineWidth(0.3).line(MARGEN, 36, ancho - MARGEN, 36);

  let y = 40;
  if (simulacion) {
    doc.setFillColor(...AVISO_FONDO).roundedRect(MARGEN, y, util, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...AVISO_TEXTO);
    doc.text('SIMULACIÓN NO REGISTRADA: no existe un préstamo con estas condiciones. Las cifras son referenciales.', MARGEN + 3, y + 5.7);
    y += 13;
  }

  /* ---- Bloques de datos (dos columnas, texto con ajuste para nombres largos) ---- */
  const columna = (x: number, yy0: number, titulo: string, filas: [string, string][], w: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MARCA);
    doc.text(titulo, x, yy0);
    let yy = yy0 + 5;
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
  const cliFilas: [string, string][] = [['Cliente', d.clienteNombre ?? '-'], ['Documento', d.clienteDocumento ?? '-']];
  if (d.agencia || d.asesor) cliFilas.push(['Agencia / asesor', `${d.agencia ?? '-'} / ${d.asesor ?? '-'}`]);
  const conFilas: [string, string][] = [
    [simulacion ? 'Capital solicitado' : 'Capital', money(d.capital)],
    ['Plazo y tasa', `${d.plazoMeses} cuotas mensuales · TEA ${(d.tea * 100).toFixed(0)} %`],
    [simulacion ? 'Fecha de desembolso propuesta' : 'Fecha de desembolso registrada', fecha(d.fechaDesembolso)],
    ['Primera y última cuota', `${fecha(d.fechaPrimerVencimiento)} · ${ultima ? fecha(ultima.fechaVencimiento) : '-'}`]
  ];
  const y1 = columna(MARGEN, y + 3, simulacion ? 'Cliente (referencia)' : 'Cliente', cliFilas, colW);
  const y2 = columna(x2, y + 3, 'Condiciones', conFilas, colW);
  y = Math.max(y1, y2) + 1;

  /* ---- Resumen de importes ---- */
  doc.setFillColor(...FONDO_CABECERA).roundedRect(MARGEN, y, util, 19, 1.5, 1.5, 'F');
  const celdas: [string, string][] = [
    ['Capital', money(d.capital)], ['Total de intereses', money(d.totalIntereses)],
    ['Total contractual', money(d.totalContractual)],
    simulacion ? ['Cuota mensual', money(d.cuotaMensual)] : ['Capital pendiente', money(d.capitalPendiente ?? 0)]
  ];
  const cw = util / celdas.length;
  celdas.forEach(([k, v], i) => {
    const cx = MARGEN + cw * i + 4;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...APAGADO).text(seguro(k), cx, y + 6.5);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA).text(seguro(v), cx, y + 13.5);
  });
  y += 19;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
  doc.text(seguro(simulacion
    ? 'Calculado con TEA convertida a tasa efectiva mensual, cuotas iguales y vencimientos por mes calendario.'
    : `Importe contractual pendiente: ${money(d.totalPendiente ?? 0)}. El sistema no registra pagos: PAGADA refleja el estado guardado de la cuota.`), MARGEN, y + 4.5);
  y += 9;

  /* ---- Cronograma ---- */
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MARCA).text('Cronograma de cuotas', MARGEN, y + 3);
  const cabecera = ['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo de capital', ...(conEstado ? ['Estado'] : [])];
  const derecha = [2, 3, 4, 5];
  autoTable(doc, {
    startY: y + 6,
    margin: { left: MARGEN, right: MARGEN, top: 18, bottom: 18 },
    tableWidth: util,
    theme: 'plain',
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head: [cabecera],
    body: d.cuotas.map((q) => [String(q.numero), fecha(q.fechaVencimiento), money(q.capital), money(q.interes), money(q.importeCuota), money(q.saldo), ...(conEstado ? [q.estado ?? '-'] : [])].map(seguro)),
    foot: [[{ content: 'Totales', colSpan: 2, styles: { halign: 'left' as const } }, seguro(money(d.capital)), seguro(money(d.totalIntereses)), seguro(money(d.totalContractual)), ...(conEstado ? ['', ''] : [''])]],
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, overflow: 'linebreak', valign: 'middle', lineColor: LINEA, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: FONDO_CABECERA, textColor: APAGADO, fontStyle: 'bold', fontSize: 8, lineWidth: { bottom: 0.4 } },
    footStyles: { fillColor: FONDO_CABECERA, textColor: TINTA, fontStyle: 'bold', lineWidth: { top: 0.4 } },
    columnStyles: {
      0: { cellWidth: 11, halign: 'left' }, 1: { cellWidth: 25 },
      2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 'auto', halign: 'right' }
    },
    didParseCell: (c) => {
      if ((c.section === 'head' || c.section === 'foot') && derecha.includes(c.column.index)) c.cell.styles.halign = 'right';
    }
  });

  /* ---- Pie y numeración en todas las páginas ---- */
  const total = doc.getNumberOfPages();
  const pie = simulacion ? 'Simulación no registrada · Documento informativo' : `${d.codigo ?? ''} · Documento informativo`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, alto - 14, ancho - MARGEN, alto - 14);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
    doc.text(seguro(`${pie} generado por ${BRAND.nombre}`), MARGEN, alto - 9);
    doc.text(`Página ${i} de ${total}`, ancho - MARGEN, alto - 9, { align: 'right' });
  }

  return doc;
}

export async function generarPdf(d: DatosPdf): Promise<Blob> {
  return (await crearDocumentoPdf(d)).output('blob');
}

/** Dispara la descarga del PDF en el navegador. No toca la base de datos. */
export async function descargarPdf(d: DatosPdf) {
  const blob = await generarPdf(d);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivoPdf(d);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}
