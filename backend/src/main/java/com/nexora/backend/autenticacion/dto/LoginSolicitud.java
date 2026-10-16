package com.nexora.backend.autenticacion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpo de POST /api/auth/login. */
public record LoginSolicitud(
        @NotBlank @Size(max = 254) String correo,
        @NotBlank @Size(max = 128) String clave) {

    /** Un record imprime todos sus campos: se redefine para que la clave jamas llegue a un log. */
    @Override
    public String toString() {
        return "LoginSolicitud[correo=***, clave=***]";
    }
}
