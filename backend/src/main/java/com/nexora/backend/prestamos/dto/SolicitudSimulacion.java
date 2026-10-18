package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;

/** Simulación sin cliente ni persistencia: solo capital y plazo. */
public record SolicitudSimulacion(BigDecimal capital, Integer plazoMeses) { }
