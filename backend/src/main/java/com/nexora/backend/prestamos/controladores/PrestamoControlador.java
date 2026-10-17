package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

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
}