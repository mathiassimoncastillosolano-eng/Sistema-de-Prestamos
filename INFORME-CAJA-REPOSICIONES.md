# Informe: Caja y reposiciones (2026-10-26)

## 1. Estado general
| Elemento | Estado |
|---|---|
| Código backend (`com.nexora.backend.caja`) y frontend (`src/features/caja`) | Implementado |
| Migración `backend/sql/2026-10-26-caja-y-reposiciones.sql` | **Preparada, NO aplicada a producción** |
| Hermes | **Simulado de forma permanente** por decisión del proyecto (`HermesSimulado`, activo por defecto; no hay integración real). Controles de formato, un solo uso, intentos, huella y autorizador distinto sí son reales |
| Pruebas Java (Spring/Mockito/PostgreSQL) y vitest | **Escritas, NO ejecutadas** (Maven y npm bloqueados en el entorno de desarrollo) |
| Pruebas SQL de integridad | Ejecutadas: 33/33 OK en base local limpia |
| Migración idempotente y rollback | Ejecutados solo en base de prueba local |

## 2. Cambios en base de datos
Siete tablas nuevas (caja, libro de movimientos, reposiciones, recepciones, incidencias, verificaciones Hermes, auditoría de caja). Garantías en la base:
- `cajas.saldo` solo cambia mediante un trigger BEFORE INSERT sobre `caja_movimientos` (libro append-only).
- CHECK `0 ≤ saldo ≤ limite` (S/ 50,000): la base impide superar el tope.
- Índices únicos: un DESEMBOLSO por préstamo, un movimiento por recepción, una APERTURA por caja, una reposición abierta por caja, huella Hermes única, claves de idempotencia.
- Versión optimista en reposiciones. Orden de bloqueo: cliente → caja → reposición.
- Tablas existentes: sin cambios destructivos. Se retira el límite diario de colocación (código); `LimiteDiarioAsesor` eliminado.

Aplicar: ejecutar el `.sql` (idempotente). Revertir: sección de rollback del mismo archivo (verificada solo en base de prueba). **Respaldar antes de aplicar en producción.**

Variables de entorno: `HERMES_SIMULADO` (por defecto `true`) y `HERMES_HUELLA_SECRETO` (tiene valor de demostración; cámbialo en producción).

## 3. Endpoints
`/api/caja` (resumen, `/movimientos`, `/pendientes`, `/reportes/resumen`, `/reportes/reposiciones.csv`), `/api/reposiciones` (listar, solicitar, `/{id}`, `aprobar`, `rechazar`, `observar`, `responder`, `cancelar`, `despachar`, `recepciones`, `incidencias`, `cerrar-remanente`, `conciliar`, `incidencias/{id}/resolver`), `/api/supervision/cajas`. Registro de préstamo (`POST /api/prestamos`) ahora descuenta de la caja (`SALDO_CAJA_INSUFICIENTE` 422, `CAJA_CERRADA` 409).

## 4. Módulos por rol
- Asesor: Caja y reposiciones (saldo, solicitud, detalle con línea de tiempo, recepciones parciales, incidencias).
- Gerencia: Gestión de reposiciones (aprobar con código, rechazar, observar, conciliar, cerrar remanente) y Supervisión de cajas.
- Notificaciones por sondeo cada 60 s (pausa con pestaña oculta); no es tiempo real.

## 5. Decisiones de negocio a confirmar
1. El despacho (envío) es opcional antes de recibir.
2. No hay flujo de cierre/reapertura de caja (el estado `CERRADA` existe, sin pantalla).
3. La caja se abre en el primer uso con S/ 50,000, ignorando préstamos colocados antes.
4. Gerencia ve todas las agencias.
5. El cierre de remanente no pide código Hermes.
6. Una sola reposición abierta por caja.
7. No hay pantalla de reversa/ajuste; el libro admite `AJUSTE` con motivo (probado en SQL).

## 6. Matriz de los 27 escenarios obligatorios
Leyenda: **E** = ejecutado y aprobado (SQL/Java de dominio); **P** = parcialmente cubierto por ejecutadas; **N** = prueba escrita, **no ejecutada**.

| Esc. | Cobertura | Estado |
|---|---|---|
| 1–3, 6, 7 (límite 50,000, saldos, montos separados) | Triggers/CHECK en SQL | P (E en la base; capa Java N) |
| 10 (huella no en claro) | SQL + `CodigoHermesTest` | P |
| 11, 18, 26 | SQL de integridad | P |
| 21 (fallo a mitad de operación sin parciales) | SQL #32 | E (nivel BD) |
| 22 (ajuste auditable) | SQL #33 | E (nivel BD) |
| 8, 9, 12, 14–17, 19, 20, 23–25, 27 | `ReposicionServicioTest`, `ReposicionPostgresTest`, `PrestamoServicioTest`, `RegistroConcurrentePostgresTest`, `caja-solicitud.test.tsx` | **N** |
| Reglas de dominio (capacidad, estados, formato de código) | `CapacidadCajaTest`, `EstadoReposicionTest`, `CodigoHermesTest` | E (16 OK) |

Los escenarios marcados **N** no deben darse por aprobados hasta ejecutar: `./mvnw test` (con `PRUEBA_PG_URL=jdbc:postgresql://localhost:5432/postgres PRUEBA_PG_USER=postgres` para las de PostgreSQL) y `npm install && npm run typecheck && npm test`.

## 7. Limitaciones
- Código Java y TSX no compilados ni probados aquí; pueden existir errores de compilación.
- Hermes es simulado: el código no se valida contra ningún servicio; no es un control de seguridad real.
- Sondeo, no tiempo real.
