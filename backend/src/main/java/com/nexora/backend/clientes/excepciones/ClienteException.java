package com.nexora.backend.clientes.excepciones;

import org.springframework.http.HttpStatus;


public class ClienteException extends RuntimeException {

    public enum Codigo {
        NO_AUTENTICADO(HttpStatus.UNAUTHORIZED, "Tu sesión ha expirado. Inicia sesión nuevamente."),
        AGENCIA_NO_ASIGNADA(HttpStatus.FORBIDDEN,
                "Tu cuenta no tiene una agencia asignada. Solo un asesor de agencia puede registrar clientes."),
        SOLICITUD_INVALIDA(HttpStatus.BAD_REQUEST, "Revisa los datos enviados."),
        DOCUMENTO_INVALIDO(HttpStatus.BAD_REQUEST, "El número de documento no es válido."),
        DOCUMENTO_REGISTRADO(HttpStatus.CONFLICT, "Este documento ya está registrado como cliente."),
        DOCUMENTO_NO_ENCONTRADO(HttpStatus.NOT_FOUND, "No se encontraron datos para ese documento."),
        RUC_NO_COINCIDE(HttpStatus.UNPROCESSABLE_CONTENT, "El RUC no corresponde al DNI del titular."),
        CLIENTE_NO_HABILITADO(HttpStatus.UNPROCESSABLE_CONTENT,
                "El cliente no cumple los requisitos para ser registrado."),
        SERVICIO_NO_DISPONIBLE(HttpStatus.BAD_GATEWAY,
                "El servicio de consulta de documentos no está disponible. Inténtalo nuevamente en unos minutos.");

        private final HttpStatus estado;
        private final String mensaje;

        Codigo(HttpStatus estado, String mensaje) {
            this.estado = estado;
            this.mensaje = mensaje;
        }

        public HttpStatus estado() {
            return estado;
        }

        public String mensaje() {
            return mensaje;
        }
    }

    private final Codigo codigo;

    public ClienteException(Codigo codigo) {
        this(codigo, codigo.mensaje());
    }

    public ClienteException(Codigo codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public Codigo getCodigo() {
        return codigo;
    }
}