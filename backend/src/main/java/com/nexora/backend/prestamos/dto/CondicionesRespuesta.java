package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Condiciones vigentes para una solicitud nueva, calculadas por el servidor con la fecha de Lima. */
public record CondicionesRespuesta(
        String moneda,
        BigDecimal tea,
        BigDecimal capitalMinimo,
        BigDecimal limiteEndeudamiento,
        int plazoMinimoMeses,
        int plazoMaximoMeses,
        String zonaHoraria,
        LocalDate fechaDesembolso,
        LocalDate fechaPrimerVencimiento) { }
