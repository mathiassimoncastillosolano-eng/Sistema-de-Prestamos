package com.nexora.backend.prestamos.dto;

import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.entidades.Prestamo;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PrestamoRespuesta(
        UUID id,
        Long numero,
        UUID clienteId,
        UUID agenciaId,
        UUID asesorId,
        String moneda,
        BigDecimal capital,
        int plazoMeses,
        BigDecimal tea,
        LocalDate fechaDesembolso,
        LocalDate fechaPrimerVencimiento,
        String estado,
        BigDecimal cuotaMensual,
        BigDecimal totalIntereses,
        BigDecimal totalContractual,
        List<CuotaRespuesta> cuotas) {

    public record CuotaRespuesta(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo) { }

    public static PrestamoRespuesta de(Prestamo p, Long numero, Cronograma c) {
        List<CuotaRespuesta> cuotas = c.cuotas().stream()
                .map(q -> new CuotaRespuesta(q.numero(), q.fechaVencimiento(), q.capital(),
                        q.interes(), q.importeCuota(), q.saldo()))
                .toList();
        return new PrestamoRespuesta(
                p.getId(), numero, p.getClienteId(), p.getAgenciaId(), p.getAsesorId(),
                p.getMoneda(), p.getCapital(), p.getPlazoMeses(), p.getTea(),
                p.getFechaDesembolso(), cuotas.get(0).fechaVencimiento(), p.getEstado(),
                c.cuotaMensual(), c.totalIntereses(), c.totalContractual(), cuotas);
    }
}