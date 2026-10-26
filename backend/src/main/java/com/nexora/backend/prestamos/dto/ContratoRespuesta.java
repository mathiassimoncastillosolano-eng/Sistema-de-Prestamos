package com.nexora.backend.prestamos.dto;

/**
 * Contrato de un préstamo. {@code datos} es el JSON EXACTO de la instantánea (ContratoPrestamo.Datos) como texto: el
 * navegador lo interpreta y dibuja el PDF; nunca se recalcula. {@code huella} es su SHA-256.
 * Borrador: version 0, sin código y sin guardar. Definitivo: viene de contratos_prestamo.
 */
public record ContratoRespuesta(
        String estado,
        String codigo,
        int version,
        int totalVersiones,
        String plantillaVersion,
        /** yyyy-MM-dd HH:mm (America/Lima). */
        String generadoEn,
        String huella,
        String datos) { }
