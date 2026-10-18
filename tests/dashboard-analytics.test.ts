/* Pruebas del dashboard: alcances por rol, filtro por agencia y estado, morosos y extrajudiciales. */
import { describe, expect, it } from 'vitest';
import { alcancesPara, calcularDashboard, resumenPorAgencia } from '@/lib/analytics';
import { AGENCIAS, CFG } from '@/lib/config';
import { addDays } from '@/lib/dates';
import { construirSemilla } from '@/mocks/seed';
import { aCartera, type CarteraApi } from '@/services/dashboard-api';
import { CARTERA } from './helpers/fake-server';

const yo = { nombre: 'Asesor de prueba', agencia: 'Lima Centro' };

describe('alcances por rol', () => {
  it('la gerencia puede elegir toda la empresa o cualquier agencia', () => {
    const valores = alcancesPara('gerencia', null).map((a) => a.value);
    expect(valores).toEqual(['empresa', ...AGENCIAS.map((a) => `agencia:${a}`)]);
  });
  it('el asesor ve su cartera, su agencia y la empresa', () => {
    expect(alcancesPara('asesor', 'Cusco').map((a) => a.value)).toEqual(['mis', 'agencia:Cusco', 'empresa']);
  });
});

describe('datos reales de la API', () => {
  it('convierte la cartera y usa la fecha real para los morosos', () => {
    const { db, hoy, agencias } = aCartera(CARTERA as CarteraApi);
    const d = calcularDashboard(db, { alcance: 'empresa', meses: 6, yo, hoy });
    expect(db.prestamos[0].codigo).toBe('PR-1001');
    expect(d.morosos.map((m) => [m.cliente?.nombre, m.diasAtraso])).toEqual([['Rosa Moroso Prueba', 38]]);
    expect(resumenPorAgencia(db, { yo, hoy }, agencias).map((f) => [f.agencia, f.morosos])).toEqual([['Agencia Norte Prueba', 0], ['Agencia Sur Prueba', 1]]);
    expect(db.actividad[0].tipo).toBe('Préstamo registrado');
  });

  it('las agencias de la base no repiten la palabra "Agencia"', () => {
    expect(alcancesPara('gerencia', null, ['Agencia Trujillo']).map((a) => a.label)).toEqual(['Toda la empresa', 'Agencia Trujillo']);
  });
});

describe('calcularDashboard', () => {
  const db = construirSemilla();

  it('el filtro por agencia solo cuenta préstamos de esa agencia', () => {
    const empresa = calcularDashboard(db, { alcance: 'empresa', meses: 6, yo });
    const suma = AGENCIAS.reduce((a, ag) => a + calcularDashboard(db, { alcance: `agencia:${ag}`, meses: 6, yo }).prestamosTotales, 0);
    expect(suma).toBe(empresa.prestamosTotales);
  });

  it('el filtro por estado solo deja préstamos en ese estado', () => {
    const d = calcularDashboard(db, { alcance: 'empresa', meses: 6, yo, estado: 'En mora' });
    expect(d.estados.filter((e) => e.estado !== 'En mora').every((e) => e.cantidad === 0)).toBe(true);
    expect(d.prestamosTotales).toBeGreaterThan(0);
  });

  it('un cliente con cuota vencida es moroso y aparece una sola vez', () => {
    const d = calcularDashboard(db, { alcance: 'empresa', meses: 6, yo });
    const ids = d.morosos.map((m) => m.clienteId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('con un año o más de atraso el cliente pasa a extrajudicial', () => {
    const copia = construirSemilla();
    const p = copia.prestamos.find((x) => !x.etapa && x.cronograma.some((c) => c.cubierto === 0)) as (typeof copia.prestamos)[number];
    const cuota = p.cronograma.find((c) => c.cubierto === 0) as (typeof p.cronograma)[number];
    cuota.fecha = addDays(CFG.hoy, -CFG.diasExtrajudicial);
    const d = calcularDashboard(copia, { alcance: 'empresa', meses: 6, yo });
    expect(d.extrajudiciales.map((m) => m.clienteId)).toContain(p.clienteId);
  });

  it('el resumen por agencia tiene una fila por agencia', () => {
    expect(resumenPorAgencia(db, { yo }).map((f) => f.agencia)).toEqual(AGENCIAS.map((a) => `Agencia ${a}`));
  });
});
