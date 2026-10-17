# Informe de remasterización — PerúCred

## Estado del logo (acción pendiente tuya)
La imagen oficial del logo **no llegó** (solo el ZIP). El símbolo actual es un **marcador provisional** hecho con la paleta de marca.
Para instalar el oficial: edita `src/components/layout/brand-mark.tsx` y `public/favicon.svg` (ningún otro archivo dibuja la marca).

## Descriptor institucional: «Plataforma de gestión crediticia»
Criterio: describe lo que el sistema hace hoy (registrar, validar límites y consultar cartera/cronogramas); no promete cobranza ni pagos
(el README declara que el sistema no los registra) y no sugiere ser entidad supervisada (evita «Financiera», «Banca», «Microfinanzas»).
Es corto, en minúscula tras la primera letra (estilo institucional en español) y se omite en espacios reducidos (menú contraído, favicon).

## Cambios
- `src/styles/index.css`: tokens reescritos (claro/oscuro) con la paleta PerúCred; `copper`→`navy`, `sand`→`tint`, nuevos `side-accent`, `on-teal`, `overlay`; patrón escalonado reemplazado por retícula neutra.
- `src/lib/config.ts`: `BRAND` = PerúCred + descriptor (se elimina `sufijo`).
- `brand-mark.tsx` (logo + nombre + descriptor), `sidebar.tsx`, `login-page.tsx`, `session-screens.tsx` (vía BrandName), `nav.ts`, `print-header.tsx`, `lib/pdf.ts` (cabecera, pie y archivo `PeruCred-<id>-cronograma.pdf`).
- `badge.tsx`, `avatar.tsx`, `empty-state.tsx`, `global-search.tsx`, `modal.tsx`, `sheet.tsx`, `stepper.tsx`, `clients-page.tsx`, `client-detail-page.tsx`: uso de los nuevos tokens (sin lógica tocada).
- `index.html` (título, descripción, theme-color, color previo al pintado), `public/favicon.svg`, `package.json` (descripción), `README.md` (sección «Identidad de marca»).

## No modificado a propósito
Paquete Java `com.nexora.backend`, cookie `NEXORA_SESION`, propiedades `nexora.*`, atributo `nexora.perfil`, claves localStorage `nexora-db-v5`/`nx-tema`/`nx-side`, nombre del paquete npm. Cambiarlos rompería sesiones, datos guardados o despliegue.
Backend, autenticación, permisos, reglas financieras, datos y `.env*`: intactos.

## Validación
| Comprobación | Resultado |
|---|---|
| Sintaxis TS/TSX de los 17 archivos modificados (transpile) | ✅ sin errores |
| Tokens Tailwind nuevos definidos en `@theme` | ✅ |
| Contraste WCAG de 18 pares clave (claro/oscuro/menú/foco) | ✅ 0 fallos |
| Maqueta visual del logo en fondo claro/oscuro y favicon 16/32 px | ✅ revisada |
| Búsqueda de residuos de marca anterior | ✅ solo identificadores técnicos y README explicativo |
| `npm install`, `tsc -b`, `vite build`, `vitest` | ⛔ **NO ejecutados**: el entorno no tiene acceso a internet |
| Pruebas Java (`mvnw test`), recorrido en navegador de la app, responsive real, impresión/PDF generado | ⛔ **NO ejecutados** |

## Pendientes
1. Correr localmente: `npm install && npm run typecheck && npm test && npm run build` (y revisar login, menú, dashboard, PDF).
2. Entregar la imagen oficial del logo y reemplazar el marcador provisional.
3. Preexistente: el árbol de trabajo del ZIP ya difería de su `HEAD` git (p. ej. falta `src/features/installments/installments-page.tsx`, que README menciona); no se tocó.
