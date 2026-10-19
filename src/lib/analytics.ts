/* =========================================================
   ANALÍTICAS DEL DASHBOARD — todo se calcula desde los registros (clientes, préstamos, cuotas, registro histórico).
   No existen cifras independientes ni indicadores de pagos: el sistema no gestiona cobros.
   ========================================================= */
import type { Cliente, Cuota, Db, EstadoPrestamo, Prestamo, ResumenPrestamo } from '@/types';
import type { IdentidadOperativa, Rol } from '@/types/auth';
import { AGENCIAS, CFG } from './config';
import { addDays, addMonths, diasEntre, finDeMes, mesDe } from './dates';
import { capitalPendienteAl, cuotaAbierta, esDesembolsado, importePendienteCuota, r2, resumen } from './finance';
import { deudaCliente } from './selectors';
import { variacion } from './format';

/** `mis`: cartera del asesor. `agencia:<nombre>`: una agencia concreta. `empresa`: todo. */
export type Alcance = 'mis' | 'empresa' | `agencia:${string}`;
export interface OpcionAlcance { value: Alcance; label: string }

/** Los nombres de la base ya empiezan con "Agencia"; los de los datos de prueba no. */
const etiquetaAgencia = (nombre: string) => (nombre.startsWith('Agencia') ? nombre : `Agencia ${nombre}`);
const deAgencia = (nombre: string): OpcionAlcance => ({ value: `agencia:${nombre}`, label: etiquetaAgencia(nombre) });

/** Alcances disponibles según el perfil real. El asesor ve su cartera y su agencia; la gerencia elige cualquier agencia. */
export function alcancesPara(rol: Rol | null, agencia: string | null, agencias: readonly string[] = AGENCIAS): OpcionAlcance[] {
  const empresa: OpcionAlcance = { value: 'empresa', label: 'Toda la empresa' };
  if (rol === 'gerencia') return [empresa, ...agencias.map(deAgencia)];
  if (rol !== 'asesor') return [empresa];
  // El asesor trabaja en una sola sucursal: ve su cartera y su agencia, nunca toda la empresa.
  return [{ value: 'mis', label: 'Mi cartera' }, ...(agencia ? [deAgencia(agencia)] : [])];
}

/** Filtro de un alcance: sirve igual para clientes y préstamos, porque ambos tienen asesor y agencia. */
export function filtroAlcance(alcance: Alcance, yo: IdentidadOperativa) {
  return (x: { asesor: string; agencia: string }) => {
    if (alcance === 'empresa') return true;
    if (alcance === 'mis') return x.asesor === yo.nombre;
    return x.agencia === alcance.slice('agencia:'.length);
  };
}

export const PERIODOS = [3, 6, 12] as const;

/** Filtro de cartera por estado del préstamo. */
export type FiltroEstado = 'todos' | 'Vigente' | 'En mora' | 'Cancelado';
export const FILTROS_ESTADO: { value: FiltroEstado; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'Vigente', label: 'Vigente' },
  { value: 'En mora', label: 'En mora' },
  { value: 'Cancelado', label: 'Cancelado' }
];

export interface PuntoMensual {
  mes: string;
  desembolsos: number;
  capitalPendiente: number;
  /** El mes en curso aún no termina. */
  parcial: boolean;
}

export interface CuotaPendiente {
  prestamo: Prestamo;
  cliente: Cliente | undefined;
  cuota: Cuota;
  /** Importe contractual de la cuota (informativo). */
  importe: number;
}

export interface ClienteMoroso {
  cliente: Cliente | undefined;
  clienteId: string;
  /** Días de atraso de su cuota vencida más antigua. */
  diasAtraso: number;
  montoVencido: number;
}

