/* =========================================================
   CONFIGURACIÓN CENTRAL — marca y parámetros financieros.
   Los parámetros de negocio se modifican aquí, nunca dentro de componentes.
   ========================================================= */

export const BRAND = {
  nombre: 'PerúCred',
  /** Descriptor institucional OFICIAL: es el que lleva impreso el logo. Mantenerlos idénticos. */
  descriptor: 'Tecnología para la Gestión Crediticia',
  lema: 'Gestión de préstamos con control total'
} as const;

/** Parámetros de negocio heredados del prototipo original (sin cambios). */
export const CFG = {
  moneda: 'PEN',
  /** Monto mínimo por préstamo. */
  minMonto: 1000,
  /** Capital pendiente máximo por cliente, a nivel de toda la empresa. */
  limite: 10000,
  /** Tasa efectiva anual inicial. */
  tea: 0.3,
  plazoMin: 1,
  plazoMax: 60,
  /** Fecha simulada del prototipo. */
  hoy: '2026-10-13',
  /** Ventana (días) para considerar una cuota "próxima a vencer". */
  diasProxVenc: 10,
  /** Porcentaje de uso del límite a partir del cual se avisa "cerca del límite". */
  alertaLimite: 0.8
} as const;

/**
 * DISCREPANCIA ABIERTA (decisión de negocio pendiente — NO corregida aquí):
 * el documento de requisitos original plantea un ejemplo de S/ 1,000 a 12 meses con total de S/ 1,300.
 * Con TEA 30 %, cuotas iguales y tasa mensual efectiva (1+TEA)^(1/12)−1, el cálculo da
 * un total de S/ 1,149.43 (cuota S/ 95.79). Se conserva el comportamiento del prototipo.
 * Para resolverlo, cambiar CFG.tea o el método de cálculo en lib/finance.ts tras decidirlo con negocio.
 * Hay una prueba (tests/finance.test.ts) que documenta ambos valores.
 */
export const EJEMPLO_DOCUMENTO_REQUISITOS = { monto: 1000, plazo: 12, totalEsperado: 1300 } as const;

export const AGENCIAS = ['Lima Centro', 'Arequipa', 'Cusco'] as const;

/** Claves técnicas de localStorage: NO se renombran con la marca (se perderían los datos y el tema guardados de cada usuario). */
export const STORAGE_KEYS = {
  db: 'nexora-db-v5',
  tema: 'nx-tema',
  side: 'nx-side'
} as const;
