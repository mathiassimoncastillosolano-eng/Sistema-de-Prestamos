
package com.nexora.backend.clientes.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.clientes.dto.ClienteListadoDTO;
import com.nexora.backend.clientes.dto.ClienteRespuestaDTO;
import com.nexora.backend.clientes.dto.RegistroClienteDTO;
import com.nexora.backend.clientes.entidades.Cliente;
import com.nexora.backend.clientes.servicios.ClienteServicio;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.nexora.backend.clientes.dto.ConsultaDniRespuestaDTO;
import com.nexora.backend.clientes.repositorios.ClienteRepositorio;
import com.nexora.backend.clientes.servicios.ApiPeruCliente;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/clientes")
public class ClienteControlador {

    private static final String ATRIBUTO_PERFIL = "nexora.perfil";
    private final ClienteServicio clienteServicio;
    private final ClienteRepositorio clienteRepositorio;
    private final ApiPeruCliente apiPeruCliente;

    public ClienteControlador(ClienteServicio clienteServicio, ClienteRepositorio clienteRepositorio, ApiPeruCliente apiPeruCliente) {
        this.clienteServicio = clienteServicio;
        this.clienteRepositorio = clienteRepositorio;
        this.apiPeruCliente = apiPeruCliente;
    }

    @PostMapping
    public ResponseEntity<Cliente> registrar(
            @RequestBody RegistroClienteDTO request,
            HttpServletRequest peticion) {

        Perfil perfil = (Perfil) peticion.getAttribute(ATRIBUTO_PERFIL);

        if (perfil == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        UUID agenciaId = perfil.getAgencia() != null
                ? perfil.getAgencia().getId()
                : null;

        if (agenciaId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Cliente cliente = clienteServicio.registrar(
                request,
                agenciaId,
                perfil.getId()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(cliente);
    }


    @GetMapping
    public List<ClienteListadoDTO> listar() {
        List<ClienteListadoDTO> respuesta = new ArrayList<>();

        for (Cliente cliente : clienteServicio.listar()) {
            respuesta.add(ClienteListadoDTO.desde(cliente));
        }

        return respuesta;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteRespuestaDTO> consultar(@PathVariable UUID id) {
        Optional<Cliente> cliente = clienteServicio.consultar(id);
        if (cliente.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ClienteRespuestaDTO.desde(cliente.get()));
    }
    @GetMapping("/consulta-dni")
    public ConsultaDniRespuestaDTO consultarDni(
            @RequestParam String dni) {
        if (clienteRepositorio.existsByNumeroDocumento(dni)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Este DNI ya está registrado.");
        }

        JsonNode respuesta = apiPeruCliente.consultarDni(dni);

        if (respuesta == null
                || !respuesta.path("success").asBoolean()
                || respuesta.path("data").path("nombre_completo").isMissingNode()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No se encontraron datos para ese DNI.");
        }

        String nombreCompleto = respuesta
                .path("data")
                .path("nombre_completo")
                .asText();

        return new ConsultaDniRespuestaDTO(dni, nombreCompleto);
    }

}
