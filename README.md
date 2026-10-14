# NEXORA FINANCE

Gestión de préstamos: dashboard, clientes (DNI · RUC 10 · RUC 20), solicitudes, préstamos con cronograma, pagos y cancelación anticipada.

> **Prototipo exclusivamente frontend.** Todos los datos son ficticios, viven en `localStorage` y no hay backend. La consulta de DNI/RUC es **simulada** (no consulta RENIEC ni SUNAT) y el acceso es una **autenticación de demostración** que no ofrece seguridad real.

## Ejecutar

```bash
npm install
npm run dev        # desarrollo  → http://localhost:5173
npm run build      # tsc -b + vite build
npm run preview    # sirve dist/
npm run typecheck  # TypeScript estricto
npm test           # Vitest (71 pruebas)
```

Acceso de demostración: usuario `asesor` · contraseña `demo1234` (el login tiene un botón que las rellena). Requiere Node 20+ (probado con Node 22).

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Radix UI (Dialog, Dropdown, Tooltip, Tabs, RadioGroup) · Lucide · Motion · Recharts · TanStack Table **v8** · React Hook Form + Zod · date-fns · Vitest + Testing Library.

Notas de decisión:
- Los componentes de `components/ui` están escritos a mano **al estilo de shadcn/ui** sobre Radix + `class-variance-authority`; no se ejecutó el CLI de shadcn. Son tuyos: se editan directamente.
- TanStack Table se fijó en **v8**: es la API estable y documentada; la v9 es otra API.
- Rutas con `HashRouter` (`#/clientes/C001`) para poder servirse como estático sin configurar el servidor. Las URL antiguas (`#cliente/C001`) ya no existen.

## Estructura

```
src/
  app/              App, rutas (carga diferida por pantalla), proveedores
  components/ui/    design system: button, field, modal, sheet, tabs, toast, stepper…
  components/layout/ shell, sidebar, header, búsqueda global, notificaciones
  components/data-display/  DataTable, StatusBadge, AnimatedNumber, tooltips de gráficos…
  features/         dashboard · clients · loans · payments · auth
  lib/              config · finance · analytics · selectors · validation · format · dates · motion
  services/         store (estado + persistencia) · actions (escrituras) · identity (consulta simulada) · storage
  mocks/seed.ts     datos de demostración
  styles/index.css  tokens de diseño (claro/oscuro), impresión, movimiento reducido
tests/              finanzas, semilla, acciones, analíticas, UI (+ fixtures golden del código original)
legacy/             prototipo original (HTML/CSS/JS), solo referencia y para regenerar los fixtures
docs/AUDITORIA.md   auditoría del proyecto original y registro de cambios
```

Separación de responsabilidades: las reglas financieras viven **solo** en `lib/finance.ts`; los esquemas Zod (`lib/validation.ts`) delegan en ellas; las escrituras pasan por `services/actions.ts`, que revalida siempre; los componentes solo presentan.

## Reglas financieras (conservadas)

Mínimo S/ 1,000 · límite S/ 10,000 de capital pendiente por cliente en toda la empresa (el capital amortizado libera capacidad) · TEA 30 % · plazo 1–60 meses · primera cuota un mes después del desembolso · sin cobro inicial · cancelación anticipada = total contractual − pagos previos, conservando el cronograma original. Parámetros en `src/lib/config.ts`.

**Garantía de no regresión:** `npm run fixtures:legacy` ejecuta el código original (`legacy/`) y guarda sus resultados; `tests/finance.test.ts` y `tests/seed.test.ts` exigen que la versión TypeScript produzca cronogramas, pagos, resúmenes y estados **idénticos**.

### ⚠ Discrepancia abierta (decisión de negocio pendiente)

El documento de requisitos plantea S/ 1,000 a 12 meses con total **S/ 1,300**. Con TEA 30 %, cuotas iguales y tasa mensual efectiva, el cálculo da **S/ 1,149.43** (cuota S/ 95.79). *Nota:* el README original afirmaba "unos S/ 1,163"; ese número tampoco coincide con el código. **No se modificó ninguna tasa ni fórmula**; la discrepancia está documentada en `config.ts` y en una prueba. Para resolverla basta decidir la fórmula y cambiar `CFG.tea` o `generarCronograma`.

## Diseño

Tokens en `src/styles/index.css` (paleta Azul Pacífico / Verde petróleo / Cobre / Marfil / Blanco frío / Grafito, con tonos de texto ajustados para contraste). Colores de estado con significado único: verde = al día, ámbar = atención, rojo = vencido, azul = informativo, gris = inactivo. El tema se aplica antes de pintar (script en `index.html`) y se persiste. Movimiento: 150–350 ms, sin rebotes, `MotionConfig reducedMotion="user"` + regla CSS global.

## Qué se verificó (y qué no)

Verificado: `tsc` estricto sin errores; `vite build` correcto; **71 pruebas Vitest** pasan; recorrido manual automatizado con Playwright/Chromium (escritorio 1440, tableta 820, móvil 390) de: login, alta de cliente, solicitudes con bloqueo por límite/mínimo/plazo, pago, referencia duplicada, cancelación anticipada, búsqueda por teclado, ordenación/paginación/filtros, tema persistente, restaurar datos, persistencia al recargar, drawer móvil; 0 errores de consola y 0 desbordes horizontales en las 7 pantallas × 3 tamaños.

**No verificado:** Firefox/Safari y dispositivos reales (solo Chromium); lectores de pantalla; auditoría automática de accesibilidad (se siguieron prácticas —etiquetas, foco, roles, `aria-live`, foco en modales— y se calcularon los contrastes de los pares principales, pero no se pasó axe/Lighthouse); la vista de impresión se implementó con CSS `@media print` y no se revisó visualmente. Las pruebas de navegador fueron ejecuciones ad hoc, no forman parte del repositorio (sí lo son las de Vitest).

## Cambios en los datos de demostración

Se conservan los 15 clientes y 16 préstamos originales (mismos ID e importes). Se añaden 9 clientes y 12 préstamos (incl. una cancelación anticipada) para probar filtros, paginación y gráficos. Se corrigió que algunos clientes figuraran dados de alta *después* de su primer desembolso. La actividad reciente ahora se **deriva** de los registros (las horas son sintéticas). La clave de almacenamiento pasa a `nexora-db-v4`; no se migran datos de la versión anterior.

## Pendiente / siguientes pasos sugeridos

Resolver la discrepancia de la TEA; backend real (sustituir `services/store.ts` y `actions.ts` por llamadas a API, y autenticación/autorización de servidor); el chunk de gráficos pesa ~400 kB (115 kB gzip) y se carga solo en el dashboard; añadir pruebas E2E al repositorio (Playwright).
