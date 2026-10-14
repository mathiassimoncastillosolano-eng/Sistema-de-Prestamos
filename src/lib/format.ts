/** Formato monetario peruano (S/ 1,234.56). Centralizado: no formatear importes en componentes. */
const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfEntero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nfCompacto = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (x: number) => `S/\u00A0${nf.format(Number.isFinite(x) ? x : 0)}`;
export const moneyEntero = (x: number) => `S/\u00A0${nfEntero.format(Number.isFinite(x) ? x : 0)}`;
/** Para ejes de gráficos: S/ 12K */
export const moneyCompacto = (x: number) => `S/\u00A0${nfCompacto.format(x)}`;
export const entero = (x: number) => nfEntero.format(x);
export const porcentaje = (x: number, decimales = 0) => `${x.toFixed(decimales)} %`;
/** Variación relativa entre dos periodos. null si la base es 0 (no se puede calcular). */
export const variacion = (actual: number, previo: number): number | null =>
  previo > 0 ? ((actual - previo) / previo) * 100 : null;
