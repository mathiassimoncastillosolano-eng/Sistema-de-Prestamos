import { describe, expect, it } from 'vitest';
import { enteroEnLetras, montoEnLetras } from '@/lib/numero-letras';

describe('monto en letras', () => {
  it.each([
    [0, 'CERO'], [1, 'UNO'], [16, 'DIECISÉIS'], [21, 'VEINTIUNO'], [30, 'TREINTA'], [31, 'TREINTA Y UNO'], [100, 'CIEN'],
    [101, 'CIENTO UNO'], [555, 'QUINIENTOS CINCUENTA Y CINCO'], [1000, 'MIL'], [1001, 'MIL UNO'], [2000, 'DOS MIL'],
    [21000, 'VEINTIÚN MIL'], [31000, 'TREINTA Y UN MIL'], [10000, 'DIEZ MIL'], [100000, 'CIEN MIL'], [1_000_000, 'UN MILLÓN'],
    [2_500_000, 'DOS MILLONES QUINIENTOS MIL']
  ])('%i → %s', (n, esperado) => expect(enteroEnLetras(n)).toBe(esperado));

  it('formatea importes con centavos', () => {
    expect(montoEnLetras(1000)).toBe('MIL CON 00/100 SOLES');
    expect(montoEnLetras(1149.43)).toBe('MIL CIENTO CUARENTA Y NUEVE CON 43/100 SOLES');
    expect(montoEnLetras(10000)).toBe('DIEZ MIL CON 00/100 SOLES');
    expect(montoEnLetras(8000.05)).toBe('OCHO MIL CON 05/100 SOLES');
  });

  it('rechaza enteros fuera de rango', () => {
    expect(() => enteroEnLetras(-1)).toThrow(RangeError);
    expect(() => enteroEnLetras(1.5)).toThrow(RangeError);
  });
});
