package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/prestamos")
public class PrestamoControlador {

    private static final String ATRIBUTO_PERFIL = "nexora.perfil";

    private final PrestamoServicio servicio;

    public PrestamoControlador(PrestamoServicio servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    public ResponseEntity<PrestamoRespuesta> registrar(
            HttpServletRequest request,
            @RequestBody SolicitudPrestamo solicitud) {

        Object atributo = request.getAttribute(ATRIBUTO_PERFIL);
        if (!(atributo instanceof Perfil perfil)) {
            throw new PrestamoException(
                    PrestamoException.Codigo.SIN_PERMISO,
                    "No se pudo identificar al asesor de la sesión.",
                    Map.of());
        }

        PrestamoRespuesta respuesta = servicio.registrar(perfil, solicitud);
        return ResponseEntity.status(HttpStatus.CREATED).body(respuesta);
    }

    /** Préstamos de un cliente (detalle del cliente). Cualquier usuario autenticado, igual que la consulta. */
    @GetMapping(params = "clienteId")
    public List<PrestamoResumen> listarPorCliente(@RequestParam UUID clienteId) {
        return servicio.listarPorCliente(clienteId);
    }

    /** Detalle del préstamo + cronograma. Cualquier usuario autenticado (la matriz de permisos PQ-15 sigue pendiente). */
    @GetMapping("/{id}")
    public PrestamoRespuesta consultar(@PathVariable UUID id) {
        return servicio.consultar(id);
    }
}