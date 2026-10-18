package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Fila del listado de préstamos. Los saldos salen del cronograma guardado (ver EvaluadorCartera). */
public record PrestamoListado(
        UUID id,
        Long numero,
        UUID clienteId,
        String clienteNombre,
        String clienteTipoDocumento,
        String clienteNumeroDocumento,
        String agenciaNombre,
        String asesorNombre,
        /** true si el préstamo lo registró el usuario de la sesión. */
        boolean propio,
        BigDecimal capital,
        int plazoMeses,
        LocalDate fechaDesembolso,
        String estado,
        BigDecimal totalContractual,
        BigDecimal capitalPendiente,
        BigDecimal totalPendiente,
        LocalDate proximoVencimiento,
        int cuotasVencidas) { }
