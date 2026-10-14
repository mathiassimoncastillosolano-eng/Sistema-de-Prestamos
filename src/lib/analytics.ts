/* =========================================================
   ANALÍTICAS DEL DASHBOARD — todo se calcula desde los registros (clientes, préstamos, cuotas, pagos).
   No existen cifras independientes: si cambia un pago, cambian los indicadores y los gráficos.
   ========================================================= */
import type { Cliente, Cuota, Db, EstadoPrestamo, Prestamo } from '@/types';
import { CFG, USUARIO_DEMO } from './config';
import { addDays, addMonths, finDeMes, mesDe } from './dates';
import { capitalPendienteAl, cuotaAbierta, faltaCuota, r2, resumen } from './finance';
import { deudaCliente } from './selectors';
import { variacion } from './format';

export type Alcance = 'mis' | 'agencia' | 'empresa';
export const ALCANCES: { value: Alcance; label: string }[] = [
  { value: 'mis', label: 'Mi cartera' },
  { value: 'agencia', label: `Agencia ${USUARIO_DEMO.agencia}` },
  { value: 'empresa', label: 'Toda la empresa' }
];
export const PERIODOS = [3, 6, 12] as const;

export interface PuntoMensual {
  mes: string;
  desembolsos: number;
  pagos: number;
  capitalPendiente: number;
  /** El mes en curso aún no termina. */
  parcial: boolean;
}

export interface CuotaPendiente {
  prestamo: Prestamo;
  cliente: Cliente | undefined;
  cuota: Cuota;
  falta: number;
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
  pagosMes: number;
  variacionPagos: number | null;
  vencidas: CuotaPendiente[];
  montoVencido: number;
  proximas: CuotaPendiente[];
  proximasVentana: { cantidad: number; monto: number };
  serie: PuntoMensual[];
  estados: { estado: EstadoPrestamo; cantidad: number; capital: number }[];
  clientesCercaLimite: { cliente: Cliente; deuda: number }[];
  /** Mes anterior de comparación, p. ej. "2026-09". */
  mesPrevio: string;
}

const suma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
const enRango = (f: string, desde: string, hasta: string) => f >= desde && f <= hasta;

