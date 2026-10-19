package com.nexora.backend.clientes.dto;

import com.nexora.backend.clientes.entidades.Cliente;
import java.util.UUID;

public record ClienteListadoDTO(
        UUID id,
        Long numero,
        String tipoDocumento,
        String numeroDocumento,
        String nombre,
        String telefono,
        String correo,
        String estado
) {
    public static ClienteListadoDTO desde(Cliente cliente) {
        return new ClienteListadoDTO(
                cliente.getId(),
                cliente.getNumero(),
                cliente.getTipoDocumento(),
                cliente.getNumeroDocumento(),
                cliente.getNombre(),
                cliente.getTelefono(),
                cliente.getCorreo(),
                cliente.getEstado()
        );
    }
}

