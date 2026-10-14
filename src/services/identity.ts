/* =========================================================
   CONSULTAS DE IDENTIDAD — TOTALMENTE SIMULADAS.
   No hay conexión con RENIEC, SUNAT ni ningún servicio real. Datos ficticios locales.
   ========================================================= */
import { delay } from '@/lib/utils';

export const DNI_MOCK: Record<string, string> = {
  '45871236': 'Rosa Elena Quispe Huamán',
  '70123456': 'Luis Alberto Cárdenas Rojas',
  '41256378': 'Julio César Medina Rojas',
  '72834519': 'Valeria Montoya Prado'
};

export interface RucEmpresaMock { razon: string; rep: string; repDni: string; domicilio: string }
export interface RucPersonaMock { titular: string; dni: string; negocio: string }

export const RUC_MOCK: Record<string, RucEmpresaMock | RucPersonaMock> = {
  '20601234567': { razon: 'Agroexport Pampas SAC', rep: 'Julio César Medina Rojas', repDni: '41256378', domicilio: 'Jr. Lampa 845, Lima' },
  '10732145698': { titular: 'Valeria Montoya Prado', dni: '72834519', negocio: 'Servicios de diseño gráfico' }
};

export const EJEMPLOS_CONSULTA = { DNI: '45871236 o 70123456', 'RUC 10': '10732145698', 'RUC 20': '20601234567' } as const;

export async function consultarDni(dni: string): Promise<string | null> {
  await delay(700);
  return DNI_MOCK[dni] ?? null;
}

export async function consultarRuc(ruc: string): Promise<RucEmpresaMock | RucPersonaMock | null> {
  await delay(700);
  return RUC_MOCK[ruc] ?? null;
}

export const esEmpresaMock = (r: RucEmpresaMock | RucPersonaMock): r is RucEmpresaMock => 'razon' in r;
