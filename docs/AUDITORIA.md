# Auditoría del proyecto original y registro de cambios

## 1. Qué existía
~1,060 líneas de HTML/CSS/JS sin framework: `config.js`, `finance.js`, `data.js`, `ui.js`, `views.js` (vistas como funciones que devuelven cadenas HTML), `app.js`. Estado global mutable, persistencia en `localStorage` (`nexora-db-v3`), navegación por `location.hash`.

Funcionalidades preservadas: dashboard, clientes (DNI/RUC 10/RUC 20 con consulta simulada), solicitudes con validaciones, préstamos y cronogramas, pagos y cancelación anticipada, búsqueda global, tema claro/oscuro, restaurar datos, login de demostración.

## 2. Hallazgos
| # | Hallazgo | Acción |
|---|---|---|
| 1 | Discrepancia de TEA: requisitos dicen S/ 1,300 por S/ 1,000/12 m; el código da S/ 1,149.43. El README original citaba "≈1,163", también inexacto. | **No se cambió.** Documentada y cubierta por prueba. Decisión de negocio pendiente. |
| 2 | Vistas = concatenación de cadenas HTML; lógica, UI y persistencia mezcladas; estado mutado en sitio. | Migración a componentes React; store inmutable; servicios separados. |
| 3 | `asignarPago` mutaba el cronograma. | Versión inmutable con idéntico resultado (verificado por fixtures). |
| 4 | Seed: varios clientes dados de alta después de su primer desembolso; actividad reciente escrita a mano y desconectada de los datos. | Altas corregidas; actividad derivada de registros. |
| 5 | Dashboard solo mostraba la cartera del asesor, sin periodos ni tendencias. | Selector de alcance (mi cartera / agencia / empresa) y periodo; tendencias calculadas con el mismo tramo de días del mes anterior (no mes parcial vs. completo); evolución del capital reconstruida reproduciendo los pagos (`capitalPendienteAl`). |
| 6 | Validaciones duplicadas entre formulario, resumen y servicio. | Una sola fuente (`validarSolicitud`, `validarPago`) usada por Zod, UI y servicios. |

## 3. Errores encontrados *durante la migración* y corregidos
Detectados con pruebas en navegador real:
1. **Bucle de renderizado infinito** al teclear en el importe de un pago: `DataTable` usaba `[]` nuevos como valores por defecto y `columns` recreadas en cada render, lo que hacía que TanStack Table reiniciara la paginación sin parar. Corregido con referencias estables; cubierto por prueba de regresión.
2. El formulario de pagos ignoraba cambios de URL (`?modo=anticipada`, `?cuota=n`) si ya estaba montado. Ahora sigue la URL.
3. Desbordes horizontales: `sr-only` (absoluto) dentro de tablas con scroll ensanchaba el documento; elementos de rejilla sin `min-w-0`; importes que se partían en dos líneas (ahora usan espacio no separable).
4. Panel de registro de cliente: `fieldset/legend` pegaba el contenido al borde y el selector de tipo se salía; reemplazado por secciones semánticas.
5. Resumen de solicitud mostraba errores en rojo antes de elegir cliente; ahora estado neutro "pendiente".

## 4. Equivalencia funcional demostrada
`tests/fixtures/legacy.json` se genera ejecutando el código original. Las pruebas comprueban igualdad exacta de: 10 cronogramas (incluidas fechas de fin de mes y año bisiesto), 6 casos de `addMonths`, los 16 préstamos originales (cronograma, pagos, resumen, estado de cada cuota) y el límite de endeudamiento por cliente.
