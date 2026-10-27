/* Servidor FALSO a nivel de fetch: imita el contrato de /api/auth (login, me, logout) y la comprobación CSRF.
   Sirve para probar el frontend; NO prueba el backend ni la base de datos reales. */
import { vi } from 'vitest';
import type { Agencia, Perfil } from '@/types/auth';

export interface CuentaFalsa {
  correo: string;
  clave: string;
  perfil: Perfil;
  agencia: Agencia | null;
  /** Error que el servidor devuelve DESPUÉS de acertar la contraseña (cuenta desactivada, etc.). */
  bloqueo?: { status: number; codigo: string };
}

const json = (status: number, cuerpo?: unknown) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

import { armarContrato } from './contrato';
export const CSRF = 'token-csrf-de-prueba';

export function crearServidor(cuentas: CuentaFalsa[]) {
  document.cookie = `XSRF-TOKEN=${CSRF}; path=/`;
  let sesionDe: CuentaFalsa | null = null;
  let retenerMe: Promise<void> | null = null;
  let logoutFalla = false;
  let desactualizado = false;
  const llamadas: { ruta: string; metodo: string; cuerpo?: unknown }[] = [];
  const cliente = {
    id: '11111111-1111-4111-8111-111111111111', numero: 1,
    tipoDocumento: 'DNI', numeroDocumento: '99999991',
    nombre: 'Cliente de prueba', telefono: '999999999', correo: 'cliente@example.com',
    dniTitular: null, domicilio: null, estadoSunat: null, condicionSunat: null,
    representanteNombre: null, representanteDni: null,
    agenciaId: 'a1', creadoEn: '2026-10-17T10:00:00-05:00', estado: 'ACTIVO'
  };
  const clientes: Array<Record<string, unknown>> = [cliente];
  /** Capacidad por cliente (GET /api/prestamos/capacidad). Sin entrada: cliente sin deuda. */
  const capacidades = new Map<string, typeof SIN_DEUDA | 'error'>();
  let retenerCapacidad: Promise<void> | null = null;
  const perfiles = new Map<string, Record<string, unknown> | 'error'>();
  let contratoFalla = false;
  /** Capital que el asesor ya colocó hoy (GET /api/prestamos/limite-diario). Cada registro aceptado lo aumenta. */
  // Caja del asesor (como el backend: arranca con S/ 50,000; cada desembolso la baja; nunca queda negativa).
  let saldoCaja = 50000;
  let cajaEstado: 'ABIERTA' | 'CERRADA' = 'ABIERTA';
  const cajaResumen = () => ({
    cajaId: 'caja-1', asesorId: 'p1', asesor: 'Valeria Quintana', agenciaId: 'a1', agencia: 'Sur Prueba', estado: cajaEstado,
    limite: 50000, saldo: saldoCaja, saldoInicial: 50000,
    capacidadHastaLimite: Math.round((50000 - saldoCaja) * 100) / 100, autorizadoPendienteRecepcion: 0,
    capacidadLibre: Math.round((50000 - saldoCaja) * 100) / 100, saldoProyectado: saldoCaja,
    reposicionAbierta: null, ultimaRecepcion: null, incidenciasAbiertas: 0, abiertaEn: '2026-10-01T15:00:00Z', ahora: '2026-10-18T15:00:00Z'
  });

  const handler = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const ruta = String(entrada);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ ruta, metodo, cuerpo });

    const cabeceras = new Headers(init?.headers);
    // Como el backend real: la cookie XSRF-TOKEN se emite en cualquier respuesta (también en las 401) si el navegador no la trae.
    if (!document.cookie.includes('XSRF-TOKEN=')) document.cookie = `XSRF-TOKEN=${CSRF}; path=/`;
    // Sin CSRF correcto el servidor rechaza. En producción el 403 de Spring pasa por /error, que está denegado a anónimos,
    // y llega al navegador como 401 (sin cuerpo JSON).
    if (metodo !== 'GET' && cabeceras.get('X-XSRF-TOKEN') !== CSRF) return json(401);

    if (ruta === '/api/auth/me') {
      if (retenerMe) await retenerMe;
      return sesionDe ? json(200, { perfil: sesionDe.perfil, agencia: sesionDe.agencia }) : json(401);
    }
    if (ruta === '/api/auth/login') {
      const c = cuentas.find((x) => x.correo === String(cuerpo?.correo).trim().toLowerCase() && x.clave === cuerpo?.clave);
      if (!c) return json(401, { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'x' });
      if (c.bloqueo) return json(c.bloqueo.status, { codigo: c.bloqueo.codigo, mensaje: 'x' });
      sesionDe = c;
      return json(200, { perfil: c.perfil, agencia: c.agencia });
    }
    if (ruta === '/api/auth/logout') {
      if (logoutFalla) return json(500);
      sesionDe = null;
      document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; // CsrfLogoutHandler borra la cookie
      return json(204);
    }
    if (ruta.startsWith('/api/clientes/consulta?') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      const parametros = new URL(ruta, 'http://localhost').searchParams;
      return json(200, {
        tipoDocumento: parametros.get('tipo'), numeroDocumento: parametros.get('numero'),
        nombre: 'Ana Salazar Quispe', dniTitular: null, domicilio: null,
        estadoSunat: null, condicionSunat: null, representanteNombre: null,
        representanteDni: null, habilitado: true, motivo: null
      });
    }
    if (ruta === '/api/clientes' && metodo === 'POST') {
      if (!sesionDe) return json(401);
      const nuevo = {
        ...cliente, id: '22222222-2222-4222-8222-222222222222', numero: 2,
        tipoDocumento: cuerpo.tipoDocumento, numeroDocumento: cuerpo.numeroDocumento,
        nombre: 'Ana Salazar Quispe', telefono: cuerpo.telefono, correo: cuerpo.correo
      };
      clientes.push(nuevo);
      return json(201, nuevo);
    }
    if (ruta === '/api/clientes' && metodo === 'GET') {
      return sesionDe ? json(200, clientes) : json(401);
    }
    if (ruta.startsWith('/api/clientes/') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      const encontrado = clientes.find((c) => c.id === ruta.slice('/api/clientes/'.length));
      return encontrado ? json(200, encontrado) : json(404);
    }
    if (ruta === '/api/dashboard' && metodo === 'GET') {
      return sesionDe ? json(200, CARTERA) : json(401);
    }
    if (ruta.startsWith('/api/prestamos/capacidad?clienteId=') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      if (retenerCapacidad) await retenerCapacidad;
      const c = capacidades.get(new URL(ruta, 'http://localhost').searchParams.get('clienteId') ?? '') ?? SIN_DEUDA;
      return c === 'error' ? json(500) : json(200, c);
    }
    if (ruta.startsWith('/api/prestamos/perfil-financiero?clienteId=') && metodo === 'GET') {
      if (!sesionDe) return json(401);
      const id = new URL(ruta, 'http://localhost').searchParams.get('clienteId') ?? '';
      const fijado = perfiles.get(id);
      if (fijado === 'error') return json(500);
      if (fijado) return json(200, fijado);
      const c = capacidades.get(id) ?? SIN_DEUDA;
      if (c === 'error') return json(500);
      const propio = clientes.find((x) => x.id === id);
      if (!propio) return json(404, { codigo: 'CLIENTE_NO_ENCONTRADO', mensaje: 'x' });
      return json(200, {
        clienteId: id, tipoDocumento: propio.tipoDocumento, numeroDocumento: propio.numeroDocumento, nombre: propio.nombre,
        limite: c.limite, capitalPendiente: c.capitalPendiente, importePendiente: c.importePendiente, disponible: c.disponible,
        deudaPropia: c.capitalPendiente, deudaVinculada: 0, consolidada: false, cuotasPendientes: 0, cuotasVencidas: 0, cuotasPagadas: 0,
        integrantes: [{ clienteId: id, nombre: propio.nombre, tipoDocumento: propio.tipoDocumento, numeroDocumento: propio.numeroDocumento, relacion: 'TITULAR', consultado: true, detalleVisible: true, capitalPendiente: c.capitalPendiente, importePendiente: c.importePendiente, prestamosConSaldo: 0, cuotasPendientes: 0, cuotasVencidas: 0, cuotasPagadas: 0 }],
        prestamos: []
      });
    }
    if (ruta === '/api/caja' && metodo === 'GET') return sesionDe ? json(200, cajaResumen()) : json(401);
    if (ruta === '/api/caja/pendientes' && metodo === 'GET') {
      return sesionDe ? json(200, { solicitudesPorRevisar: 0, recepcionesPorRegistrar: 0, observadas: 0, porConciliar: 0, incidenciasAbiertas: 0, enTransito: 0, ahora: '2026-10-18T15:00:00Z' }) : json(401);
    }
    if (ruta.startsWith('/api/prestamos?clienteId=') && metodo === 'GET') {
      return sesionDe ? json(200, []) : json(401);
    }
    if (ruta.startsWith('/api/prestamos')) {
      if (!sesionDe) return json(401);
      if (ruta === '/api/prestamos/condiciones' && metodo === 'GET') return json(200, CONDICIONES);
      if (ruta === '/api/prestamos/contrato-preliminar' && metodo === 'POST') {
        if (contratoFalla) return json(500);
        if (desactualizado || cuerpo.totalContractualEsperado !== armarSimulacion(cuerpo.capital, cuerpo.plazoMeses).totalContractual) {
          return json(409, { codigo: 'CONDICIONES_DESACTUALIZADAS', mensaje: 'Las condiciones cambiaron desde la revisión.' });
        }
        return json(200, armarContrato('BORRADOR', cuerpo.capital, cuerpo.plazoMeses));
      }
      if (/^\/api\/prestamos\/[^/?]+\/contrato$/.test(ruta) && metodo === 'GET') {
        const idc = ruta.split('/')[3];
        if (idc === DETALLE.id) return json(200, armarContrato('DEFINITIVO', DETALLE.capital, DETALLE.plazoMeses));
        return json(404, { codigo: 'CONTRATO_NO_DISPONIBLE', mensaje: 'Este préstamo no tiene contrato guardado: se registró antes de que existiera esta función.' });
      }
      if (ruta === '/api/prestamos/simulacion' && metodo === 'POST') return json(200, armarSimulacion(cuerpo.capital, cuerpo.plazoMeses));
      if (ruta === '/api/prestamos' && metodo === 'GET') return json(200, LISTADO);
      if (ruta === '/api/prestamos' && metodo === 'POST') {
        // Como el backend real: un cliente MOROSO o EXTRAJUDICIAL no recibe préstamos nuevos.
        const solicitante = clientes.find((c) => c.id === cuerpo.clienteId);
        if (solicitante && solicitante.estado !== 'ACTIVO') {
          return json(422, { codigo: 'CLIENTE_NO_APTO', mensaje: `El cliente está en estado ${String(solicitante.estado)}.`, detalle: { estado: solicitante.estado } });
        }
        if (desactualizado || cuerpo.totalContractualEsperado !== armarSimulacion(cuerpo.capital, cuerpo.plazoMeses).totalContractual) {
          return json(409, { codigo: 'CONDICIONES_DESACTUALIZADAS', mensaje: 'Las condiciones cambiaron desde la revisión.' });
        }
        // Como el backend real: el desembolso sale del efectivo de la caja y no puede dejarla en negativo.
        if (cajaEstado !== 'ABIERTA') return json(409, { codigo: 'CAJA_CERRADA', mensaje: 'Tu caja está cerrada.' });
        if (cuerpo.capital > saldoCaja) {
          return json(422, { codigo: 'SALDO_CAJA_INSUFICIENTE', mensaje: 'El préstamo no se registró: tu caja no tiene efectivo suficiente.',
            detalle: { saldo: saldoCaja, solicitado: cuerpo.capital, falta: Math.round((cuerpo.capital - saldoCaja) * 100) / 100 } });
        }
        saldoCaja = Math.round((saldoCaja - cuerpo.capital) * 100) / 100;
        return json(201, { ...DETALLE, capital: cuerpo.capital, plazoMeses: cuerpo.plazoMeses });
      }
      const id = ruta.slice('/api/prestamos/'.length);
      if (metodo === 'GET') return id === DETALLE.id ? json(200, DETALLE) : json(404, { codigo: 'PRESTAMO_NO_ENCONTRADO', mensaje: 'x' });
    }
    return json(404);
  });

  return {
    handler,
    llamadas,
    instalar: () => vi.stubGlobal('fetch', handler),
    agregarCliente: (datos: Record<string, unknown>) => clientes.push({ ...cliente, ...datos }),
    /** Simula una sesión ya abierta (p. ej. el usuario recarga la página). */
    abrirSesion: (c: CuentaFalsa) => { sesionDe = c; },
    expirarSesion: () => { sesionDe = null; },
    fallarLogout: (v: boolean) => { logoutFalla = v; },
    /** El próximo registro responde 409 CONDICIONES_DESACTUALIZADAS (como si hubiera cambiado el día). */
    desactualizarCondiciones: (v: boolean) => { desactualizado = v; },
    /** Fija lo que debe un cliente; `'error'` hace fallar la consulta de su capacidad. */
    fijarCapacidad: (clienteId: string, capitalPendiente: number | 'error', importePendiente = capitalPendiente) => {
      capacidades.set(clienteId, capitalPendiente === 'error' ? 'error' : {
        limite: 10000, capitalPendiente, importePendiente: Number(importePendiente),
        disponible: Math.max(0, Math.round((10000 - capitalPendiente) * 100) / 100)
      });
    },
    /** Perfil financiero consolidado a medida para un cliente (o 'error'). */
    fijarPerfil: (clienteId: string, perfil: Record<string, unknown> | 'error') => { perfiles.set(clienteId, perfil); },
    /** El borrador del contrato responde 500 (para probar el reintento y el bloqueo del registro). */
    fallarContrato: (v: boolean) => { contratoFalla = v; },
    /** Fija el efectivo que tiene la caja del asesor (0–50,000). */
    fijarSaldoCaja: (monto: number) => { saldoCaja = monto; },
    /** Abre o cierra la caja del asesor. */
    fijarEstadoCaja: (estado: 'ABIERTA' | 'CERRADA') => { cajaEstado = estado; },
    /** Efectivo actual de la caja (para comprobar que un registro la descontó). */
    saldoCajaActual: () => saldoCaja,
    /** Deja la consulta de capacidad esperando hasta llamar a la función devuelta. */
    retenerCapacidad: () => { let soltar!: () => void; retenerCapacidad = new Promise<void>((r) => { soltar = r; }); return () => { retenerCapacidad = null; soltar(); }; },
    retenerMe: () => { let soltar!: () => void; retenerMe = new Promise<void>((r) => { soltar = r; }); return () => { retenerMe = null; soltar(); }; }
  };
}

