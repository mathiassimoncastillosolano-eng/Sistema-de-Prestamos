/* =========================================================
   Monto en letras (español) para el contrato: «MIL CIENTO CINCUENTA Y 25/100 SOLES».
   Solo formatea el importe que entrega el servidor; no calcula nada financiero.
   ========================================================= */

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** 0–999 en letras. */
function centenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]);
    }
  }
  return partes.join(' ');
}

/** Entero 0–999 999 999 en letras (apocopa «UN» antes de MIL y MILLONES). */
export function enteroEnLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new RangeError('Entero fuera de rango');
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopa(centenas(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocopa(centenas(miles))} MIL`);
  if (resto) partes.push(centenas(resto));
  return partes.join(' ');
}

/** «UNO» → «UN», «VEINTIUNO» → «VEINTIÚN» al final de la expresión que precede a MIL/MILLONES. */
function apocopa(t: string): string {
  return t.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');
}

/** «MIL CIENTO CINCUENTA Y 25/100 SOLES»: importe con dos decimales exactos (se redondea a centavos). */
export function montoEnLetras(monto: number, moneda = 'SOLES'): string {
  const centavosTotal = Math.round((Number.isFinite(monto) ? monto : 0) * 100);
  const entero = Math.floor(centavosTotal / 100);
  const cent = centavosTotal % 100;
  return `${enteroEnLetras(entero)} CON ${String(cent).padStart(2, '0')}/100 ${moneda}`;
}