export interface Dashboard {
  capitalPendiente: number;
  /** Capital pendiente al cierre del mes anterior (para la tendencia). */
  capitalPendientePrevio: number;
  variacionCapital: number | null;
  totalDesembolsado: number;
  desembolsadoMes: number;
  variacionDesembolsos: number | null;
  prestamosActivos: number;
  prestamosTotales: number;
  prestamosCancelados: number;
  clientes: number;
  clientesNuevosMes: number;
  vencidas: CuotaPendiente[];
  /** Importe contractual de las cuotas vencidas (informativo). */
  montoVencido: number;
  proximas: CuotaPendiente[];
  proximasVentana: { cantidad: number; monto: number };
  serie: PuntoMensual[];
  estados: { estado: EstadoPrestamo; cantidad: number; capital: number }[];
  clientesCercaLimite: { cliente: Cliente; deuda: number }[];
  /** Clientes con al menos una cuota vencida. */
  morosos: ClienteMoroso[];
  /** Morosos cuya cuota vencida más antigua supera `CFG.diasExtrajudicial` días. */
  extrajudiciales: ClienteMoroso[];
  /** Mes anterior de comparación, p. ej. "2026-09". */
  mesPrevio: string;
}

const suma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
const enRango = (f: string, desde: string, hasta: string) => f >= desde && f <= hasta;

/** Parámetros del cálculo. `hoy` es la fecha de corte: la real cuando los datos vienen de la base. */
export interface FiltrosDashboard {
  alcance: Alcance;
  meses: number;
  yo: IdentidadOperativa;
  estado?: FiltroEstado;
  hoy?: string;
}

