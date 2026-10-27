package com.nexora.backend.caja.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos JSON del módulo de caja y reposiciones. Los importes son BigDecimal (2 decimales); nunca float/double. */
public final class CajaDtos {

    private CajaDtos() {
    }

    // ------------------------------------------------------------------------------------------ entrada
    public record SolicitudReposicion(BigDecimal monto, String motivo, String comentarios, String claveIdempotencia) {
    }

    public record AprobarReposicion(BigDecimal montoAutorizado, String justificacion, String codigoHermes, Integer version) {
        @Override
        public String toString() { // el código Hermes jamás debe llegar a un log
            return "AprobarReposicion[montoAutorizado=" + montoAutorizado + "]";
        }
    }

    /** Cuerpo genérico de rechazar, observar, responder, cancelar, cerrar remanente y conciliar. */
    public record DecisionTexto(String texto, Integer version) {
    }

    public record Despacho(BigDecimal montoEnviado, String referencia, String comentarios, Integer version) {
    }

    public record Recepcion(BigDecimal importe, Instant recibidoEn, String referencia, String comentarios,
                            String claveIdempotencia) {
    }

    public record NuevaIncidencia(String tipo, BigDecimal importe, String descripcion) {
    }

    public record ResolverIncidencia(String resolucion) {
    }

    // ------------------------------------------------------------------------------------------ salida: caja
    public record UltimaRecepcion(BigDecimal importe, Instant registradoEn, long reposicionNumero) {
    }

    public record CajaResumen(UUID cajaId, UUID asesorId, String asesor, UUID agenciaId, String agencia, String estado,
                              BigDecimal limite, BigDecimal saldo, BigDecimal saldoInicial,
                              BigDecimal capacidadHastaLimite, BigDecimal autorizadoPendienteRecepcion,
                              BigDecimal capacidadLibre, BigDecimal saldoProyectado,
                              ReposicionFila reposicionAbierta, UltimaRecepcion ultimaRecepcion,
                              int incidenciasAbiertas, Instant abiertaEn, Instant ahora) {
    }

    public record Movimiento(UUID id, long numero, String tipo, String sentido, BigDecimal importe,
                             BigDecimal saldoAntes, BigDecimal saldoDespues, Long prestamoNumero, Long reposicionNumero,
                             String referencia, String registradoPor, Instant creadoEn) {
    }

    public record Pagina<T>(List<T> items, long total, int pagina, int tamano, Instant ahora) {
    }

    // ------------------------------------------------------------------------------------------ salida: reposiciones
    public record ReposicionFila(UUID id, long numero, String codigo, UUID asesorId, String asesor, UUID agenciaId,
                                 String agencia, String estado, String estadoEtiqueta, String motivo,
                                 BigDecimal montoSolicitado, BigDecimal montoAutorizado, BigDecimal montoEnviado,
                                 BigDecimal totalRecibido, BigDecimal remanenteCerrado, BigDecimal pendienteRecepcion,
                                 BigDecimal saldoAlSolicitar, BigDecimal capacidadAlSolicitar,
                                 int incidenciasAbiertas, Instant creadoEn, Instant actualizadoEn) {
    }

    public record RecepcionFila(UUID id, BigDecimal importe, Instant recibidoEnDeclarado, Instant registradoEn,
                                String registradoPor, String referencia, String comentarios) {
    }

    public record IncidenciaFila(UUID id, String tipo, BigDecimal importe, String descripcion, String estado,
                                 String reportadaPor, Instant reportadaEn, String resueltaPor, Instant resueltaEn,
                                 String resolucion) {
    }

    /** Evento real de la línea de tiempo (viene de caja_auditoria; no hay pasos inventados). */
    public record EventoLinea(String accion, String etiqueta, String actor, BigDecimal importe, String detalle,
                              Instant creadoEn) {
    }

    public record CajaContexto(BigDecimal saldoActual, BigDecimal limite, BigDecimal autorizadoPendienteOtras,
                               BigDecimal capacidadLibre, BigDecimal capacidadHastaLimite) {
    }

    public record ReposicionDetalle(ReposicionFila fila, String motivoEtiqueta, String comentarios,
                                    String justificacionDecision, String decididoPor, Instant decididoEn,
                                    String enviadoPor, Instant enviadoEn, String referenciaEnvio,
                                    String cierreRemanenteMotivo, String cierreRemanentePor, Instant cierreRemanenteEn,
                                    String conciliadoPor, Instant conciliadoEn, String conciliacionNota,
                                    int version, boolean hermesVerificada, CajaContexto caja,
                                    List<RecepcionFila> recepciones, List<IncidenciaFila> incidencias,
                                    List<EventoLinea> linea, List<String> acciones, Instant ahora) {
    }

    // ------------------------------------------------------------------------------------------ pendientes y supervisión
    /** Contadores para avisos en el menú (se consultan periódicamente; no es tiempo real). */
    public record Pendientes(int solicitudesPorRevisar, int recepcionesPorRegistrar, int observadas,
                             int porConciliar, int incidenciasAbiertas, int enTransito, Instant ahora) {
    }

    public record CajaSupervision(UUID cajaId, UUID asesorId, String asesor, UUID agenciaId, String agencia, String estado,
                                  BigDecimal saldo, BigDecimal limite, BigDecimal autorizadoPendiente,
                                  BigDecimal enTransito, int recepcionesParciales, int reposicionesPorRevisar,
                                  BigDecimal diferenciasPendientes, int incidenciasAbiertas, boolean saldoCoincideConLibro,
                                  List<String> alertas) {
    }

    public record AgenciaSupervision(UUID agenciaId, String agencia, int cajas, BigDecimal saldoTotal,
                                     BigDecimal autorizadoPendiente) {
    }

    public record SupervisionResumen(List<CajaSupervision> cajas, List<AgenciaSupervision> agencias,
                                     BigDecimal saldoTotal, BigDecimal autorizadoPendienteTotal, BigDecimal enTransitoTotal,
                                     BigDecimal diferenciasPendientesTotal, int alertasTotal, Instant ahora) {
    }

    public record ReporteResumen(Instant desde, Instant hasta, BigDecimal saldoInicial, BigDecimal entradas,
                                 BigDecimal salidas, BigDecimal saldoActual, BigDecimal totalSolicitado,
                                 BigDecimal totalAutorizado, BigDecimal totalEnviado, BigDecimal totalRecibido,
                                 BigDecimal totalConciliado, BigDecimal diferenciasPendientes, int reposiciones,
                                 Instant ahora) {
    }
}
