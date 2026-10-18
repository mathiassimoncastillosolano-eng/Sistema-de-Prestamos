package com.nexora.backend.clientes.dto;

public record ConsultaClienteRespuestaDTO(
        String tipoDocumento,
        String numeroDocumento,
        String nombre,
        String dniTitular,
        String domicilio,
        String estadoSunat,
        String condicionSunat,
        String representanteNombre,
        String representanteDni,
        boolean habilitado,
        String motivo) {
}