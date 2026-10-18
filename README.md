# PerúCred · Tecnología para la Gestión Crediticia

Registro y consulta de préstamos: dashboard, clientes (DNI · RUC 10 · RUC 20), solicitudes, préstamos con cronograma, consulta del cronograma dentro de cada préstamo y PDF.

> **Alcance: este sistema NO realiza ni registra pagos.** No existe tabla de pagos: nada en la interfaz ni en los servicios marca una cuota como pagada. Una cuota solo figura PAGADA si así está guardada en la base de datos; el sistema no la cambia.

> **Préstamos y cuotas (módulos reales).** Listado, detalle, cronograma, simulación, registro y PDF de préstamos usan el backend y PostgreSQL (`/api/prestamos`). Los estados del préstamo son solo **Vigente / En mora / Cancelado** y los de cuota **PENDIENTE / PAGADA / VENCIDA** (los CHECK de la BD). Se derivan al leer, en un único punto (`EvaluadorCartera`), de la fecha de hoy en Lima y de los vencimientos guardados: la lectura nunca escribe. Una cuota es VENCIDA si su fecha ya pasó y no está PAGADA; un préstamo está En mora si tiene alguna VENCIDA y Cancelado si todas son PAGADA. No hay solicitudes, aprobaciones ni rechazos: registrar un préstamo lo crea Vigente.

> **Alcance real vs. ficticio.** Son reales: autenticación, clientes, dashboard y **préstamos/cuotas**. Siguen en datos ficticios del navegador (`localStorage`) solo piezas ajenas a esta remasterización, como el centro de notificaciones (`components/layout/notifications.tsx`). La ficha de cliente lista sus préstamos desde la API, pero conserva su propia tabla (con icono de ojo), que no se tocó.

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
  components/layout/ shell, sidebar, header (título de sección y fecha), notificaciones
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

Mínimo S/ 1,000 · límite S/ 10,000 de capital pendiente por cliente en toda la empresa · TEA 30 % · plazo 1–60 meses · sin cobro inicial. Las reglas viven en el backend y llegan al frontend por `GET /api/prestamos/condiciones`; ya no se duplican en el navegador.

### Fórmula única y fechas

- `CalculadoraCronograma` (backend) es la **única** fórmula: sistema francés con cuotas iguales, **TEM = (1 + TEA)^(1/12) − 1**, interés = saldo × TEM, redondeo a 2 decimales y última cuota que cierra el saldo en 0.00. La simulación, el registro, el detalle y el PDF muestran exactamente lo que ella produce; el navegador no calcula cuotas.
- **Fecha de desembolso** = fecha actual de Lima (`America/Lima`), calculada por el servidor y no editable. **Primera cuota** = un mes calendario después; la cuota *k* vence en `desembolso + k meses` calculado siempre desde la fecha original (el 31 de enero → 28/29 de febrero → 31 de marzo).
- Al registrar, el cliente envía la fecha y el total que revisó; si el servidor calcula otra cosa (por ejemplo, cambió el día), responde **409 `CONDICIONES_DESACTUALIZADAS`** y no guarda nada.
- El registro es **atómico** (préstamo + cuotas en una transacción) y el botón bloquea el doble envío.

### API de préstamos (requiere sesión; CSRF en POST)

| Método y ruta | Uso |
|---|---|
| `GET /api/prestamos/condiciones` | Reglas vigentes, fecha de desembolso y de primera cuota |
| `POST /api/prestamos/simulacion` `{capital, plazoMeses}` | Cronograma que se guardaría hoy. **No persiste nada** |
| `GET /api/prestamos` | Listado del alcance de la sesión (gerencia: todos; asesor: su agencia) con estado y saldos derivados |
| `GET /api/prestamos?clienteId=…` | Préstamos de un cliente (ficha de cliente) |
| `GET /api/prestamos/{id}` | Detalle: cabecera (incl. código y celular del cliente), KPI, cuotas con estado y historial |
| `POST /api/prestamos` | Registro atómico (acepta `fechaDesembolsoEsperada` y `totalContractualEsperado`) |

### Historial, saldos y límites del esquema

- El **historial administrativo** muestra solo eventos reales que se pueden reconstruir de las tablas existentes (alta del préstamo con su asesor y fecha); no hay tabla de auditoría ni se inventan eventos.
- **Capital pendiente** = capital de las cuotas no PAGADAS; **pendiente contractual** = importe de esas cuotas. Como no hay pagos, solo bajan si una cuota está guardada como PAGADA.
- Sin tabla de pagos, el detalle de una cuota indica «Fecha de pago: No registrada».
- «Solo mis préstamos» filtra por el dato real `propio` (el asesor del préstamo es la persona en sesión).


## PDF

Hay dos documentos, generados en el navegador con jsPDF + autotable (carga diferida), con los datos que entrega el servidor: (1) **Simulación de cronograma de cuotas**, marcada «SIMULACIÓN NO REGISTRADA» y **sin código de préstamo**, desde la revisión previa al registro; (2) **Ficha y cronograma del préstamo** (`PR-{número}`), desde el detalle, con los datos persistidos y el estado de cada cuota. A4, cabecera de tabla repetida, filas sin partir, totales, hora de generación en Lima y «Página X de Y». Son informativos; no afirman validez legal. **No existe envío por correo ni mensajería**: «Mensaje para el cliente» solo prepara texto para copiar.

**Cronogramas paginados:** la simulación (modal), la confirmación y el detalle del préstamo usan el mismo `ScheduleTable` con paginación en el navegador (10 por página, selector 10/20/30, «Mostrando cuotas 11–20 de 60»). Solo se pagina lo visible: los totales y el PDF usan siempre el cronograma completo y la numeración de cuotas no se reinicia. Cambiar de cronograma vuelve a la primera página. La lógica pura está en `paginar()` y `paginasVisibles()` (`features/loans/loan-utils.ts`).

**Pruebas:** `./mvnw test` (en `backend/`) cubre la fórmula, las fechas (fin de mes, año bisiesto, Lima vs. UTC), el evaluador de estados, la consulta por alcance y el registro; `npm test` cubre la interfaz de Préstamos contra un servidor falso (`tests/prestamos-ui.test.tsx`) y el PDF (`tests/pdf-cronograma.test.ts`).

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
