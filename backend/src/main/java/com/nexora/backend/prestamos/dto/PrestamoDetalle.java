package com.nexora.backend.prestamos.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Préstamo guardado, con su cronograma real, saldos y los eventos administrativos que existen en la BD. */
public record PrestamoDetalle(
        UUID id,
        Long numero,
        UUID clienteId,
        String clienteNombre,
        String clienteTipoDocumento,
        String clienteNumeroDocumento,
        String agenciaNombre,
        String asesorNombre,
        String moneda,
        BigDecimal capital,
        int plazoMeses,
        BigDecimal tea,
        LocalDate fechaDesembolso,
        LocalDate fechaPrimerVencimiento,
        LocalDate fechaUltimoVencimiento,
        String estado,
        String observaciones,
        BigDecimal cuotaMensual,
        BigDecimal totalIntereses,
        BigDecimal totalContractual,
        BigDecimal capitalPendiente,
        BigDecimal totalPendiente,
        LocalDate proximoVencimiento,
        int cuotasVencidas,
        List<CuotaDetalle> cuotas,
        List<EventoHistorial> historial) {

    public record CuotaDetalle(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            /** Saldo de capital tras esta cuota, según el cronograma original. */
            BigDecimal saldo,
            /** PENDIENTE | PAGADA | VENCIDA */
            String estado,
            /** Importe de la cuota que aún no figura como pagado. */
            BigDecimal importePendiente,
            long diasAtraso) { }

    /** {@code fechaHora} = yyyy-MM-dd HH:mm en America/Lima. */
    public record EventoHistorial(String fechaHora, String tipo, String descripcion, String usuario) { }
}
