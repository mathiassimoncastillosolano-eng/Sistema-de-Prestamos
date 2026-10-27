import { describe, expect, it } from 'vitest';
import { esRolValido, moduloDeRuta, puedeAccederARuta, puedeAccederAModulo, rutaInicio, type Modulo } from '@/lib/permissions';
import { gruposPara } from '@/components/layout/nav';

const MODULOS: Modulo[] = ['dashboard', 'clientes', 'solicitud', 'prestamos', 'caja', 'reposiciones', 'supervision'];

describe('permisos por rol', () => {
  it('asesor accede a clientes, solicitud, préstamos y su caja, pero no al dashboard ni a la gestión de gerencia', () => {
    (['clientes', 'solicitud', 'prestamos', 'caja'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('asesor', m)).toBe(true));
    (['dashboard', 'reposiciones', 'supervision'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('asesor', m)).toBe(false));
  });
  it('cada rol entra por su pantalla de inicio', () => {
    expect(rutaInicio('gerencia')).toBe('/');
    expect(rutaInicio('asesor')).toBe('/prestamos');
  });
  it('gerencia accede al dashboard, a la gestión de reposiciones y a la supervisión de cajas; no a la caja del asesor', () => {
    (['dashboard', 'reposiciones', 'supervision'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('gerencia', m)).toBe(true));
    (['clientes', 'solicitud', 'prestamos', 'caja'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('gerencia', m)).toBe(false));
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
    expect(moduloDeRuta('/caja')).toBe('caja');
    expect(moduloDeRuta('/caja/abc')).toBe('caja');
    expect(moduloDeRuta('/reposiciones/abc')).toBe('reposiciones');
    expect(moduloDeRuta('/supervision')).toBe('supervision');
    expect(moduloDeRuta('/nada')).toBeNull();
    expect(moduloDeRuta('/cuotas')).toBe('prestamos'); // enlace antiguo: se autoriza (y redirige) como Préstamos
    for (const ruta of ['/clientes', '/clientes/C001', '/solicitud', '/solicitud/C001', '/prestamos', '/prestamos/PR-1001', '/cuotas']) {
      expect(puedeAccederARuta('gerencia', ruta)).toBe(false);
      expect(puedeAccederARuta('asesor', ruta)).toBe(true);
    }
    for (const ruta of ['/caja', '/caja/abc']) {
      expect(puedeAccederARuta('asesor', ruta)).toBe(true);
      expect(puedeAccederARuta('gerencia', ruta)).toBe(false);
    }
    for (const ruta of ['/reposiciones', '/reposiciones/abc', '/supervision']) {
      expect(puedeAccederARuta('gerencia', ruta)).toBe(true);
      expect(puedeAccederARuta('asesor', ruta)).toBe(false);
    }
    expect(puedeAccederARuta('gerencia', '/')).toBe(true);
    expect(puedeAccederARuta('asesor', '/')).toBe(false);
    expect(puedeAccederARuta('auditor', '/')).toBe(false);
  });
});

describe('menú lateral', () => {
  const etiquetas = (rol: string) => gruposPara((m) => puedeAccederAModulo(rol, m)).flatMap((g) => g.items.map((i) => i.label));
  it('asesor: Cartera (Préstamos primero), su caja y Clientes, sin Dashboard', () => {
    expect(etiquetas('asesor')).toEqual(['Préstamos', 'Caja y reposiciones', 'Clientes', 'Nueva solicitud']);
  });
  it('gerencia: Dashboard y el grupo Caja (gestión y supervisión), sin grupos vacíos', () => {
    expect(etiquetas('gerencia')).toEqual(['Dashboard', 'Gestión de reposiciones', 'Supervisión de cajas']);
    expect(gruposPara((m) => puedeAccederAModulo('gerencia', m)).map((g) => g.titulo)).toEqual(['Resumen', 'Caja']);
  });
  it('rol desconocido: menú vacío', () => {
    expect(gruposPara((m) => puedeAccederAModulo('auditor', m))).toEqual([]);
  });
});
