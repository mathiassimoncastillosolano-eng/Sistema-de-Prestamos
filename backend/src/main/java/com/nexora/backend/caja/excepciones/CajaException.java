package com.nexora.backend.caja.excepciones;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Error de negocio del módulo de caja y reposiciones, con código estable para el frontend. */
public class CajaException extends RuntimeException {

    public enum Codigo {
        DATOS_INVALIDOS(HttpStatus.BAD_REQUEST),
        SIN_PERMISO(HttpStatus.FORBIDDEN),
        CAJA_NO_ENCONTRADA(HttpStatus.NOT_FOUND),
        REPOSICION_NO_ENCONTRADA(HttpStatus.NOT_FOUND),
        INCIDENCIA_NO_ENCONTRADA(HttpStatus.NOT_FOUND),
        CAJA_CERRADA(HttpStatus.CONFLICT),
        REPOSICION_EN_TRAMITE(HttpStatus.CONFLICT),
        MONTO_EXCEDE_CAPACIDAD(HttpStatus.UNPROCESSABLE_ENTITY),
        ESTADO_INVALIDO(HttpStatus.CONFLICT),
        VERSION_DESACTUALIZADA(HttpStatus.CONFLICT),
        CONFLICTO_CONCURRENCIA(HttpStatus.CONFLICT),
        CODIGO_HERMES_FORMATO(HttpStatus.UNPROCESSABLE_ENTITY),
        CODIGO_HERMES_INVALIDO(HttpStatus.UNPROCESSABLE_ENTITY),
        CODIGO_HERMES_REUTILIZADO(HttpStatus.UNPROCESSABLE_ENTITY),
        HERMES_NO_CONFIGURADO(HttpStatus.SERVICE_UNAVAILABLE),
        HERMES_NO_DISPONIBLE(HttpStatus.SERVICE_UNAVAILABLE),
        HERMES_BLOQUEADO(HttpStatus.TOO_MANY_REQUESTS),
        EXCEDE_AUTORIZADO(HttpStatus.UNPROCESSABLE_ENTITY),
        EXCEDE_LIMITE_CAJA(HttpStatus.UNPROCESSABLE_ENTITY),
        FECHA_RECEPCION_INVALIDA(HttpStatus.UNPROCESSABLE_ENTITY),
        INCIDENCIAS_ABIERTAS(HttpStatus.CONFLICT),
        NADA_PENDIENTE(HttpStatus.CONFLICT),
        INCONSISTENCIA_DATOS(HttpStatus.CONFLICT);

        private final HttpStatus estado;

        Codigo(HttpStatus estado) {
            this.estado = estado;
        }

        public HttpStatus estado() { return estado; }
    }

    private final Codigo codigo;
    private final Map<String, Object> detalle;

    public CajaException(Codigo codigo, String mensaje) {
        this(codigo, mensaje, Map.of());
    }

    public CajaException(Codigo codigo, String mensaje, Map<String, Object> detalle) {
        super(mensaje);
        this.codigo = codigo;
        this.detalle = detalle;
    }

    public Codigo getCodigo() { return codigo; }
    public Map<String, Object> getDetalle() { return detalle; }
}
