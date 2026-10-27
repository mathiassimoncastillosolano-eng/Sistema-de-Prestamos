package com.nexora.backend.caja.dominio;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

/**
 * Estados de una reposición y transiciones permitidas (CHECK reposiciones_estado_ck). Cualquier cambio de estado pasa por
 * {@link #puedePasarA}: no hay saltos arbitrarios.
 *
 * <pre>
 * PENDIENTE_APROBACION -> OBSERVADA | APROBADA | RECHAZADA | CANCELADA
 * OBSERVADA            -> PENDIENTE_APROBACION | RECHAZADA | CANCELADA
 * APROBADA             -> EN_TRANSITO | RECEPCION_PARCIAL | RECIBIDA | CANCELADA
 * EN_TRANSITO          -> RECEPCION_PARCIAL | RECIBIDA | CANCELADA
 * RECEPCION_PARCIAL    -> RECEPCION_PARCIAL | RECIBIDA
 * RECIBIDA             -> COMPLETADA            (conciliación)
 * COMPLETADA, RECHAZADA, CANCELADA: finales
 * </pre>
 */
public enum EstadoReposicion {
    PENDIENTE_APROBACION("Pendiente de aprobación"),
    OBSERVADA("Observada por gerencia"),
    APROBADA("Aprobada, pendiente de envío"),
    EN_TRANSITO("En tránsito"),
    RECEPCION_PARCIAL("Recepción parcial"),
    RECIBIDA("Recibida, pendiente de conciliación"),
    COMPLETADA("Completada"),
    RECHAZADA("Rechazada"),
    CANCELADA("Cancelada");

    private final String etiqueta;

    EstadoReposicion(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String etiqueta() {
        return etiqueta;
    }

    /** Estados "abiertos": mientras la caja tenga una en uno de ellos no se puede pedir otra (índice único parcial). */
    private static final Set<EstadoReposicion> ABIERTAS =
            EnumSet.of(PENDIENTE_APROBACION, OBSERVADA, APROBADA, EN_TRANSITO, RECEPCION_PARCIAL);
    /** Estados con dinero autorizado y aún no recibido: reservan capacidad de la caja. */
    private static final Set<EstadoReposicion> RESERVAN =
            EnumSet.of(APROBADA, EN_TRANSITO, RECEPCION_PARCIAL);
    private static final Set<EstadoReposicion> RECIBEN =
            EnumSet.of(APROBADA, EN_TRANSITO, RECEPCION_PARCIAL);

    public boolean abierta() {
        return ABIERTAS.contains(this);
    }

    public boolean reservaCapacidad() {
        return RESERVAN.contains(this);
    }

    public boolean admiteRecepcion() {
        return RECIBEN.contains(this);
    }

    public boolean esFinal() {
        return this == COMPLETADA || this == RECHAZADA || this == CANCELADA;
    }

    public boolean puedePasarA(EstadoReposicion destino) {
        return switch (this) {
            case PENDIENTE_APROBACION -> destino == OBSERVADA || destino == APROBADA || destino == RECHAZADA || destino == CANCELADA;
            case OBSERVADA -> destino == PENDIENTE_APROBACION || destino == RECHAZADA || destino == CANCELADA;
            case APROBADA -> destino == EN_TRANSITO || destino == RECEPCION_PARCIAL || destino == RECIBIDA || destino == CANCELADA;
            case EN_TRANSITO -> destino == RECEPCION_PARCIAL || destino == RECIBIDA || destino == CANCELADA;
            case RECEPCION_PARCIAL -> destino == RECEPCION_PARCIAL || destino == RECIBIDA;
            case RECIBIDA -> destino == COMPLETADA;
            case COMPLETADA, RECHAZADA, CANCELADA -> false;
        };
    }

    public static Optional<EstadoReposicion> de(String valor) {
        if (valor == null) return Optional.empty();
        for (EstadoReposicion e : values()) {
            if (e.name().equals(valor.trim())) return Optional.of(e);
        }
        return Optional.empty();
    }
}
