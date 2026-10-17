/* =========================================================
   REGLAS FINANCIERAS — toda la lógica de cálculo vive aquí y solo aquí.
   Ningún componente debe recalcular cuotas, saldos o límites por su cuenta.

   SUPUESTOS DE DEMOSTRACIÓN (heredados del prototipo; el documento de requisitos no los define por completo):
   1. Amortización: cuotas iguales (sistema francés).
   2. La TEA se convierte a tasa mensual efectiva: (1+TEA)^(1/12)−1.
   3. Redondeo a 2 decimales; la última cuota absorbe el ajuste.
   4. Fechas: la cuota k vence k meses después del desembolso; si el mes no tiene ese día, el último día del mes.
   5. Límite de endeudamiento = capital pendiente (sin intereses futuros).
   6. NO existe operativa de pagos: el sistema registra préstamos y consulta cronogramas. Lo único que se conserva
      es un REGISTRO HISTÓRICO importado (solo lectura) del que salen el capital pendiente y el resumen del préstamo.
      La interfaz NO clasifica cada cuota como pagada/pendiente/vencida: sin conciliación de pagos esa etiqueta no es fiable.
   7. El cronograma original NUNCA se reescribe. Sin registro histórico, el capital pendiente NO disminuye.

   Esta migración conserva el comportamiento del prototipo. Ver DISCREPANCIA ABIERTA en lib/config.ts.
   ========================================================= */
import type { Cuota, Prestamo, RegistroHistorico, ResumenPrestamo } from '@/types';
import { CFG } from './config';
import { addMonths } from './dates';
import { money } from './format';

export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Una cuota está abierta mientras el registro histórico no cubra su importe (tolerancia de medio céntimo). */
export const cuotaAbierta = (c: Cuota) => c.cubierto < c.cuota - 0.005;
/** Importe contractual de la cuota que aún no figura cubierto en el registro histórico. */
export const importePendienteCuota = (c: Cuota) => r2(c.cuota - c.cubierto);

export const tasaMensual = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1;

export function generarCronograma(capital: number, n: number, desembolso: string, tea: number = CFG.tea): Cuota[] {
  const r = tasaMensual(tea);
  const pmt = (capital * r) / (1 - Math.pow(1 + r, -n));
  let saldo = capital;
  const out: Cuota[] = [];
  for (let k = 1; k <= n; k++) {
    const interes = r2(saldo * r);
    const cap = k === n ? saldo : r2(pmt - interes);
    saldo = r2(saldo - cap);
    out.push({
      n: k,
      fecha: addMonths(desembolso, k),
      capital: cap,
      interes,
      cuota: r2(cap + interes),
      cubierto: 0,
      saldo
    });
  }
  return out;
}

/**
 * SOLO PARA IMPORTAR HISTÓRICO (semilla mock y reconstrucciones). No está conectada a ninguna acción de usuario.
 * Aplica un monto histórico a las cuotas abiertas, en orden. Devuelve un cronograma NUEVO (no muta).
 */
export function cubrirConHistorico(cronograma: Cuota[], monto: number): Cuota[] {
  let resto = monto;
  return cronograma.map((c) => {
    if (resto <= 0.004) return c;
    const falta = importePendienteCuota(c);
    if (falta <= 0.004) return c;
    const t = Math.min(resto, falta);
    resto = r2(resto - t);
    return { ...c, cubierto: r2(c.cubierto + t) };
  });
}

/** SOLO PARA IMPORTAR HISTÓRICO: devuelve el préstamo con un movimiento histórico incorporado (inmutable). */
export function importarHistorico(p: Prestamo, reg: RegistroHistorico): Prestamo {
  return { ...p, cronograma: cubrirConHistorico(p.cronograma, reg.monto), historico: [...p.historico, reg] };
}

export function resumen(p: Pick<Prestamo, 'cronograma' | 'capital'>): ResumenPrestamo {
  const total = r2(p.cronograma.reduce((a, c) => a + c.cuota, 0));
  const cubierto = r2(p.cronograma.reduce((a, c) => a + c.cubierto, 0));
  const pendiente = r2(total - cubierto);
  const abiertas = p.cronograma.filter(cuotaAbierta);
  const capitalPend = r2(abiertas.reduce((a, c) => a + c.capital, 0));
  const vencidas = abiertas.filter((c) => c.fecha < CFG.hoy).length;
  const estado = pendiente <= 0.005 ? 'Finalizado' : vencidas ? 'Con cuotas vencidas' : 'Vigente';
  return { total, cubierto, pendiente, interes: r2(total - p.capital), capitalPend, vencidas, proxima: abiertas[0] ?? null, estado };
}

