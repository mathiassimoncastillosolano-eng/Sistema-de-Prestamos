# PerúCred · Tecnología para la Gestión Crediticia

Registro y consulta de préstamos: dashboard, clientes (DNI · RUC 10 · RUC 20), solicitudes, préstamos con cronograma, consulta del cronograma dentro de cada préstamo y PDF.

> **Alcance: este sistema NO realiza ni registra pagos.** No hay pagos, abonos, amortizaciones, cancelaciones anticipadas ni liquidaciones: ni en la interfaz ni en los servicios (hay pruebas que lo comprueban).

> **Estados de demostración.** Los préstamos muestran los estados En evaluación, Aprobado, Vigente, En mora, Cancelado y Rechazado, y las cuotas Pendiente, Próxima a vencer, Vencida y Pagada. Se derivan en el navegador (`resumen()` y `estadoCuota()` en `src/lib/finance.ts`) de las fechas e importes de los datos ficticios; no hay conciliación real de pagos. «En evaluación», «Aprobado» y «Rechazado» son solicitudes sin desembolsar (`etapa`): no generan capital pendiente ni cuentan para el límite. La fecha de desembolso de una solicitud nueva es la fecha actual del sistema (no editable) y la primera cuota se calcula un mes después.

> **Alcance real vs. ficticio.** Solo la **autenticación** es real: inicio de sesión con correo y contraseña, perfil, rol y agencia/ubicación vienen de PostgreSQL (`perfiles`, `agencias`, `ubicaciones`) a través del backend Spring Boot (`backend/`). Clientes, solicitudes, préstamos, cuotas y dashboard **siguen siendo datos ficticios en `localStorage`**; la consulta de DNI/RUC es simulada. Por eso el control de acceso a esos módulos es de navegación/presentación: no hay un servidor que proteja esos datos.

## Ejecutar

Requisitos: Node 20+, Java 17+ y una base PostgreSQL (Supabase) con el esquema de `perfiles/agencias/ubicaciones`.

```bash
# 1) Backend (puerto 8080). Copia backend/.env.example a backend/.env y rellénalo (no se versiona).
cd backend
set -a; source .env; set +a          # o define las variables en tu IDE
SESSION_COOKIE_SECURE=false ./mvnw spring-boot:run   # false SOLO en local sobre http

# 2) Frontend (http://localhost:5173; /api hace proxy al backend)
cd ..
npm install
npm run dev
npm run build      # tsc -b + vite build
npm run typecheck
npm test           # Vitest
```

### Crear un usuario para entrar
`perfiles.clave_hash` debe contener un hash **BCrypt**. Con `backend/db/crear-perfil-ejemplo.sql` (pgcrypto) se crea un perfil pasando la clave como variable de psql, sin escribirla en ningún archivo.

### Autenticación y seguridad
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`. La sesión es una cookie **HttpOnly** (`NEXORA_SESION`) emitida por el servidor; el navegador no guarda tokens (ni `localStorage`).
- CSRF por doble envío (cookie `XSRF-TOKEN` → cabecera `X-XSRF-TOKEN`). Bloqueo temporal tras 5 intentos fallidos por correo.
- En **cada** petición autenticada el servidor relee el perfil: si se desactiva, cambia de rol o su agencia deja de ser válida, la sesión se revoca. El rol sale siempre de la base de datos.
- Roles `asesor` y `gerencia` (valores exactos de la BD). Permisos en `src/lib/permissions.ts`; guards por URL en `src/app/App.tsx`.

### Despliegue
- **Vercel (frontend):** edita `vercel.json` y sustituye `REEMPLAZA-CON-LA-URL-DE-TU-BACKEND` por la URL HTTPS del backend; así `/api` es del mismo origen y la cookie es de primera parte. No hay variables de entorno en el frontend.
- **Backend:** variables `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` (y opcionales documentadas en `backend/.env.example`). `SESSION_COOKIE_SECURE` debe quedar en `true` en producción. Las sesiones viven en memoria: una sola instancia (con varias, usar Spring Session JDBC).

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
  components/data-display/  DataTable, StatusBadge (préstamo/cliente), AnimatedNumber, tooltips de gráficos…
  features/         dashboard · clients · loans · installments · auth
  lib/              config · finance · analytics · selectors · validation · format · dates · motion · pdf
  services/         store (estado + persistencia) · actions (escrituras) · identity (consulta simulada) · storage
  mocks/seed.ts     datos de demostración
  styles/index.css  tokens de diseño (claro/oscuro), impresión, movimiento reducido
tests/              finanzas, semilla, acciones, analíticas, UI (+ fixtures golden del código original)
legacy/             prototipo original (HTML/CSS/JS), solo referencia y para regenerar los fixtures
docs/AUDITORIA.md   auditoría del proyecto original y registro de cambios
```

