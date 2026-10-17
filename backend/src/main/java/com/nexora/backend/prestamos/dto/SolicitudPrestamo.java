package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Lo único que envía el asesor. Fecha de desembolso, asesor, agencia, tasa y estado
 * los decide el servidor. {@code moneda} es opcional: si viene, debe ser PEN.
 */
public record SolicitudPrestamo(
        UUID clienteId,
        BigDecimal capital,
        Integer plazoMeses,
        String moneda,
        String observaciones) { }