export const capitalPendienteCliente = (prestamos: Prestamo[], clienteId: string) =>
  r2(prestamos.filter((p) => p.clienteId === clienteId).reduce((a, p) => a + resumen(p).capitalPend, 0));

export const capacidadDisponible = (deuda: number) => Math.max(0, r2(CFG.limite - deuda));

/**
 * Capital pendiente de un préstamo a una fecha pasada, reproduciendo su REGISTRO HISTÓRICO en orden cronológico.
 * Sin registros, el capital pendiente es el capital completo desde el desembolso (no se inventa amortización).
 */
export function capitalPendienteAl(p: Prestamo, fecha: string): number {
  if (p.desembolso > fecha) return 0;
  let cr = p.cronograma.map((c) => ({ ...c, cubierto: 0 }));
  const movs = p.historico.map((g, i) => ({ g, i })).filter((x) => x.g.fecha <= fecha);
  movs.sort((a, b) => (a.g.fecha === b.g.fecha ? a.i - b.i : a.g.fecha < b.g.fecha ? -1 : 1));
  for (const { g } of movs) cr = cubrirConHistorico(cr, g.monto);
  return r2(cr.filter(cuotaAbierta).reduce((a, c) => a + c.capital, 0));
}

/* ---------------- Validaciones ---------------- */

export type CampoSolicitud = 'clienteId' | 'monto' | 'plazo' | 'desembolso';

export interface ChequeoSolicitud {
  ok: boolean;
  campo: CampoSolicitud;
  label: string;
  ayuda: string;
}

export interface EntradaSolicitud {
  clienteId: string;
  monto: number;
  plazo: number;
  desembolso: string;
  deudaActual: number;
}

/** Validaciones de una solicitud de préstamo. Única fuente: la usan el formulario, el resumen y el servicio. */
export function validarSolicitud({ clienteId, monto, plazo, desembolso, deudaActual }: EntradaSolicitud) {
  const m = Number(monto);
  const n = Number(plazo);
  const checks: ChequeoSolicitud[] = [
    { ok: !!clienteId, campo: 'clienteId', label: 'Cliente registrado con identidad validada (simulada)', ayuda: 'Selecciona un cliente existente.' },
    { ok: m >= CFG.minMonto, campo: 'monto', label: `Monto igual o superior a ${money(CFG.minMonto)}`, ayuda: `Ingresa un monto de al menos ${money(CFG.minMonto)}.` },
    { ok: Number.isInteger(n) && n >= CFG.plazoMin && n <= CFG.plazoMax, campo: 'plazo', label: `Plazo entre ${CFG.plazoMin} y ${CFG.plazoMax} meses`, ayuda: `Usa un plazo entero entre ${CFG.plazoMin} y ${CFG.plazoMax}.` },
    {
      ok: !!clienteId && m > 0 && deudaActual + m <= CFG.limite + 0.005,
      campo: 'monto',
      label: `Capital pendiente acumulado + nuevo monto ≤ ${money(CFG.limite)} (toda la empresa)`,
      ayuda: `La capacidad disponible es ${money(capacidadDisponible(deudaActual))}. Reduce el monto.`
    },
    { ok: !!desembolso, campo: 'desembolso', label: 'Datos suficientes para generar el cronograma', ayuda: 'Indica la fecha de desembolso.' }
  ];
  return { checks, ok: checks.every((c) => c.ok) };
}

export interface Simulacion {
  cronograma: Cuota[];
  cuota: number;
  total: number;
  interes: number;
  primera: string;
}

export function simular({ monto, plazo, desembolso }: { monto: number; plazo: number; desembolso: string }): Simulacion | null {
  const m = Number(monto);
  const n = Number(plazo);
  if (!(m > 0) || !Number.isInteger(n) || n < 1 || n > CFG.plazoMax || !desembolso) return null;
  const cronograma = generarCronograma(m, n, desembolso);
  const total = r2(cronograma.reduce((a, c) => a + c.cuota, 0));
  const primera = cronograma[0];
  if (!primera) return null;
  return { cronograma, cuota: primera.cuota, total, interes: r2(total - m), primera: addMonths(desembolso, 1) };
}
