package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.CapacidadEndeudamiento;
import com.nexora.backend.prestamos.dominio.LimiteDiarioAsesor;
import com.nexora.backend.prestamos.dto.CondicionesRespuesta;
import com.nexora.backend.prestamos.dto.PrestamoDetalle;
import com.nexora.backend.prestamos.dto.PrestamoListado;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.dto.SimulacionRespuesta;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.dto.SolicitudSimulacion;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoConsultaServicio;
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
    private final PrestamoConsultaServicio consultas;

    public PrestamoControlador(PrestamoServicio servicio, PrestamoConsultaServicio consultas) {
        this.servicio = servicio;
        this.consultas = consultas;
    }

    @PostMapping
    public ResponseEntity<PrestamoRespuesta> registrar(
            HttpServletRequest request,
            @RequestBody SolicitudPrestamo solicitud) {
        PrestamoRespuesta respuesta = servicio.registrar(perfilDe(request), solicitud);
        return ResponseEntity.status(HttpStatus.CREATED).body(respuesta);
    }

    /** Fecha de desembolso, primera cuota y reglas vigentes (con la fecha de Lima). No escribe nada. */
    @GetMapping("/condiciones")
    public CondicionesRespuesta condiciones() {
        return servicio.condiciones();
    }

    /** Cronograma que se guardaría hoy con ese capital y plazo. No escribe nada. */
    @PostMapping("/simulacion")
    public SimulacionRespuesta simular(@RequestBody SolicitudSimulacion solicitud) {
        return servicio.simular(solicitud);
    }

    /** Listado de préstamos del alcance de la sesión (gerencia: todos; asesor: su agencia). */
    @GetMapping
    public List<PrestamoListado> listar(HttpServletRequest request) {
        return consultas.listar(perfilDe(request));
    }

    /** Préstamos de un cliente (detalle del cliente). Cualquier usuario autenticado, igual que la consulta. */
    @GetMapping(params = "clienteId")
    public List<PrestamoResumen> listarPorCliente(@RequestParam UUID clienteId) {
        return consultas.listarPorCliente(clienteId);
    }

    /** Capacidad de endeudamiento del cliente en toda la empresa (perfil y solicitud). No escribe nada. */
    @GetMapping("/capacidad")
    public CapacidadEndeudamiento capacidad(@RequestParam UUID clienteId) {
        return consultas.capacidad(clienteId);
    }

    /** Límite diario del asesor en sesión (colocado hoy y disponible). El asesor sale de la sesión, nunca de la URL. */
    @GetMapping("/limite-diario")
    public LimiteDiarioAsesor limiteDiario(HttpServletRequest request) {
        return servicio.limiteDiario(perfilDe(request));
    }

    /** Detalle del préstamo + cronograma. Cualquier usuario autenticado (la matriz de permisos PQ-15 sigue pendiente). */
    @GetMapping("/{id}")
    public PrestamoDetalle consultar(@PathVariable UUID id) {
        return consultas.detalle(id);
    }

    private static Perfil perfilDe(HttpServletRequest request) {
        Object atributo = request.getAttribute(ATRIBUTO_PERFIL);
        if (!(atributo instanceof Perfil perfil)) {
            throw new PrestamoException(
                    PrestamoException.Codigo.SIN_PERMISO,
                    "No se pudo identificar al usuario de la sesión.",
                    Map.of());
        }
        return perfil;
    }
}
