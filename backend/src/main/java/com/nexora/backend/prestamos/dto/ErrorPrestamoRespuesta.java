package com.nexora.backend.prestamos.dto;

import java.util.Map;

public record ErrorPrestamoRespuesta(
        String codigo,
        String mensaje,
        Map<String, Object> detalle) {
}