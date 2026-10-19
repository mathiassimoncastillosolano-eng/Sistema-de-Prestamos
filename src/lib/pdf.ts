/* =========================================================
   DOCUMENTOS PDF del cronograma de cuotas.
   - «simulacion»: previo al registro. Se identifica como SIMULACIÓN NO REGISTRADA y no lleva código de préstamo.
   - «registrado»: el préstamo guardado, con su cronograma persistido.
   Se generan en el navegador con jsPDF + autotable (carga diferida). NO recalculan nada: los importes y las fechas son los
   que entrega el servidor (la simulación y el detalle comparten fórmula y fecha de Lima). No registran ni modifican datos.
   Es un documento informativo: no afirma validez contractual ni legal. La simulación lleva una sola leyenda discreta.
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
  /** «DNI 12345678». */
  clienteDocumento?: string;
  clienteCodigo?: string;
  clienteTelefono?: string;
  agencia?: string;
  asesor?: string;
  moneda?: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  fechaPrimerVencimiento: string;
  cuotaMensual: number;
  totalIntereses: number;
  totalContractual: number;
  estado?: string;
  cuotas: CuotaPdf[];
}

const formatoGeneracion = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
/** «18 oct 2026, 15:42» en hora de Lima. */
export const marcaDeTiempoLima = (d: Date = new Date()) => formatoGeneracion.format(d).replace(/\./g, '');

export const nombreArchivoPdf = (d: DatosPdf) =>
  d.tipo === 'registrado' ? `${BRAND.archivo}-${d.codigo ?? 'prestamo'}-cronograma.pdf` : `${BRAND.archivo}-simulacion-cronograma.pdf`;