const ubicacion = { departamento: 'Departamento Prueba', provincia: 'Provincia Prueba', distrito: 'Distrito Prueba', direccion: 'Av. Ficticia 123' };
export const AGENCIA_PRUEBA: Agencia = { id: 'a1', nombre: 'Sur Prueba', activa: true, ubicacion };

export const ASESORA: CuentaFalsa = {
  correo: 'valeria@ejemplo.com', clave: 'clave-de-prueba',
  perfil: { id: 'p1', nombres: 'Valeria', apellidos: 'Quintana', correo: 'valeria@ejemplo.com', rol: 'asesor', agenciaId: 'a1', activo: true },
  agencia: AGENCIA_PRUEBA
};
export const GERENTE: CuentaFalsa = {
  correo: 'gerente@ejemplo.com', clave: 'clave-de-prueba',
  perfil: { id: 'p2', nombres: 'Mateo', apellidos: 'Rivas', correo: 'gerente@ejemplo.com', rol: 'gerencia', agenciaId: null, activo: true },
  agencia: null
};

/** Cartera de GET /api/dashboard: un cliente moroso en Sur Prueba (cuota vencida el 10-sep). */
export const CARTERA = {
  hoy: '2026-10-18',
  agencias: ['Agencia Norte Prueba', 'Agencia Sur Prueba'],
  clientes: [{ id: 'c1', nombre: 'Rosa Moroso Prueba', tipoDocumento: 'DNI', numeroDocumento: '99999992', telefono: null, agencia: 'Agencia Sur Prueba', asesor: 'Valeria Quintana', alta: '2026-08-01', registrado: '2026-08-01 09:00' }],
  prestamos: [{
    id: 'p-1', numero: 1001, clienteId: 'c1', agencia: 'Agencia Sur Prueba', asesor: 'Valeria Quintana',
    capital: 1000, plazoMeses: 2, tea: 0.3, fechaDesembolso: '2026-08-12', registrado: '2026-08-12 10:00',
    cuotas: [
      { numero: 1, fechaVencimiento: '2026-09-10', capital: 495, interes: 22, importeCuota: 517, saldo: 505, pagada: false },
      { numero: 2, fechaVencimiento: '2026-10-10', capital: 505, interes: 11, importeCuota: 516, saldo: 0, pagada: false }
    ]
  }]
};

