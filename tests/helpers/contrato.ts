import type { ContratoApi } from '@/services/prestamos-api';
import { armarSimulacion } from './fake-server';

const NO_DEFINIDO = [
  'RUC del prestamista: no está configurado en el sistema.',
  'Domicilio del prestamista: no está configurado en el sistema.',
  'Representante del prestamista: no está configurado en el sistema.',
  'Intereses moratorios, penalidades y comisiones: no existe una política aprobada en el sistema.',
  'Pagos anticipados y cancelación anticipada: no están definidos en el sistema.',
  'Garantías, fiadores y avales: el sistema no los registra.',
  'Causales de resolución, ley aplicable y jurisdicción: no hay texto contractual aprobado.'
];

/** Contrato tal como lo entrega el servidor (la instantánea JSON va como texto en `datos`). */
export function armarContrato(estado: 'BORRADOR' | 'DEFINITIVO', capital = 1000, plazo = 12, extra: Record<string, unknown> = {}): ContratoApi {
  const s = armarSimulacion(capital, plazo);
  const datos = {
    plantillaVersion: 'CONTRATO-MUTUO-1.0', estado, codigo: estado === 'DEFINITIVO' ? 'PR-1001' : null, numero: estado === 'DEFINITIVO' ? 1001 : null,
    generadoEn: '2026-10-18T15:42:05-05:00', lugarCelebracion: 'Castilla, Piura, Piura', fechaCelebracion: s.fechaDesembolso,
    agencia: 'Sur Prueba', asesor: 'Asesora de prueba',
    prestamista: { denominacion: 'Préstamos Castillo', ruc: null, domicilio: null, representante: null },
    prestatario: { nombre: 'Cliente de prueba', tipoDocumento: 'DNI', numeroDocumento: '99999991', telefono: '999999999', correo: null, dniTitular: null, domicilio: null, representanteNombre: null, representanteDni: null },
    condiciones: {
      moneda: 'PEN', capital, plazoMeses: plazo, tea: 0.3, modalidadTasa: 'Tasa efectiva anual (TEA) fija.', frecuenciaPago: 'Mensual: una cuota cada 30 días.',
      fechaDesembolso: s.fechaDesembolso, fechaPrimerVencimiento: s.fechaPrimerVencimiento, fechaUltimoVencimiento: s.cuotas[s.cuotas.length - 1].fechaVencimiento,
      cuotaMensual: s.cuotaMensual, totalIntereses: s.totalIntereses, totalContractual: s.totalContractual, observaciones: null
    },
    cronograma: s.cuotas, noDefinido: NO_DEFINIDO, ...extra
  };
  return {
    estado, codigo: datos.codigo, version: 1, totalVersiones: 1, plantillaVersion: 'CONTRATO-MUTUO-1.0',
    generadoEn: '2026-10-18 15:42', huella: 'a'.repeat(64), datos: JSON.stringify(datos)
  };
}
