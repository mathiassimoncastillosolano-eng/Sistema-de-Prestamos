/* =========================================================
   CLIENTE DE LA API DEL DASHBOARD (US-11).
   GET /api/dashboard devuelve clientes, préstamos y cuotas reales; aquí se convierten al mismo formato
   que usan los cálculos de `lib/analytics.ts`, así el dashboard no necesita otra lógica.
   ========================================================= */
import type { Actividad, Cliente, Db, Prestamo, TipoCliente } from '@/types';

interface CuotaApi {
  numero: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  importeCuota: number;
  saldo: number;
  pagada: boolean;
}

interface PrestamoApi {
  id: string;
  numero: number;
  clienteId: string;
  agencia: string;
  asesor: string;
  capital: number;
  plazoMeses: number;
  tea: number;
  fechaDesembolso: string;
  registrado: string;
  cuotas: CuotaApi[];
}

interface ClienteApi {
  id: string;
  nombre: string;
  tipoDocumento: TipoCliente;
  numeroDocumento: string;
  telefono: string | null;
  agencia: string;
  asesor: string;
  alta: string;
  registrado: string;
}

export interface CarteraApi {
  hoy: string;
  agencias: string[];
  clientes: ClienteApi[];
  prestamos: PrestamoApi[];
}

export interface Cartera {
  hoy: string;
  agencias: string[];
  db: Db;
}

const aCliente = (c: ClienteApi): Cliente => ({
  id: c.id, nombre: c.nombre, tipo: c.tipoDocumento, doc: c.numeroDocumento, telefono: c.telefono ?? '',
  agencia: c.agencia, asesor: c.asesor, alta: c.alta
});

/** Sin registro de pagos: una cuota solo cuenta como cubierta si la base la marca PAGADA. */
const aPrestamo = (p: PrestamoApi): Prestamo => ({
  id: p.id, codigo: `PR-${p.numero}`, clienteId: p.clienteId, agencia: p.agencia, asesor: p.asesor,
  capital: p.capital, plazo: p.plazoMeses, tea: p.tea, desembolso: p.fechaDesembolso, observaciones: '', historico: [],
  cronograma: p.cuotas.map((c) => ({
    n: c.numero, fecha: c.fechaVencimiento, capital: c.capital, interes: c.interes, cuota: c.importeCuota,
    cubierto: c.pagada ? c.importeCuota : 0, saldo: c.saldo
  }))
});

/** Actividad reciente: las altas de clientes y préstamos, de la más nueva a la más antigua. */
function actividad(data: CarteraApi): Actividad[] {
  const nombre = new Map(data.clientes.map((c) => [c.id, c.nombre]));
  const deClientes = data.clientes.map((c): Actividad => ({
    t: c.registrado, usuario: c.asesor, tipo: 'Cliente registrado', desc: c.nombre, ref: { entidad: 'cliente', id: c.id }
  }));
  const dePrestamos = data.prestamos.map((p): Actividad => ({
    t: p.registrado, usuario: p.asesor, tipo: 'Préstamo registrado', desc: `PR-${p.numero} · ${nombre.get(p.clienteId) ?? ''}`, ref: { entidad: 'prestamo', id: p.id }
  }));
  return [...deClientes, ...dePrestamos].sort((a, b) => b.t.localeCompare(a.t));
}

export const aCartera = (data: CarteraApi): Cartera => ({
  hoy: data.hoy,
  agencias: data.agencias,
  db: { v: 6, clientes: data.clientes.map(aCliente), prestamos: data.prestamos.map(aPrestamo), actividad: actividad(data) }
});

export async function obtenerCartera(): Promise<Cartera> {
  const r = await fetch('/api/dashboard', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(r.status === 401 ? 'Tu sesión ha expirado. Inicia sesión nuevamente.' : 'No se pudieron cargar los datos del dashboard.');
  return aCartera((await r.json()) as CarteraApi);
}