const SIN_DEUDA = { limite: 10000, capitalPendiente: 0, importePendiente: 0, disponible: 10000 };

/* ---------- Préstamos (contrato de /api/prestamos). Importes sencillos; NO reproducen la fórmula del backend. ---------- */

/** Misma regla de fechas que el backend: el desembolso es el día 1; la cuota k vence en desembolso + 30·k − 1 días. */
export function vencimiento(desembolso: string, k: number) {
  const d = new Date(`${desembolso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30 * k - 1);
  return d.toISOString().slice(0, 10);
}

const HOY_PRUEBA = '2026-10-18';

export const CONDICIONES = {
  moneda: 'PEN', tea: 0.3, capitalMinimo: 1000, limiteEndeudamiento: 10000, plazoMinimoMeses: 1, plazoMaximoMeses: 60,
  zonaHoraria: 'America/Lima', fechaDesembolso: HOY_PRUEBA, fechaPrimerVencimiento: vencimiento(HOY_PRUEBA, 1)
};

/** Cronograma de cuotas iguales: capital e interés repartidos a partes iguales (suficiente para probar la interfaz). */
export function armarSimulacion(capital: number, plazoMeses: number, desembolso: string = HOY_PRUEBA) {
  const interesTotal = Math.round(capital * 0.1 * 100) / 100;
  const cuotas = Array.from({ length: plazoMeses }, (_, i) => {
    const k = i + 1;
    const cap = Math.round((capital / plazoMeses) * 100) / 100;
    const int = Math.round((interesTotal / plazoMeses) * 100) / 100;
    return { numero: k, fechaVencimiento: vencimiento(desembolso, k), capital: cap, interes: int, importeCuota: Math.round((cap + int) * 100) / 100, saldo: Math.round((capital - cap * k) * 100) / 100 };
  });
  return {
    moneda: 'PEN', capital, plazoMeses, tea: 0.3, fechaDesembolso: desembolso, fechaPrimerVencimiento: vencimiento(desembolso, 1),
    cuotaMensual: cuotas[0]?.importeCuota ?? 0, totalIntereses: interesTotal, totalContractual: Math.round((capital + interesTotal) * 100) / 100, cuotas
  };
}

const sim2 = armarSimulacion(1000, 2, '2026-08-20'); // cuotas: 18-sep (vencida) y 18-oct (hoy)
export const DETALLE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', numero: 1001, clienteId: '11111111-1111-4111-8111-111111111111',
  clienteNombre: 'Cliente de prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '99999991', clienteCodigo: 1, clienteTelefono: '999999999',
  agenciaNombre: 'Sur Prueba', asesorNombre: 'Valeria Quintana', moneda: 'PEN', capital: 1000, plazoMeses: 2, tea: 0.3,
  fechaDesembolso: '2026-08-20', fechaPrimerVencimiento: '2026-09-18', fechaUltimoVencimiento: '2026-10-18',
  estado: 'En mora', observaciones: null, cuotaMensual: sim2.cuotaMensual, totalIntereses: sim2.totalIntereses, totalContractual: sim2.totalContractual,
  capitalPendiente: 1000, totalPendiente: sim2.totalContractual, proximoVencimiento: '2026-10-18', cuotasVencidas: 1,
  cuotas: sim2.cuotas.map((c, i) => ({ ...c, estado: i === 0 ? 'VENCIDA' : 'PENDIENTE', importePendiente: c.importeCuota, diasAtraso: i === 0 ? 30 : 0 })),
  historial: [{ fechaHora: '2026-08-20 10:15', tipo: 'Alta de préstamo', descripcion: 'Préstamo registrado con su cronograma', usuario: 'Valeria Quintana' }]
};

export const LISTADO = [
  { id: DETALLE.id, numero: 1001, clienteId: DETALLE.clienteId, clienteNombre: 'Cliente de prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '99999991', agenciaNombre: 'Sur Prueba', asesorNombre: 'Valeria Quintana', propio: true, capital: 1000, plazoMeses: 2, fechaDesembolso: '2026-08-20', estado: 'En mora', totalContractual: sim2.totalContractual, capitalPendiente: 1000, totalPendiente: sim2.totalContractual, proximoVencimiento: '2026-10-18', cuotasVencidas: 1 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', numero: 1002, clienteId: 'c2', clienteNombre: 'Otra Persona Prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '88888882', agenciaNombre: 'Sur Prueba', asesorNombre: 'Colega Prueba', propio: false, capital: 2000, plazoMeses: 4, fechaDesembolso: '2026-10-01', estado: 'Vigente', totalContractual: 2200, capitalPendiente: 2000, totalPendiente: 2200, proximoVencimiento: '2026-10-30', cuotasVencidas: 0 }
];