const porcentaje = (t: number) => `${(t * 100).toFixed(2).replace(/\.00$/, '')} %`;

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
  const moneda = d.moneda === 'PEN' || !d.moneda ? 'Soles (PEN)' : d.moneda;
  const tituloCorto = simulacion ? 'Cronograma de cuotas (propuesta)' : `Cronograma de cuotas · ${d.codigo ?? ''}`;

  /** Título de sección: texto en la marca, con filete fino. Devuelve la y siguiente. */
  const seccion = (titulo: string, y: number) => {
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...MARCA);
    doc.text(seguro(titulo.toUpperCase()), MARGEN, y);
    doc.setDrawColor(...LINEA).setLineWidth(0.25).line(MARGEN, y + 1.6, ancho - MARGEN, y + 1.6);
    return y + 6;
  };

  /** Cuadrícula de pares etiqueta/valor en `cols` columnas. Devuelve la y siguiente. */
  const cuadricula = (pares: [string, string][], y: number, cols: number) => {
    const w = util / cols;
    let yy = y;
    for (let i = 0; i < pares.length; i += cols) {
      let alturaFila = 0;
      pares.slice(i, i + cols).forEach(([k, v], j) => {
        const x = MARGEN + w * j;
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO).text(seguro(k), x, yy);
        doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TINTA);
        const lineas = doc.splitTextToSize(seguro(v || '-'), w - 4) as string[];
        doc.text(lineas, x, yy + 4.3);
        alturaFila = Math.max(alturaFila, 4.3 + lineas.length * 4.2);
      });
      yy += alturaFila + 2.6;
    }
    return yy;
  };

  /* ---- 1. Encabezado institucional ---- */
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...MARCA);
  doc.text(BRAND.nombre, MARGEN, 16);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
  doc.text(seguro(BRAND.descriptor), MARGEN, 20);
  doc.setFontSize(8).text(seguro(`Emitido: ${marcaDeTiempoLima(generadoEn)} (hora de Lima)`), ancho - MARGEN, 16, { align: 'right' });
  doc.setDrawColor(...MARCA).setLineWidth(0.6).line(MARGEN, 24, ancho - MARGEN, 24);

  /* ---- 2. Título y código ---- */
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...TINTA);
  doc.text(simulacion ? 'Cronograma de cuotas' : 'Ficha y cronograma del préstamo', MARGEN, 33);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...APAGADO);
  if (simulacion) {
    doc.text('Propuesta de préstamo', MARGEN, 38.5);
    // Única mención de su carácter previo: una leyenda, sin recuadros ni colores de alerta.
    doc.setFontSize(8).setTextColor(...APAGADO).text('Documento referencial previo a la formalización del préstamo.', MARGEN, 43);
  } else {
    doc.text(seguro(`Código ${d.codigo ?? '-'}${d.estado ? `  ·  Estado: ${d.estado}` : ''}`), MARGEN, 38.5);
  }
  let y = simulacion ? 52 : 48;

  /* ---- 3. Datos del cliente ---- */
  y = seccion('Datos del cliente', y);
  const cliente: [string, string][] = [['Nombre completo', d.clienteNombre ?? '-'], ['Documento', d.clienteDocumento ?? '-']];
  if (d.clienteCodigo) cliente.push(['Código de cliente', d.clienteCodigo]);
  if (d.clienteTelefono) cliente.push(['Teléfono', d.clienteTelefono]);
  y = cuadricula(cliente, y, 2) + 2;

  /* ---- 4. Condiciones del préstamo ---- */
  y = seccion('Condiciones del préstamo', y);
  const condiciones: [string, string][] = [
    [simulacion ? 'Capital solicitado' : 'Capital', money(d.capital)],
    ['Moneda', moneda],
    ['Tasa efectiva anual (TEA)', porcentaje(d.tea)],
    ['Plazo', `${d.plazoMeses} cuotas`],
    ['Frecuencia de pago', 'Cada 30 días'],
    [simulacion ? 'Fecha de desembolso (propuesta)' : 'Fecha de desembolso', fecha(d.fechaDesembolso)],
    ['Primera cuota', fecha(d.fechaPrimerVencimiento)],
    ['Última cuota', ultima ? fecha(ultima.fechaVencimiento) : '-']
  ];
  if (!simulacion && (d.agencia || d.asesor)) condiciones.push(['Agencia', d.agencia ?? '-'], ['Asesor responsable', d.asesor ?? '-']);
  y = cuadricula(condiciones, y, 3) + 2;

  /* ---- 5. Resumen financiero ---- */
  y = seccion('Resumen financiero', y);
  const tiles: [string, string][] = [
    ['Cuota mensual', money(d.cuotaMensual)], ['Total de intereses', money(d.totalIntereses)],
    ['Total contractual', money(d.totalContractual)], ['Número de cuotas', String(d.plazoMeses)]
  ];
  doc.setFillColor(...FONDO_CABECERA).roundedRect(MARGEN, y - 1, util, 15, 1.5, 1.5, 'F');
  const cw = util / tiles.length;
  tiles.forEach(([k, v], i) => {
    const cx = MARGEN + cw * i + 4;
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO).text(seguro(k), cx, y + 3.8);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA).text(seguro(v), cx, y + 10.2);
  });
  y += 20;

  /* ---- 6-7. Cronograma de amortización y totales ---- */
  y = seccion('Cronograma de amortización', y);
  const cabecera = ['N.º', 'Vence', 'Capital', 'Interés', 'Cuota', 'Saldo de capital', ...(conEstado ? ['Estado'] : [])];
  const derecha = [2, 3, 4, 5];
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN, top: 20, bottom: 18 },
    tableWidth: util,
    theme: 'plain',
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    head: [cabecera],
    body: d.cuotas.map((q) => [String(q.numero), fecha(q.fechaVencimiento), money(q.capital), money(q.interes), money(q.importeCuota), money(q.saldo), ...(conEstado ? [q.estado ?? '-'] : [])].map(seguro)),
    foot: [[{ content: 'Totales', colSpan: 2, styles: { halign: 'left' as const } }, seguro(money(d.capital)), seguro(money(d.totalIntereses)), seguro(money(d.totalContractual)), ...(conEstado ? ['', ''] : [''])]],
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 }, overflow: 'linebreak', valign: 'middle', lineColor: LINEA, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: FONDO_CABECERA, textColor: APAGADO, fontStyle: 'bold', fontSize: 8, lineWidth: { bottom: 0.4 } },
    footStyles: { fillColor: FONDO_CABECERA, textColor: TINTA, fontStyle: 'bold', lineWidth: { top: 0.4 } },
    columnStyles: {
      0: { cellWidth: 11, halign: 'left' }, 1: { cellWidth: 25 },
      2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 'auto', halign: 'right' }
    },
    didParseCell: (c) => {
      if ((c.section === 'head' || c.section === 'foot') && derecha.includes(c.column.index)) c.cell.styles.halign = 'right';
    },
    // Páginas de continuación: referencia mínima del documento (la primera ya tiene el encabezado completo).
    didDrawPage: (datos) => {
      if (datos.pageNumber > 1) {
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...APAGADO);
        doc.text(BRAND.nombre, MARGEN, 11);
        doc.text(seguro(`${tituloCorto}${d.clienteNombre ? ` · ${d.clienteNombre}` : ''}`), ancho - MARGEN, 11, { align: 'right', maxWidth: util - 30 });
        doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, 13.5, ancho - MARGEN, 13.5);
      }
    }
  });

  /* ---- 8. Pie con numeración en todas las páginas (sin repetir leyendas) ---- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, alto - 14, ancho - MARGEN, alto - 14);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...APAGADO);
    doc.text(seguro(`${BRAND.nombre} · ${BRAND.descriptor}`), MARGEN, alto - 9);
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
