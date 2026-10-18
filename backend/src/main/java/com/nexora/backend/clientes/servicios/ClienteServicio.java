
package com.nexora.backend.clientes.servicios;

import com.nexora.backend.clientes.dto.RegistroClienteDTO;
import com.nexora.backend.clientes.entidades.Cliente;
import com.nexora.backend.clientes.repositorios.ClienteRepositorio;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClienteServicio {

    private final ClienteRepositorio clienteRepositorio;

    public ClienteServicio(ClienteRepositorio clienteRepositorio) {
        this.clienteRepositorio = clienteRepositorio;
    }

    @Transactional(readOnly = true)
    public List<Cliente> listar() {
        return clienteRepositorio.findAll(Sort.by("nombre").ascending());
    }

    @Transactional(readOnly = true)
    public Optional<Cliente> consultar(UUID id) {
        return clienteRepositorio.findById(id);
    }

    @Transactional
    public Cliente registrar(RegistroClienteDTO dto, UUID agenciaId, UUID creadoPor) {

        String tipo = dto.getTipoDocumento();
        String documento = dto.getNumeroDocumento();

        if (clienteRepositorio.existsByNumeroDocumento(documento)) {
            throw new IllegalArgumentException(
                "Ya existe un cliente registrado con ese documento."
            );
        }

        validarDatosPorTipo(dto);

        Cliente cliente = new Cliente(
        tipo,
        documento,
        dto.getNombre().trim(),
        dto.getTelefono(),
        dto.getDniTitular(),
        dto.getDomicilio(),
        dto.getEstadoSunat(),
        dto.getCondicionSunat(),
        dto.getRepresentanteNombre(),
        dto.getRepresentanteDni(),
        agenciaId,
        creadoPor
        );

        return clienteRepositorio.save(cliente);
    }

    private void validarDatosPorTipo(RegistroClienteDTO request) {
        switch (request.getTipoDocumento()) {
            case "DNI" -> {
                exigirVacios(
                    request.getDniTitular(),
                    request.getDomicilio(),
                    request.getEstadoSunat(),
                    request.getCondicionSunat(),
                    request.getRepresentanteNombre(),
                    request.getRepresentanteDni()
                );
            }
            case "RUC 10" -> {
                exigirPresentes(
                    request.getDniTitular(),
                    request.getEstadoSunat(),
                    request.getCondicionSunat()
                );
                exigirVacios(
                    request.getDomicilio(),
                    request.getRepresentanteNombre(),
                    request.getRepresentanteDni()
                );
            }
            case "RUC 20" -> {
                exigirPresentes(
                    request.getDomicilio(),
                    request.getEstadoSunat(),
                    request.getCondicionSunat(),
                    request.getRepresentanteNombre(),
                    request.getRepresentanteDni()
                );
                exigirVacios(request.getDniTitular());
            }
            default -> throw new IllegalArgumentException(
                "Tipo de documento no válido."
            );
        }
    }

    private void exigirPresentes(String... valores) {
        for (String valor : valores) {
            if (valor == null || valor.isBlank()) {
                throw new IllegalArgumentException(
                    "Faltan datos obligatorios para el tipo de documento."
                );
            }
        }
    }

    private void exigirVacios(String... valores) {
        for (String valor : valores) {
            if (valor != null && !valor.isBlank()) {
                throw new IllegalArgumentException(
                    "Se enviaron datos que no corresponden al tipo de documento."
                );
            }
        }
    }
}