/** Agrupa las cuotas vencidas por cliente. La lista llega ordenada por fecha, así que la primera de cada cliente es la más antigua. */
function agruparMorosos(vencidas: CuotaPendiente[], hoy: string): ClienteMoroso[] {
  const porCliente = new Map<string, ClienteMoroso>();
  for (const o of vencidas) {
    const id = o.prestamo.clienteId;
    const m = porCliente.get(id) ?? { cliente: o.cliente, clienteId: id, diasAtraso: diasEntre(hoy, o.cuota.fecha), montoVencido: 0 };
    m.montoVencido = r2(m.montoVencido + o.importe);
    porCliente.set(id, m);
  }
  return [...porCliente.values()].sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export function calcularDashboard(db: Db, { alcance, meses, yo, estado = 'todos', hoy = CFG.hoy }: FiltrosDashboard): Dashboard {
  const enAlcance = filtroAlcance(alcance, yo);
  const conEstado = (r: ResumenPrestamo) => estado === 'todos' || r.estado === estado;

  /* Solo préstamos desembolsados: las solicitudes en evaluación, aprobadas o rechazadas no son cartera. */
  const rs = db.prestamos.filter(enAlcance).filter(esDesembolsado).map((p) => ({ p, r: resumen(p, hoy) })).filter((x) => conEstado(x.r));
  const ps = rs.map((x) => x.p);
  const vigentes = rs.filter((x) => x.r.estado !== 'Cancelado');
  const cliente = (id: string) => db.clientes.find((c) => c.id === id);

  const inicioMes = hoy.slice(0, 8) + '01';
  const inicioPrevio = addMonths(inicioMes, -1);
  const mismoDiaPrevio = addMonths(hoy, -1); // misma ventana de días, para comparar justo
  const cierrePrevio = finDeMes(inicioPrevio);

  const desembolsadoMes = suma(ps.filter((p) => enRango(p.desembolso, inicioMes, hoy)).map((p) => p.capital));
  const desembolsadoPrevio = suma(ps.filter((p) => enRango(p.desembolso, inicioPrevio, mismoDiaPrevio)).map((p) => p.capital));

  const capitalPendiente = suma(vigentes.map((x) => x.r.capitalPend));
  const capitalPendientePrevio = suma(ps.map((p) => capitalPendienteAl(p, cierrePrevio)));

  const abiertas: CuotaPendiente[] = vigentes.flatMap(({ p }) =>
    p.cronograma.filter(cuotaAbierta).map((cuota) => ({ prestamo: p, cliente: cliente(p.clienteId), cuota, importe: importePendienteCuota(cuota) }))
  );
  const porFecha = (a: CuotaPendiente, b: CuotaPendiente) => a.cuota.fecha.localeCompare(b.cuota.fecha);
  const vencidas = abiertas.filter((o) => o.cuota.fecha < hoy).sort(porFecha);
  const morosos = agruparMorosos(vencidas, hoy);
  const futuras = abiertas.filter((o) => o.cuota.fecha >= hoy).sort(porFecha);
  const ventana = futuras.filter((o) => o.cuota.fecha <= addDays(hoy, CFG.diasProxVenc));

  const serie: PuntoMensual[] = Array.from({ length: meses }, (_, k) => {
    const ym = mesDe(addMonths(inicioMes, -(meses - 1 - k)));
    const fin = finDeMes(`${ym}-01`);
    const corte = fin > hoy ? hoy : fin;
    return {
      mes: ym,
      desembolsos: suma(ps.filter((p) => mesDe(p.desembolso) === ym).map((p) => p.capital)),
      capitalPendiente: suma(ps.map((p) => capitalPendienteAl(p, corte))),
      parcial: fin > hoy
    };
  });

  const estados = (['Vigente', 'En mora', 'Cancelado'] as const).map((estado) => {
    const grupo = rs.filter((x) => x.r.estado === estado);
    return { estado, cantidad: grupo.length, capital: suma(grupo.map((x) => x.r.capitalPend)) };
  });

  const clientesAlcance = db.clientes.filter(enAlcance);
  const clientesCercaLimite = clientesAlcance
    .map((c) => ({ cliente: c, deuda: deudaCliente(db, c.id) }))
    .filter((x) => x.deuda >= CFG.limite * CFG.alertaLimite)
    .sort((a, b) => b.deuda - a.deuda);

  return {
    capitalPendiente, capitalPendientePrevio, variacionCapital: variacion(capitalPendiente, capitalPendientePrevio),
    totalDesembolsado: suma(ps.map((p) => p.capital)), desembolsadoMes, variacionDesembolsos: variacion(desembolsadoMes, desembolsadoPrevio),
    prestamosActivos: vigentes.length, prestamosTotales: ps.length, prestamosCancelados: ps.length - vigentes.length,
    clientes: clientesAlcance.length, clientesNuevosMes: clientesAlcance.filter((c) => enRango(c.alta, inicioMes, hoy)).length,
    vencidas, montoVencido: suma(vencidas.map((o) => o.importe)),
    proximas: futuras.slice(0, 5), proximasVentana: { cantidad: ventana.length, monto: suma(ventana.map((o) => o.importe)) },
    serie, estados, clientesCercaLimite, morosos, extrajudiciales: morosos.filter((m) => m.diasAtraso >= CFG.diasExtrajudicial),
    mesPrevio: mesDe(inicioPrevio)
  };
}

/* ---------- Resumen por agencia (vista de gerencia) ---------- */
export interface FilaAgencia {
  agencia: string;
  prestamosActivos: number;
  capitalPendiente: number;
  morosos: number;
  extrajudiciales: number;
}

/** Una fila por agencia, reutilizando el mismo cálculo del dashboard con el alcance de cada agencia. */
export function resumenPorAgencia(db: Db, filtros: Omit<FiltrosDashboard, 'alcance' | 'meses'>, agencias: readonly string[] = AGENCIAS): FilaAgencia[] {
  return agencias.map((agencia) => {
    const d = calcularDashboard(db, { ...filtros, alcance: `agencia:${agencia}`, meses: 1 });
    return { agencia: etiquetaAgencia(agencia), prestamosActivos: d.prestamosActivos, capitalPendiente: d.capitalPendiente, morosos: d.morosos.length, extrajudiciales: d.extrajudiciales.length };
  });
}
