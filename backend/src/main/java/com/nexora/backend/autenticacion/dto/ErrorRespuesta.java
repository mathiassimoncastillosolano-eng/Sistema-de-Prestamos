package com.nexora.backend.autenticacion.dto;

/** Error estable para el cliente: {@code codigo} es el contrato; {@code mensaje} es solo orientativo. */
public record ErrorRespuesta(String codigo, String mensaje) { }
