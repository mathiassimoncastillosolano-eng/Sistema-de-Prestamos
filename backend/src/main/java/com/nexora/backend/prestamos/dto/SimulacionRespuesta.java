package com.nexora.backend.prestamos.dto;

import com.nexora.backend.prestamos.dto.PrestamoRespuesta.CuotaRespuesta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Cronograma calculado con la misma fórmula y la misma fecha que se usarán al registrar. No se guarda nada. */
public record SimulacionRespuesta(
        String moneda,
        BigDecimal capital,
        int plazoMeses,
        BigDecimal tea,
        LocalDate fechaDesembolso,
        LocalDate fechaPrimerVencimiento,
        BigDecimal cuotaMensual,
        BigDecimal totalIntereses,
        BigDecimal totalContractual,
        List<CuotaRespuesta> cuotas) { }
