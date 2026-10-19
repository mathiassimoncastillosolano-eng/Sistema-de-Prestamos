import { describe, expect, it } from 'vitest';
import { esRolValido, moduloDeRuta, puedeAccederARuta, puedeAccederAModulo, rutaInicio, type Modulo } from '@/lib/permissions';
import { gruposPara } from '@/components/layout/nav';

const MODULOS: Modulo[] = ['dashboard', 'clientes', 'solicitud', 'prestamos'];

describe('permisos por rol', () => {
  it('asesor accede a clientes, solicitud y préstamos, pero no al dashboard', () => {
    (['clientes', 'solicitud', 'prestamos'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('asesor', m)).toBe(true));
    expect(puedeAccederAModulo('asesor', 'dashboard')).toBe(false);
  });
  it('cada rol entra por su pantalla de inicio', () => {
    expect(rutaInicio('gerencia')).toBe('/');
    expect(rutaInicio('asesor')).toBe('/clientes');
  });
  it('gerencia solo accede al dashboard', () => {
    expect(puedeAccederAModulo('gerencia', 'dashboard')).toBe(true);
    (['clientes', 'solicitud', 'prestamos'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('gerencia', m)).toBe(false));
  });
  it('un rol desconocido, vacío o con otra capitalización no recibe ningún permiso', () => {
    for (const rol of ['auditor', '', 'ASESOR', 'Gerencia', ' asesor', null, undefined, 7]) {
      expect(esRolValido(rol)).toBe(false);
      MODULOS.forEach((m) => expect(puedeAccederAModulo(rol, m)).toBe(false));
    }
  });
  it('autoriza por URL, incluidas las rutas de detalle', () => {
    expect(moduloDeRuta('/')).toBe('dashboard');
    expect(moduloDeRuta('/clientes/C001')).toBe('clientes');
    expect(moduloDeRuta('/prestamos/PR-1001')).toBe('prestamos');
    expect(moduloDeRuta('/solicitud/C001')).toBe('solicitud');
    expect(moduloDeRuta('/nada')).toBeNull();
    expect(moduloDeRuta('/cuotas')).toBe('prestamos'); // enlace antiguo: se autoriza (y redirige) como Préstamos
    for (const ruta of ['/clientes', '/clientes/C001', '/solicitud', '/solicitud/C001', '/prestamos', '/prestamos/PR-1001', '/cuotas']) {
      expect(puedeAccederARuta('gerencia', ruta)).toBe(false);
      expect(puedeAccederARuta('asesor', ruta)).toBe(true);
    }
    expect(puedeAccederARuta('gerencia', '/')).toBe(true);
    expect(puedeAccederARuta('asesor', '/')).toBe(false);
    expect(puedeAccederARuta('auditor', '/')).toBe(false);
  });
});

describe('menú lateral', () => {
  const etiquetas = (rol: string) => gruposPara((m) => puedeAccederAModulo(rol, m)).flatMap((g) => g.items.map((i) => i.label));
  it('asesor: Clientes y Cartera, sin Dashboard', () => {
    expect(etiquetas('asesor')).toEqual(['Clientes', 'Nueva solicitud', 'Préstamos']);
  });
  it('gerencia: solo Dashboard y sin grupos vacíos', () => {
    expect(etiquetas('gerencia')).toEqual(['Dashboard']);
    expect(gruposPara((m) => puedeAccederAModulo('gerencia', m)).map((g) => g.titulo)).toEqual(['Resumen']);
  });
  it('rol desconocido: menú vacío', () => {
    expect(gruposPara((m) => puedeAccederAModulo('auditor', m))).toEqual([]);
  });
});
