package com.nexora.backend.prestamos.excepciones;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Error de negocio del módulo de préstamos, con código estable para el frontend. */
public class PrestamoException extends RuntimeException {

    public enum Codigo {
        DATOS_INVALIDOS(HttpStatus.BAD_REQUEST),
        SIN_PERMISO(HttpStatus.FORBIDDEN),
        CLIENTE_NO_ENCONTRADO(HttpStatus.NOT_FOUND),
        CLIENTE_NO_APTO(HttpStatus.UNPROCESSABLE_ENTITY),
        CAPITAL_BAJO_MINIMO(HttpStatus.UNPROCESSABLE_ENTITY),
        PLAZO_FUERA_DE_RANGO(HttpStatus.UNPROCESSABLE_ENTITY),
        MONEDA_NO_PERMITIDA(HttpStatus.UNPROCESSABLE_ENTITY),
        LIMITE_EXCEDIDO(HttpStatus.UNPROCESSABLE_ENTITY);

        private final HttpStatus estado;

        Codigo(HttpStatus estado) {
            this.estado = estado;
        }

        public HttpStatus estado() { return estado; }
    }

    private final Codigo codigo;
    private final Map<String, Object> detalle;

    public PrestamoException(Codigo codigo, String mensaje) {
        this(codigo, mensaje, Map.of());
    }

    public PrestamoException(Codigo codigo, String mensaje, Map<String, Object> detalle) {
        super(mensaje);
        this.codigo = codigo;
        this.detalle = detalle;
    }

    public Codigo getCodigo() { return codigo; }
    public Map<String, Object> getDetalle() { return detalle; }
}