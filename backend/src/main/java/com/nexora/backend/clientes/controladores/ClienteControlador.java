package com.nexora.backend.clientes.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.clientes.dto.ActualizarContactoDTO;
import com.nexora.backend.clientes.dto.ClienteListadoDTO;
import com.nexora.backend.clientes.dto.ClienteRespuestaDTO;
import com.nexora.backend.clientes.dto.ConsultaClienteRespuestaDTO;
import com.nexora.backend.clientes.dto.RegistroClienteDTO;
import com.nexora.backend.clientes.entidades.Cliente;
import com.nexora.backend.clientes.excepciones.ClienteException;
import com.nexora.backend.clientes.servicios.ClienteServicio;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clientes")
public class ClienteControlador {

    private static final String ATRIBUTO_PERFIL = "nexora.perfil";
    private final ClienteServicio clienteServicio;

    public ClienteControlador(ClienteServicio clienteServicio) {
        this.clienteServicio = clienteServicio;
    }

    @PostMapping
    public ResponseEntity<ClienteRespuestaDTO> registrar(
            @Valid @RequestBody RegistroClienteDTO request,
            HttpServletRequest peticion) {
        Perfil perfil = perfilDe(peticion);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clienteServicio.registrar(request, perfil));
    }

    @GetMapping("/consulta")
    public ConsultaClienteRespuestaDTO consultarDocumento(
            @RequestParam String tipo,
            @RequestParam String numero,
            HttpServletRequest peticion) {
        Perfil perfil = perfilDe(peticion);
        if (perfil.getAgencia() == null) {
            throw new ClienteException(ClienteException.Codigo.AGENCIA_NO_ASIGNADA);
        }
        return clienteServicio.consultar(tipo, numero, perfil.getId());
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
    public ResponseEntity<ClienteRespuestaDTO> consultarCliente(@PathVariable UUID id) {
        Optional<ClienteRespuestaDTO> cliente = clienteServicio.consultar(id);
        if (cliente.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(cliente.get());
    }

    @PatchMapping("/{id}/contacto")
    public ClienteRespuestaDTO actualizarContacto(
            @PathVariable UUID id,
            @Valid @RequestBody ActualizarContactoDTO request,
            HttpServletRequest peticion) {
        return clienteServicio.actualizarContacto(id, request, perfilDe(peticion));
    }

    private static Perfil perfilDe(HttpServletRequest peticion) {
        Perfil perfil = (Perfil) peticion.getAttribute(ATRIBUTO_PERFIL);
        if (perfil == null) {
            throw new ClienteException(ClienteException.Codigo.NO_AUTENTICADO);
        }
        return perfil;
    }
}
