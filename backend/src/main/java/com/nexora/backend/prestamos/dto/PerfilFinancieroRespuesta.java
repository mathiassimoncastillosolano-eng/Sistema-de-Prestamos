package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Perfil financiero consolidado de un cliente: lo MISMO que valida el registro (capacidad del grupo crediticio DNI ↔ RUC 10),
 * más el detalle por integrante y los préstamos que el usuario puede ver. Los integrantes sin permiso de detalle traen sus
 * contadores de cuotas en null, y sus préstamos no se incluyen.
 */
public record PerfilFinancieroRespuesta(
        UUID clienteId,
        String tipoDocumento,
        String numeroDocumento,
        String nombre,
        BigDecimal limite,
        /** Deuda consolidada: capital pendiente de todo el grupo (base del límite). */
        BigDecimal capitalPendiente,
        BigDecimal importePendiente,
        /** max(0, límite − deuda consolidada). Si la deuda histórica supera el límite, es 0 y la deuda se muestra real. */
        BigDecimal disponible,
        BigDecimal deudaPropia,
        BigDecimal deudaVinculada,
        boolean consolidada,
        /** Cuotas de los integrantes visibles para el usuario. */
        int cuotasPendientes,
        int cuotasVencidas,
        int cuotasPagadas,
        List<IntegranteRespuesta> integrantes,
        List<PrestamoConsolidadoRespuesta> prestamos) {

    public record IntegranteRespuesta(
            UUID clienteId,
            String nombre,
            String tipoDocumento,
            String numeroDocumento,
            /** TITULAR | NEGOCIO_DEL_TITULAR | SIN_VINCULO */
            String relacion,
            boolean consultado,
            boolean detalleVisible,
            BigDecimal capitalPendiente,
            BigDecimal importePendiente,
            int prestamosConSaldo,
            Integer cuotasPendientes,
            Integer cuotasVencidas,
            Integer cuotasPagadas) { }

    public record PrestamoConsolidadoRespuesta(
            UUID id,
            Long numero,
            UUID clienteId,
            String clienteNombre,
            String clienteTipoDocumento,
            String clienteNumeroDocumento,
            BigDecimal capital,
            int plazoMeses,
            LocalDate fechaDesembolso,
            String estado,
            BigDecimal totalContractual,
            BigDecimal capitalPendiente,
            BigDecimal totalPendiente,
            LocalDate proximoVencimiento,
            int cuotasPendientes,
            int cuotasVencidas,
            int cuotasPagadas) { }
}
