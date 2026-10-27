package com.nexora.backend.caja.hermes;

import java.math.BigDecimal;
import java.util.UUID;

/** Lo que Hermes necesita para validar: el código (que nunca se guarda ni se registra) y a qué operación se refiere. */
public record SolicitudHermes(String codigo, UUID reposicionId, long numeroReposicion, BigDecimal importeAutorizado,
                              UUID autorizadorId, UUID correlacionId) {

    @Override
    public String toString() { // evita que el código llegue a logs por accidente
        return "SolicitudHermes[reposicion=" + numeroReposicion + ", autorizador=" + autorizadorId + "]";
    }
}
