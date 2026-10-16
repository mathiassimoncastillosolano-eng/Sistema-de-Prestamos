package com.nexora.backend.autenticacion.excepciones;

import org.springframework.http.HttpStatus;

/** Fallo de autenticacion/acceso con un codigo estable que el frontend traduce a un mensaje. */
public class AutenticacionException extends RuntimeException {

    public enum Codigo {
        CREDENCIALES_INVALIDAS(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos."),
        CUENTA_DESACTIVADA(HttpStatus.FORBIDDEN, "Tu cuenta está desactivada. Contacta con el administrador."),
        AGENCIA_INACTIVA(HttpStatus.FORBIDDEN, "Tu agencia está inactiva. Contacta con el administrador."),
        AGENCIA_NO_ASIGNADA(HttpStatus.FORBIDDEN, "Tu cuenta no tiene una agencia asignada. Contacta con el administrador."),
        ROL_NO_RECONOCIDO(HttpStatus.FORBIDDEN, "Tu cuenta tiene un rol no reconocido. Contacta con el administrador."),
        DEMASIADOS_INTENTOS(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo."),
        NO_AUTENTICADO(HttpStatus.UNAUTHORIZED, "Tu sesión ha expirado. Inicia sesión nuevamente.");

        private final HttpStatus estado;
        private final String mensaje;

        Codigo(HttpStatus estado, String mensaje) {
            this.estado = estado;
            this.mensaje = mensaje;
        }

        public HttpStatus estado() { return estado; }
        public String mensaje() { return mensaje; }
    }

    private final Codigo codigo;

    public AutenticacionException(Codigo codigo) {
        super(codigo.name());
        this.codigo = codigo;
    }

    public Codigo getCodigo() { return codigo; }
}