Separación de responsabilidades: las reglas financieras viven **solo** en `lib/finance.ts`; los esquemas Zod (`lib/validation.ts`) delegan en ellas; las escrituras pasan por `services/actions.ts`, que revalida siempre; los componentes solo presentan.

## Reglas financieras (conservadas)

Mínimo S/ 1,000 · límite S/ 10,000 de capital pendiente por cliente en toda la empresa · TEA 30 % · plazo 1–60 meses · primera cuota un mes después del desembolso · sin cobro inicial. Parámetros en `src/lib/config.ts`.

### Estados y capital pendiente (sin pagos)

- Las cuotas del cronograma **no muestran estado de pago** (pagada, pendiente, vencida…): el sistema aún no registra ni concilia pagos, así que esa etiqueta no sería fiable. Se muestran solo datos contractuales: N.º, vencimiento, capital, interés, cuota y saldo de capital.
- Los datos mock incluyen un **registro histórico importado, de solo lectura**, que permite calcular el capital pendiente y los préstamos *Finalizados*. La interfaz no puede crear ni modificar ese registro.
- Un préstamo nuevo no tiene cobertura: su capital pendiente es el capital original y **no disminuye con el paso del tiempo**.

## PDF

`Descargar PDF` (detalle del préstamo) genera «Ficha y cronograma del préstamo» en el navegador con jsPDF + autotable (carga diferida). A4, cabecera de tabla repetida en cada página, filas sin partir, totales al final y numeración «Página X de Y». Es informativo; no afirma validez legal. **No existe envío por correo**: no hay integración; «Mensaje para el cliente» solo prepara texto para copiar.

**Garantía de no regresión:** `npm run fixtures:legacy` ejecuta el código original (`legacy/`) y guarda sus resultados; `tests/finance.test.ts` y `tests/seed.test.ts` exigen que la versión TypeScript produzca cronogramas, pagos, resúmenes y estados **idénticos**.

### ⚠ Discrepancia abierta (decisión de negocio pendiente)

El documento de requisitos plantea S/ 1,000 a 12 meses con total **S/ 1,300**. Con TEA 30 %, cuotas iguales y tasa mensual efectiva, el cálculo da **S/ 1,149.43** (cuota S/ 95.79). *Nota:* el README original afirmaba "unos S/ 1,163"; ese número tampoco coincide con el código. **No se modificó ninguna tasa ni fórmula**; la discrepancia está documentada en `config.ts` y en una prueba. Para resolverla basta decidir la fórmula y cambiar `CFG.tea` o `generarCronograma`.

## Diseño

Tokens en `src/styles/index.css` (identidad PerúCred: azul noche `#0B172A`, azul corporativo `#12365A`, turquesa `#00BFAE` y turquesa claro `#51D6C5`, con tonos de texto ajustados para contraste; ver «Identidad de marca»). Colores de estado con significado único: verde = al día, ámbar = atención, rojo = vencido, azul = informativo, gris = inactivo. El tema se aplica antes de pintar (script en `index.html`) y se persiste. Movimiento: 150–350 ms, sin rebotes, `MotionConfig reducedMotion="user"` + regla CSS global.

## Identidad de marca (PerúCred)

