package com.nexora.backend.caja.hermes;

/** Respuesta del verificador. {@code referencia} es el identificador de la verificación en Hermes (si lo entrega). */
public record ResultadoHermes(Estado estado, String referencia) {

    public enum Estado { VALIDO, INVALIDO, EXPIRADO, NO_CONFIGURADO, NO_DISPONIBLE }

    public static ResultadoHermes valido(String referencia) {
        return new ResultadoHermes(Estado.VALIDO, referencia);
    }

    public static ResultadoHermes de(Estado estado) {
        return new ResultadoHermes(estado, null);
    }

    public boolean esValido() {
        return estado == Estado.VALIDO;
    }
}
