/** Tipos de identidad. Reflejan los valores persistidos en `public.perfiles`, `public.agencias` y `public.ubicaciones`. */

/** Valores EXACTOS del CHECK `perfiles_rol_ck`. No se traducen ni se renombran. */
export type Rol = 'asesor' | 'gerencia';

export interface Ubicacion {
  departamento: string;
  provincia: string;
  distrito: string;
  /** La columna es nullable en la base de datos. */
  direccion: string | null;
}

export interface Agencia {
  id: string;
  nombre: string;
  activa: boolean;
  ubicacion: Ubicacion;
}

export interface Perfil {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  /** Llega como cadena del servidor: puede ser un valor no reconocido, por eso no es `Rol`. */
  rol: string;
  agenciaId: string | null;
  activo: boolean;
}

/** Respuesta de `GET /api/auth/me` y `POST /api/auth/login`. */
export interface Sesion {
  perfil: Perfil;
  agencia: Agencia | null;
}

/**
 * Identidad con la que se «firman» los registros FICTICIOS que se crean en el navegador
 * (asesor y agencia de un cliente o préstamo nuevo). Procede siempre de la sesión real.
 */
export interface IdentidadOperativa {
  nombre: string;
  agencia: string;
}
