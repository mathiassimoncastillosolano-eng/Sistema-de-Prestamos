/** Datos que devuelve GET /api/clientes para cada fila del listado. */
export interface ClienteListado {
  id: string;
  numero: number;
  tipoDocumento: 'DNI' | 'RUC 10' | 'RUC 20';
  numeroDocumento: string;
  nombre: string;
  telefono: string | null;
}

/** Datos completos que devuelve GET /api/clientes/{id}. */
export interface ClienteDetalle extends ClienteListado {
  dniTitular: string | null;
  domicilio: string | null;
  estadoSunat: string | null;
  condicionSunat: string | null;
  representanteNombre: string | null;
  representanteDni: string | null;
  agenciaId: string;
  creadoEn: string;
}

export async function listarClientes(): Promise<ClienteListado[]> {
  const respuesta = await fetch('/api/clientes', {
    credentials: 'same-origin',
    cache: 'no-store'
  });

  if (respuesta.status === 401) {
    throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }
  if (!respuesta.ok) {
    throw new Error('No se pudieron cargar los clientes.');
  }

  return respuesta.json() as Promise<ClienteListado[]>;
}

export async function consultarCliente(id: string): Promise<ClienteDetalle | null> {
  const respuesta = await fetch(`/api/clientes/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    cache: 'no-store'
  });

  if (respuesta.status === 404) return null;
  if (respuesta.status === 401) {
    throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }
  if (!respuesta.ok) {
    throw new Error('No se pudo consultar el cliente.');
  }

  return respuesta.json() as Promise<ClienteDetalle>;
}
