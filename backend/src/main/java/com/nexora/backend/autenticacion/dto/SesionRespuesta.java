package com.nexora.backend.autenticacion.dto;

import java.util.UUID;

/** Lo unico que el navegador recibe sobre la identidad. No incluye clave_hash ni ningun secreto. */
public record SesionRespuesta(PerfilDto perfil, AgenciaDto agencia) {

    public record PerfilDto(UUID id, String nombres, String apellidos, String correo, String rol, UUID agenciaId, boolean activo) { }

    public record AgenciaDto(UUID id, String nombre, boolean activa, UbicacionDto ubicacion) { }

    public record UbicacionDto(String departamento, String provincia, String distrito, String direccion) { }
}
