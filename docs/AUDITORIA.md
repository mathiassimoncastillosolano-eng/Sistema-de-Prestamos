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


## 5. Remasterización de alcance: retiro de la operativa de pagos (iteración 3)
**Decisión:** el sistema solo registra y consulta préstamos. Se retiró todo lo que registraba o ejecutaba pagos.

| Área | Antes | Ahora |
|---|---|---|
| Rutas / menú | `/pagos`, `/pagos/:id`, «Pagos y cancelaciones» | Eliminadas (`#/pagos` da «página no encontrada»). Nueva `/cuotas` («Cuotas y cronogramas», solo consulta: filtros por estado, periodo, agencia y búsqueda) |
| Servicios | `registrarPago`, `validarPago`, `aplicarPagoAPrestamo` | Eliminados. `importarHistorico` queda solo para la semilla mock |
| Modelo | `Pago`, `MedioPago`, `abonado`, `cubierta`, estados «Pagada»/«Cancelado» | `RegistroHistorico` (solo lectura), `cubierto`, «Cubierta (histórico)», «Finalizado» |
| Dashboard | «Pagos recibidos», barras de pagos, botón «Registrar pago» | Retirados; sustituidos por capital pendiente y capital registrado por mes |
| Detalle de préstamo | Botones de pago/cancelación, historial de pagos, «Avance de pago» | Condiciones, historial administrativo, cronograma de solo consulta |
| PDF | Solo `window.print()` (sin generador) | Generador real (jsPDF + autotable) con paginación verificada |
| Almacenamiento | `nexora-db-v4` | `nexora-db-v5` (no se migran datos locales anteriores) |

**Verificado:** 82 pruebas, `tsc` limpio, build, recorrido en Chromium (escritorio 1440 y móvil 390) sin desbordes, sin errores de consola y sin términos de pago visibles; PDF descargado de verdad.

**Decisiones abiertas para negocio:** (1) las cuotas vencidas de préstamos sin registro histórico figuran «Vencida» (el estado se calcula por fecha; no se inventan pagos); (2) la discrepancia de TEA de la sección 2 sigue sin resolver; (3) no existe rol de gerente en el prototipo (un único usuario de demostración): no se inventó; (4) no hay integración de correo.
