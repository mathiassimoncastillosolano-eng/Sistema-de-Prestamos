
package com.nexora.backend.clientes.dto;

import com.nexora.backend.clientes.entidades.Cliente;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ClienteRespuestaDTO(
        UUID id,
        Long numero,
        String tipoDocumento,
        String numeroDocumento,
        String nombre,
        String telefono,
        String dniTitular,
        String domicilio,
        String estadoSunat,
        String condicionSunat,
        String representanteNombre,
        String representanteDni,
        UUID agenciaId,
        OffsetDateTime creadoEn
) {
    public static ClienteRespuestaDTO desde(Cliente cliente) {
        return new ClienteRespuestaDTO(
                cliente.getId(),
                cliente.getNumero(),
                cliente.getTipoDocumento(),
                cliente.getNumeroDocumento(),
                cliente.getNombre(),
                cliente.getTelefono(),
                cliente.getDniTitular(),
                cliente.getDomicilio(),
                cliente.getEstadoSunat(),
                cliente.getCondicionSunat(),
                cliente.getRepresentanteNombre(),
                cliente.getRepresentanteDni(),
                cliente.getAgenciaId(),
                cliente.getCreadoEn()
        );
    }
}
