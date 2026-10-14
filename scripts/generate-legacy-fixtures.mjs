/**
 * Ejecuta el código ORIGINAL (vanilla JS) del prototipo en un contexto aislado
 * y guarda sus resultados como fixtures "golden". Los tests de la versión
 * TypeScript comparan contra ellos para demostrar que las reglas financieras
 * no cambiaron durante la migración.
 *
 * Uso: node scripts/generate-legacy-fixtures.mjs legacy
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.argv[2] ?? 'legacy';
if (!root) { console.error('Indica la ruta del proyecto original.'); process.exit(1); }

const ctx = vm.createContext({ console });
for (const f of ['config.js', 'finance.js', 'data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const run = (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, ctx));

const casos = [
  [1000, 12, '2026-10-13'], [1000, 1, '2026-10-13'], [2000, 12, '2026-01-31'], [6000, 24, '2026-03-13'],
  [10000, 60, '2026-10-13'], [3500, 12, '2026-01-30'], [1500, 6, '2026-08-31'], [2500, 36, '2024-02-29'],
  [1234.56, 18, '2026-05-15'], [9999.99, 7, '2026-12-31']
];
const schedules = casos.map(([cap, n, d]) => ({
  capital: cap, plazo: n, desembolso: d,
  cronograma: run(`generarCronograma(${cap}, ${n}, '${d}')`)
}));

const seed = run('construirSemilla()');
const resumenes = run(`construirSemilla().prestamos.map(p => ({ id: p.id, ...resumen(p), estados: p.cronograma.map(estadoCuota) }))`);
const deudas = run(`(() => { const s = construirSemilla(); return s.clientes.map(c => ({ id: c.id, deuda: capitalPendienteCliente(s.prestamos, c.id) })); })()`);

const cfg = run('CFG');
const addMonthsCases = [['2026-01-31', 1], ['2026-01-31', 13], ['2024-01-31', 1], ['2026-10-13', 1], ['2026-12-31', 2], ['2026-03-31', -1]]
  .map(([d, m]) => ({ fecha: d, meses: m, res: vm.runInContext(`addMonths('${d}', ${m})`, ctx) }));
const ejemploPdf = run('(() => { const c = generarCronograma(1000, 12, "2026-10-13"); return { total: r2(c.reduce((a, x) => a + x.cuota, 0)), cuota: c[0].cuota }; })()');

fs.writeFileSync(path.resolve('tests/fixtures/legacy.json'), JSON.stringify({ cfg, schedules, seed, resumenes, deudas, addMonthsCases, ejemploPdf }));
console.log('OK · cronogramas:', schedules.length, '· clientes:', seed.clientes.length, '· préstamos:', seed.prestamos.length, '· ejemplo 1000/12 =', ejemploPdf);
