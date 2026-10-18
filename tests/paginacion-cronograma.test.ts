import { describe, expect, it } from 'vitest';
import { paginar, paginasVisibles } from '@/features/loans/loan-utils';

const cuotas = (n: number) => Array.from({ length: n }, (_, i) => ({ numero: i + 1 }));

describe('paginar', () => {
  it('60 cuotas de 10 en 10: rangos 1–10, 11–20… y última página completa', () => {
    const f = cuotas(60);
    expect(paginar(f, 1, 10)).toMatchObject({ desde: 1, hasta: 10, paginas: 6, total: 60 });
    expect(paginar(f, 2, 10)).toMatchObject({ desde: 11, hasta: 20 });
    expect(paginar(f, 2, 10).visibles[0]?.numero).toBe(11);
    expect(paginar(f, 6, 10).visibles).toHaveLength(10);
  });
  it('la última página trae solo las cuotas restantes', () => {
    const p = paginar(cuotas(56), 6, 10);
    expect(p.visibles.map((c) => c.numero)).toEqual([51, 52, 53, 54, 55, 56]);
    expect(p).toMatchObject({ desde: 51, hasta: 56 });
  });
  it('recorrer todas las páginas devuelve las cuotas completas, en orden y sin repetir (12, 24, 36, 48 y 60)', () => {
    for (const n of [12, 24, 36, 48, 60]) for (const tamano of [10, 20, 30]) {
      const f = cuotas(n);
      const total = paginar(f, 1, tamano).paginas;
      const juntas = Array.from({ length: total }, (_, i) => paginar(f, i + 1, tamano).visibles).flat();
      expect(juntas).toEqual(f);
    }
  });
  it('cambiar el tamaño recalcula las páginas; una página fuera de rango se acota', () => {
    expect(paginar(cuotas(60), 1, 20).paginas).toBe(3);
    expect(paginar(cuotas(60), 1, 30).paginas).toBe(2);
    expect(paginar(cuotas(60), 99, 10).pagina).toBe(6);
    expect(paginar(cuotas(60), -3, 10).pagina).toBe(1);
  });
  it('un cronograma vacío no falla', () => {
    expect(paginar([], 1, 10)).toMatchObject({ visibles: [], total: 0, desde: 0, hasta: 0, paginas: 1, pagina: 1 });
  });
  it('no modifica el conjunto original', () => {
    const f = cuotas(25);
    const copia = JSON.stringify(f);
    paginar(f, 2, 10);
    expect(JSON.stringify(f)).toBe(copia);
  });
});

describe('paginasVisibles', () => {
  it('pocas páginas: todas; muchas: primera, última y vecindad con puntos suspensivos', () => {
    expect(paginasVisibles(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(paginasVisibles(1, 10)).toEqual([1, 2, 3, 4, '…', 10]);
    expect(paginasVisibles(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(paginasVisibles(10, 10)).toEqual([1, '…', 7, 8, 9, 10]);
  });
});
