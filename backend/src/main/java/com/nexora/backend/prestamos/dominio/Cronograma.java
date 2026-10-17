package com.nexora.backend.prestamos.dominio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Resultado del cálculo: cuotas + totales contractuales. */
public record Cronograma(
        List<Cuota> cuotas,
        BigDecimal cuotaMensual,
        BigDecimal totalIntereses,
        BigDecimal totalContractual) {

    public record Cuota(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo) {
    }
}