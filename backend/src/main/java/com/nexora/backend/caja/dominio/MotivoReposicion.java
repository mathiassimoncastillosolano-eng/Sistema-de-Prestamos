package com.nexora.backend.caja.dominio;

import java.util.Optional;

/** Motivos de solicitud (CHECK reposiciones_motivo_ck). */
public enum MotivoReposicion {
    DESEMBOLSOS_PROGRAMADOS("Desembolsos programados"),
    ALTA_DEMANDA("Alta demanda de operaciones"),
    RECUPERACION_CAPACIDAD("Recuperación de capacidad operativa"),
    OTRO("Otro motivo");

    private final String etiqueta;

    MotivoReposicion(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String etiqueta() {
        return etiqueta;
    }

    public static Optional<MotivoReposicion> de(String valor) {
        if (valor == null) return Optional.empty();
        for (MotivoReposicion m : values()) {
            if (m.name().equals(valor.trim())) return Optional.of(m);
        }
        return Optional.empty();
    }
}
