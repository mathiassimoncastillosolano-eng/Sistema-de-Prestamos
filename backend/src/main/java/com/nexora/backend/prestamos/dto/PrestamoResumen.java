package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Fila del listado de préstamos de un cliente. Los pendientes salen del cronograma guardado:
 * como aún no hay registro de pagos, un préstamo Vigente o En mora tiene pendiente todo su capital
 * e importe contractual, y uno Cancelado no tiene nada pendiente.
 */
public record PrestamoResumen(
        UUID id,
        Long numero,
        BigDecimal capital,
        int plazoMeses,
        LocalDate fechaDesembolso,
        String estado,
        BigDecimal totalContractual,
        BigDecimal capitalPendiente,
        BigDecimal totalPendiente,
        LocalDate proximoVencimiento) { }