- **Nombre:** PerúCred (con tilde y esa capitalización). **Descriptor institucional:** «Tecnología para la Gestión Crediticia» (el mismo que lleva impreso el logo oficial). Ambos viven en `BRAND` (`src/lib/config.ts`); no escribas el nombre a mano en componentes.
- **Recursos oficiales:** el original está en `brand-source/perucred-logo-original.png`. De él se derivaron, en `public/`: `brand/perucred-logo.png` (logo completo, fondo transparente, solo para fondos claros), `brand/perucred-symbol.png` (símbolo solo), `brand/perucred-icon.png` (símbolo sobre tile blanco; lo usa el menú lateral) y los favicons (`favicon.ico`, `favicon-16/32/48/192/512.png`, `apple-touch-icon.png`), todos con el símbolo sin texto.
- **Dónde se usa:** el login muestra el logo completo en grande (`BrandLogo`, panel siempre claro). El menú y las pantallas de sesión usan el símbolo + el nombre en texto (`BrandMark`/`BrandName`), porque el logo completo no se lee sobre azul noche. Todo se dibuja en `src/components/layout/brand-mark.tsx`.
- **Colores:** el turquesa puro `#00BFAE` no alcanza contraste AA como texto sobre blanco; en modo claro el texto turquesa usa `--teal-ink` y los rellenos turquesa llevan texto azul noche (`--on-teal`).
- **Identificadores técnicos que conservan el nombre anterior a propósito** (cambiarlos rompería sesiones, datos guardados o el despliegue): paquete Java `com.nexora.backend`, cookie `NEXORA_SESION`, propiedades `nexora.seguridad.*`, atributo de sesión `nexora.perfil`, claves de localStorage `nexora-db-v5` / `nx-tema` / `nx-side`, y el nombre del paquete npm `nexora-finance`.

## Qué se verificó (y qué no)

Verificado: `tsc` estricto sin errores; `vite build` correcto; **82 pruebas Vitest** pasan; PDF de 1, 12 y 60 cuotas generados y revisados visualmente (60 cuotas = 3 páginas); descarga real del PDF en Chromium; recorrido manual automatizado con Playwright/Chromium (escritorio 1440, tableta 820, móvil 390) de: login, alta de cliente, solicitudes con bloqueo por límite/mínimo/plazo, pago, referencia duplicada, cancelación anticipada, búsqueda por teclado, ordenación/paginación/filtros, tema persistente, restaurar datos, persistencia al recargar, drawer móvil; 0 errores de consola y 0 desbordes horizontales en las 7 pantallas × 3 tamaños.

**No verificado:** Firefox/Safari y dispositivos reales (solo Chromium); lectores de pantalla; auditoría automática de accesibilidad (se siguieron prácticas —etiquetas, foco, roles, `aria-live`, foco en modales— y se calcularon los contrastes de los pares principales, pero no se pasó axe/Lighthouse); la vista de impresión se implementó con CSS `@media print` y no se revisó visualmente. Las pruebas de navegador fueron ejecuciones ad hoc, no forman parte del repositorio (sí lo son las de Vitest).

## Cambios en los datos de demostración

Se conservan los 15 clientes y 16 préstamos originales (mismos ID e importes). Se añaden 9 clientes y 12 préstamos (incl. una cancelación anticipada) para probar filtros, paginación y gráficos. Se corrigió que algunos clientes figuraran dados de alta *después* de su primer desembolso. La actividad reciente ahora se **deriva** de los registros (las horas son sintéticas). La clave de almacenamiento pasa a `nexora-db-v4`; no se migran datos de la versión anterior.

## Pendiente / siguientes pasos sugeridos

Resolver la discrepancia de la TEA; módulo real de registro y conciliación de pagos (cuando exista, podrá volver a mostrarse un estado por cuota; el resumen por préstamo, el dashboard y las notificaciones aún derivan «vencidas» solo de las fechas); backend real (sustituir `services/store.ts` y `actions.ts` por llamadas a API, y autenticación/autorización de servidor); el chunk de gráficos pesa ~400 kB (115 kB gzip) y se carga solo en el dashboard; añadir pruebas E2E al repositorio (Playwright).