export function calcularDashboard(db: Db, alcance: Alcance, meses: number): Dashboard {
  const dePrestamo = (p: Prestamo) => alcance === 'empresa' || (alcance === 'mis' ? p.asesor === USUARIO_DEMO.nombre : p.agencia === USUARIO_DEMO.agencia);
  const deCliente = (c: Cliente) => alcance === 'empresa' || (alcance === 'mis' ? c.asesor === USUARIO_DEMO.nombre : c.agencia === USUARIO_DEMO.agencia);

  const ps = db.prestamos.filter(dePrestamo);
  const rs = ps.map((p) => ({ p, r: resumen(p) }));
  const vigentes = rs.filter((x) => x.r.estado !== 'Cancelado');
  const cliente = (id: string) => db.clientes.find((c) => c.id === id);

  const hoy = CFG.hoy;
  const inicioMes = hoy.slice(0, 8) + '01';
  const inicioPrevio = addMonths(inicioMes, -1);
  const mismoDiaPrevio = addMonths(hoy, -1); // misma ventana de días, para comparar justo
  const cierrePrevio = finDeMes(inicioPrevio);

  const pagos = ps.flatMap((p) => p.pagos);
  const pagosMes = suma(pagos.filter((g) => enRango(g.fecha, inicioMes, hoy)).map((g) => g.monto));
  const pagosPrevio = suma(pagos.filter((g) => enRango(g.fecha, inicioPrevio, mismoDiaPrevio)).map((g) => g.monto));
  const desembolsadoMes = suma(ps.filter((p) => enRango(p.desembolso, inicioMes, hoy)).map((p) => p.capital));
  const desembolsadoPrevio = suma(ps.filter((p) => enRango(p.desembolso, inicioPrevio, mismoDiaPrevio)).map((p) => p.capital));

  const capitalPendiente = suma(vigentes.map((x) => x.r.capitalPend));
  const capitalPendientePrevio = suma(ps.map((p) => capitalPendienteAl(p, cierrePrevio)));

  const abiertas: CuotaPendiente[] = vigentes.flatMap(({ p }) =>
    p.cronograma.filter(cuotaAbierta).map((cuota) => ({ prestamo: p, cliente: cliente(p.clienteId), cuota, falta: faltaCuota(cuota) }))
  );
  const porFecha = (a: CuotaPendiente, b: CuotaPendiente) => a.cuota.fecha.localeCompare(b.cuota.fecha);
  const vencidas = abiertas.filter((o) => o.cuota.fecha < hoy).sort(porFecha);
  const futuras = abiertas.filter((o) => o.cuota.fecha >= hoy).sort(porFecha);
  const ventana = futuras.filter((o) => o.cuota.fecha <= addDays(hoy, CFG.diasProxVenc));

  const serie: PuntoMensual[] = Array.from({ length: meses }, (_, k) => {
    const ym = mesDe(addMonths(inicioMes, -(meses - 1 - k)));
    const fin = finDeMes(`${ym}-01`);
    const corte = fin > hoy ? hoy : fin;
    return {
      mes: ym,
      desembolsos: suma(ps.filter((p) => mesDe(p.desembolso) === ym).map((p) => p.capital)),
      pagos: suma(pagos.filter((g) => mesDe(g.fecha) === ym).map((g) => g.monto)),
      capitalPendiente: suma(ps.map((p) => capitalPendienteAl(p, corte))),
      parcial: fin > hoy
    };
  });

  const estados = (['Vigente', 'Con cuotas vencidas', 'Cancelado'] as const).map((estado) => {
    const grupo = rs.filter((x) => x.r.estado === estado);
    return { estado, cantidad: grupo.length, capital: suma(grupo.map((x) => x.r.capitalPend)) };
  });

  const clientesAlcance = db.clientes.filter(deCliente);
  const clientesCercaLimite = db.clientes
    .map((c) => ({ cliente: c, deuda: deudaCliente(db, c.id) }))
    .filter((x) => x.deuda >= CFG.limite * CFG.alertaLimite)
    .sort((a, b) => b.deuda - a.deuda);

  return {
    capitalPendiente, capitalPendientePrevio, variacionCapital: variacion(capitalPendiente, capitalPendientePrevio),
    totalDesembolsado: suma(ps.map((p) => p.capital)), desembolsadoMes, variacionDesembolsos: variacion(desembolsadoMes, desembolsadoPrevio),
    prestamosActivos: vigentes.length, prestamosTotales: ps.length, prestamosCancelados: ps.length - vigentes.length,
    clientes: clientesAlcance.length, clientesNuevosMes: clientesAlcance.filter((c) => enRango(c.alta, inicioMes, hoy)).length,
    pagosMes, variacionPagos: variacion(pagosMes, pagosPrevio),
    vencidas, montoVencido: suma(vencidas.map((o) => o.falta)),
    proximas: futuras.slice(0, 5), proximasVentana: { cantidad: ventana.length, monto: suma(ventana.map((o) => o.falta)) },
    serie, estados, clientesCercaLimite, mesPrevio: mesDe(inicioPrevio)
  };
}

/* ---------- Notificaciones: derivadas de los datos de la cartera propia ---------- */
export interface Notificacion {
  id: string;
  tono: 'danger' | 'warning' | 'info';
  titulo: string;
  detalle: string;
  ruta: string;
}

export function calcularNotificaciones(db: Db): Notificacion[] {
  const d = calcularDashboard(db, 'mis', 3);
  const out: Notificacion[] = [];
  d.vencidas.slice(0, 3).forEach((o) =>
    out.push({
      id: `v-${o.prestamo.id}-${o.cuota.n}`, tono: 'danger', titulo: `Cuota ${o.cuota.n} vencida · ${o.prestamo.id}`,
      detalle: `${o.cliente?.nombre ?? o.prestamo.clienteId} · vencía el ${o.cuota.fecha}`, ruta: `/prestamos/${o.prestamo.id}`
    })
  );
  if (d.vencidas.length > 3) out.push({ id: 'v-mas', tono: 'danger', titulo: `${d.vencidas.length - 3} cuotas vencidas más`, detalle: 'Revisa la lista de préstamos con cuotas vencidas.', ruta: '/prestamos' });
  if (d.proximasVentana.cantidad) out.push({ id: 'prox', tono: 'warning', titulo: `${d.proximasVentana.cantidad} cuota${d.proximasVentana.cantidad === 1 ? '' : 's'} vence${d.proximasVentana.cantidad === 1 ? '' : 'n'} en ${CFG.diasProxVenc} días`, detalle: 'Anticipa el contacto con los clientes.', ruta: '/prestamos' });
  d.clientesCercaLimite.slice(0, 2).forEach((x) => out.push({ id: `l-${x.cliente.id}`, tono: 'info', titulo: `${x.cliente.nombre} cerca del límite`, detalle: 'Supera el 80 % del límite de endeudamiento.', ruta: `/clientes/${x.cliente.id}` }));
  return out;
}
