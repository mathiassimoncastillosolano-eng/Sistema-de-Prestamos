package com.nexora.backend.dashboard.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Todo lo que necesita el dashboard: agencias, clientes y préstamos con sus cuotas. Los indicadores se calculan en el frontend.
 * {@code registrado} es la fecha y hora de alta en Lima ("yyyy-MM-dd HH:mm"), para la actividad reciente.
 */
public record CarteraRespuesta(
        LocalDate hoy,
        List<String> agencias,
        List<ClienteFila> clientes,
        List<PrestamoFila> prestamos) {

    public record ClienteFila(
            UUID id,
            String nombre,
            String tipoDocumento,
            String numeroDocumento,
            String telefono,
            String agencia,
            String asesor,
            LocalDate alta,
            String registrado) { }

    public record PrestamoFila(
            UUID id,
            long numero,
            UUID clienteId,
            String agencia,
            String asesor,
            BigDecimal capital,
            int plazoMeses,
            BigDecimal tea,
            LocalDate fechaDesembolso,
            String registrado,
            List<CuotaFila> cuotas) { }

    public record CuotaFila(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo,
            boolean pagada) { }
}
