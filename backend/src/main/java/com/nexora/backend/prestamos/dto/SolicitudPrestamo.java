package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Lo único que envía el asesor. Fecha de desembolso, asesor, agencia, tasa y estado
 * los decide el servidor. {@code moneda} es opcional: si viene, debe ser PEN.
 *
 * <p>{@code fechaDesembolsoEsperada} y {@code totalContractualEsperado} son opcionales: son lo que el asesor revisó en la
 * pantalla. Si el servidor calcula otra cosa (por ejemplo, cambió el día entre la revisión y la confirmación), rechaza el
 * registro con CONDICIONES_DESACTUALIZADAS en lugar de guardar algo distinto de lo revisado.
 */
public record SolicitudPrestamo(
        UUID clienteId,
        BigDecimal capital,
        Integer plazoMeses,
        String moneda,
        String observaciones,
        LocalDate fechaDesembolsoEsperada,
        BigDecimal totalContractualEsperado) { }
