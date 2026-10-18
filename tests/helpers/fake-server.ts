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
    agenciaId: 'a1', creadoEn: '2026-10-17T10:00:00-05:00'
  };
  const clientes: Array<Record<string, unknown>> = [cliente];

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
    if (ruta.startsWith('/api/prestamos?clienteId=') && metodo === 'GET') {
      return sesionDe ? json(200, []) : json(401);
    }
    if (ruta.startsWith('/api/prestamos')) {
      if (!sesionDe) return json(401);
      if (ruta === '/api/prestamos/condiciones' && metodo === 'GET') return json(200, CONDICIONES);
      if (ruta === '/api/prestamos/simulacion' && metodo === 'POST') return json(200, armarSimulacion(cuerpo.capital, cuerpo.plazoMeses));
      if (ruta === '/api/prestamos' && metodo === 'GET') return json(200, LISTADO);
      if (ruta === '/api/prestamos' && metodo === 'POST') {
        if (desactualizado || cuerpo.totalContractualEsperado !== armarSimulacion(cuerpo.capital, cuerpo.plazoMeses).totalContractual) {
          return json(409, { codigo: 'CONDICIONES_DESACTUALIZADAS', mensaje: 'Las condiciones cambiaron desde la revisión.' });
        }
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
    capital: 1000, plazoMeses: 2, tea: 0.3, fechaDesembolso: '2026-08-10', registrado: '2026-08-10 10:00',
    cuotas: [
      { numero: 1, fechaVencimiento: '2026-09-10', capital: 495, interes: 22, importeCuota: 517, saldo: 505, pagada: false },
      { numero: 2, fechaVencimiento: '2026-10-10', capital: 505, interes: 11, importeCuota: 516, saldo: 0, pagada: false }
    ]
  }]
};

/* ---------- Préstamos (contrato de /api/prestamos). Cifras sencillas y coherentes; NO reproducen la fórmula del backend. ---------- */
export const CONDICIONES = {
  moneda: 'PEN', tea: 0.3, capitalMinimo: 1000, limiteEndeudamiento: 10000, plazoMinimoMeses: 1, plazoMaximoMeses: 60,
  zonaHoraria: 'America/Lima', fechaDesembolso: '2026-10-18', fechaPrimerVencimiento: '2026-11-18'
};

/** Cronograma de cuotas iguales: capital e interés repartidos a partes iguales (suficiente para probar la interfaz). */
export function armarSimulacion(capital: number, plazoMeses: number) {
  const interesTotal = Math.round(capital * 0.1 * 100) / 100;
  const cuotas = Array.from({ length: plazoMeses }, (_, i) => {
    const k = i + 1;
    const cap = Math.round((capital / plazoMeses) * 100) / 100;
    const int = Math.round((interesTotal / plazoMeses) * 100) / 100;
    const mes = ((9 + k) % 12) + 1;
    return { numero: k, fechaVencimiento: `2026-${String(mes).padStart(2, '0')}-18`, capital: cap, interes: int, importeCuota: Math.round((cap + int) * 100) / 100, saldo: Math.round((capital - cap * k) * 100) / 100 };
  });
  return {
    moneda: 'PEN', capital, plazoMeses, tea: 0.3, fechaDesembolso: '2026-10-18', fechaPrimerVencimiento: '2026-11-18',
    cuotaMensual: cuotas[0]?.importeCuota ?? 0, totalIntereses: interesTotal, totalContractual: Math.round((capital + interesTotal) * 100) / 100, cuotas
  };
}

const sim2 = armarSimulacion(1000, 2);
export const DETALLE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', numero: 1001, clienteId: '11111111-1111-4111-8111-111111111111',
  clienteNombre: 'Cliente de prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '99999991',
  agenciaNombre: 'Sur Prueba', asesorNombre: 'Valeria Quintana', moneda: 'PEN', capital: 1000, plazoMeses: 2, tea: 0.3,
  fechaDesembolso: '2026-08-18', fechaPrimerVencimiento: '2026-09-18', fechaUltimoVencimiento: '2026-10-18',
  estado: 'En mora', observaciones: null, cuotaMensual: sim2.cuotaMensual, totalIntereses: sim2.totalIntereses, totalContractual: sim2.totalContractual,
  capitalPendiente: 1000, totalPendiente: sim2.totalContractual, proximoVencimiento: '2026-10-18', cuotasVencidas: 1,
  cuotas: sim2.cuotas.map((c, i) => ({ ...c, estado: i === 0 ? 'VENCIDA' : 'PENDIENTE', importePendiente: c.importeCuota, diasAtraso: i === 0 ? 30 : 0 })),
  historial: [{ fechaHora: '2026-08-18 10:15', tipo: 'Alta de préstamo', descripcion: 'Préstamo registrado con su cronograma', usuario: 'Valeria Quintana' }]
};

export const LISTADO = [
  { id: DETALLE.id, numero: 1001, clienteId: DETALLE.clienteId, clienteNombre: 'Cliente de prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '99999991', agenciaNombre: 'Sur Prueba', asesorNombre: 'Valeria Quintana', propio: true, capital: 1000, plazoMeses: 2, fechaDesembolso: '2026-08-18', estado: 'En mora', totalContractual: sim2.totalContractual, capitalPendiente: 1000, totalPendiente: sim2.totalContractual, proximoVencimiento: '2026-10-18', cuotasVencidas: 1 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', numero: 1002, clienteId: 'c2', clienteNombre: 'Otra Persona Prueba', clienteTipoDocumento: 'DNI', clienteNumeroDocumento: '88888882', agenciaNombre: 'Sur Prueba', asesorNombre: 'Colega Prueba', propio: false, capital: 2000, plazoMeses: 4, fechaDesembolso: '2026-10-01', estado: 'Vigente', totalContractual: 2200, capitalPendiente: 2000, totalPendiente: 2200, proximoVencimiento: '2026-11-01', cuotasVencidas: 0 }
];
