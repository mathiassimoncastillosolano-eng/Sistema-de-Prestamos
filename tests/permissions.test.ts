import { describe, expect, it } from 'vitest';
import { esRolValido, moduloDeRuta, puedeAccederARuta, puedeAccederAModulo, type Modulo } from '@/lib/permissions';
import { gruposPara } from '@/components/layout/nav';

const MODULOS: Modulo[] = ['dashboard', 'clientes', 'solicitud', 'prestamos', 'cuotas'];

describe('permisos por rol', () => {
  it('asesor accede a los cinco módulos', () => {
    MODULOS.forEach((m) => expect(puedeAccederAModulo('asesor', m)).toBe(true));
  });
  it('gerencia solo accede al dashboard', () => {
    expect(puedeAccederAModulo('gerencia', 'dashboard')).toBe(true);
    (['clientes', 'solicitud', 'prestamos', 'cuotas'] as Modulo[]).forEach((m) => expect(puedeAccederAModulo('gerencia', m)).toBe(false));
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
    for (const ruta of ['/clientes', '/clientes/C001', '/solicitud', '/solicitud/C001', '/prestamos', '/prestamos/PR-1001', '/cuotas']) {
      expect(puedeAccederARuta('gerencia', ruta)).toBe(false);
      expect(puedeAccederARuta('asesor', ruta)).toBe(true);
    }
    expect(puedeAccederARuta('gerencia', '/')).toBe(true);
    expect(puedeAccederARuta('auditor', '/')).toBe(false);
  });
});

describe('menú lateral', () => {
  const etiquetas = (rol: string) => gruposPara((m) => puedeAccederAModulo(rol, m)).flatMap((g) => g.items.map((i) => i.label));
  it('asesor: Resumen, Clientes y Cartera completos', () => {
    expect(etiquetas('asesor')).toEqual(['Dashboard', 'Clientes', 'Nueva solicitud', 'Préstamos', 'Cuotas y cronogramas']);
  });
  it('gerencia: solo Dashboard y sin grupos vacíos', () => {
    expect(etiquetas('gerencia')).toEqual(['Dashboard']);
    expect(gruposPara((m) => puedeAccederAModulo('gerencia', m)).map((g) => g.titulo)).toEqual(['Resumen']);
  });
  it('rol desconocido: menú vacío', () => {
    expect(gruposPara((m) => puedeAccederAModulo('auditor', m))).toEqual([]);
  });
});
