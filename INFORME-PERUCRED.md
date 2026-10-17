# Informe de remasterización — PerúCred

## Logo oficial (integrado)
Fuente: `brand-source/perucred-logo-original.png` (1536×1024, fondo blanco). Procesado a recursos en `public/`:
- `brand/perucred-logo.png` — logo completo con fondo transparente (solo fondos claros).
- `brand/perucred-symbol.png` — símbolo «P» sin texto. `brand/perucred-icon.png` — símbolo sobre tile blanco redondeado.
- Favicons con el símbolo sin texto: `favicon.ico`, `favicon-16/32/48/192/512.png`, `apple-touch-icon.png` (enlazados en `index.html`). Se eliminó el `favicon.svg` provisional.

## Dónde aparece
- **Login:** logo completo grande (hasta 36 rem en escritorio, 17 rem en móvil) sobre un panel siempre claro, también en modo oscuro.
- **Menú lateral / pantallas de sesión:** símbolo oficial + nombre en texto con los colores de la marca (el logo completo tiene texto azul marino y no se lee sobre fondo oscuro).
- **Pestaña del navegador / iOS:** favicon = símbolo sin texto.

## Descriptor
Se adoptó el que trae el logo: «Tecnología para la Gestión Crediticia», para que texto de interfaz, PDF e impresión coincidan con la marca.

## Cambios previos (resumen)
Tokens de color PerúCred en `src/styles/index.css` (claro/oscuro, contraste AA), `BRAND` en `config.ts`, marca en PDF, impresión, títulos y metadatos. Ver README, sección «Identidad de marca».

## No modificado a propósito
Paquete Java `com.nexora`, cookie `NEXORA_SESION`, propiedades `nexora.*`, claves localStorage, nombre del paquete npm. Backend, autenticación, permisos, reglas financieras, datos y `.env*` intactos.

## Validación
| Comprobación | Resultado |
|---|---|
| Extracción de logo/símbolo/iconos revisada visualmente (sin bordes blancos, sin restos de texto en el símbolo) | ✅ |
| Sintaxis TS/TSX de archivos modificados | ✅ |
| Contraste WCAG de 18 pares clave | ✅ |
| Maqueta estática del login (escritorio y móvil) con los recursos reales | ✅ revisada (no es la app compilada) |
| `npm install`, `tsc -b`, `vite build`, `vitest`, pruebas Java, prueba en navegador de la app real | ⛔ NO ejecutados (sin internet en el entorno) |

## Pendientes
1. Ejecutar localmente: `npm install && npm run typecheck && npm test && npm run build`, y revisar el login real en modo claro/oscuro y móvil.
2. Si el equipo de marca dispone del logo en SVG o PNG de mayor resolución, sustituir `brand-source/` y regenerar `public/brand/*` (la fuente actual mide 1203 px de ancho útil).
3. El PDF del cronograma sigue usando la marca en texto (no se incrustó el símbolo para no tocar la generación sin poder ejecutar sus pruebas).
4. Preexistente: el árbol de trabajo del ZIP ya difería de su `HEAD` git (p. ej. falta `src/features/installments/installments-page.tsx`).
