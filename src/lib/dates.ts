import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';

/* Todas las fechas de dominio son `yyyy-MM-dd`. Se calculan en calendario local, sin horas. */

const parse = (s: string) => parseISO(s);
export const toISO = (d: Date) => format(d, 'yyyy-MM-dd');
/**
 * Fecha ACTUAL del sistema (calendario local), no la fecha simulada del prototipo (CFG.hoy). Se usa para la fecha prevista
 * de desembolso de una solicitud nueva; los datos históricos mock siguen anclados a CFG.hoy y no se recalculan.
 */
export const hoySistema = () => toISO(new Date());

/**
 * Suma meses al calendario. Si el mes destino no tiene ese día, usa el último día
 * (31-ene + 1 mes = 28/29-feb), igual que el prototipo original.
 */
export const addMonths = (s: string, meses: number) => toISO(dfAddMonths(parse(s), meses));
export const addDays = (s: string, dias: number) => toISO(dfAddDays(parse(s), dias));
export const diasEntre = (hasta: string, desde: string) => differenceInCalendarDays(parse(hasta), parse(desde));
export const finDeMes = (s: string) => toISO(endOfMonth(parse(s)));
export const mesDe = (s: string) => s.slice(0, 7);
export const esFechaValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parse(s));

const fmt = (s: string, pattern: string) => (esFechaValida(s) ? format(parse(s), pattern, { locale: es }) : '—');

/** 13 oct 2026 */
export const fecha = (s: string) => fmt(s, 'dd MMM yyyy');
/** martes, 13 de octubre de 2026 */
export const fechaLarga = (s: string) => fmt(s, "EEEE d 'de' MMMM 'de' yyyy");
/** oct */
export const mesCorto = (ym: string) => fmt(`${ym}-01`, 'MMM');
/** oct 26 */
export const mesAnio = (ym: string) => fmt(`${ym}-01`, "MMM ''yy");
/** octubre de 2026 */
export const mesLargo = (ym: string) => fmt(`${ym}-01`, "MMMM 'de' yyyy");
/** octubre */
export const mesNombre = (ym: string) => fmt(`${ym}-01`, 'MMMM');
