package com.nexora.backend.caja.controladores;

import com.nexora.backend.caja.dto.CajaDtos.AprobarReposicion;
import com.nexora.backend.caja.dto.CajaDtos.DecisionTexto;
import com.nexora.backend.caja.dto.CajaDtos.Despacho;
import com.nexora.backend.caja.dto.CajaDtos.NuevaIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.Pagina;
import com.nexora.backend.caja.dto.CajaDtos.Recepcion;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionDetalle;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionFila;
import com.nexora.backend.caja.dto.CajaDtos.ResolverIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.SolicitudReposicion;
import com.nexora.backend.caja.servicios.CajaConsultaServicio;
import com.nexora.backend.caja.servicios.CajaConsultaServicio.Consulta;
import com.nexora.backend.caja.servicios.ReposicionServicio;
import jakarta.servlet.http.HttpServletRequest;
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

/**
 * Reposiciones de caja. Cada acción se autoriza en el servicio con el rol del perfil de la sesión (asesor / gerencia);
 * el rol que envíe el navegador no existe ni se usa.
 */
@RestController
@RequestMapping("/api/reposiciones")
public class ReposicionControlador {

    private final ReposicionServicio servicio;
    private final CajaConsultaServicio consultas;

    public ReposicionControlador(ReposicionServicio servicio, CajaConsultaServicio consultas) {
        this.servicio = servicio;
        this.consultas = consultas;
    }

    /** Bandeja: gerencia ve todas; el asesor, solo las suyas. Filtros, orden y paginación en el servidor. */
    @GetMapping
    public Pagina<ReposicionFila> listar(HttpServletRequest request,
                                         @RequestParam(required = false) String estados,
                                         @RequestParam(required = false, name = "q") String texto,
                                         @RequestParam(required = false) UUID agenciaId,
                                         @RequestParam(required = false) UUID asesorId,
                                         @RequestParam(required = false) String desde,
                                         @RequestParam(required = false) String hasta,
                                         @RequestParam(required = false) String orden,
                                         @RequestParam(required = false) Integer pagina,
                                         @RequestParam(required = false) Integer tamano) {
        return consultas.listar(SesionPerfil.de(request),
                new Consulta(estados, texto, agenciaId, asesorId, desde, hasta, orden, pagina, tamano));
    }

    @GetMapping("/{id}")
    public ReposicionDetalle detalle(HttpServletRequest request, @PathVariable UUID id) {
        return servicio.detalle(SesionPerfil.de(request), id);
    }

    @PostMapping
    public ResponseEntity<ReposicionDetalle> solicitar(HttpServletRequest request, @RequestBody SolicitudReposicion cuerpo) {
        return ResponseEntity.status(HttpStatus.CREATED).body(servicio.solicitar(SesionPerfil.de(request), cuerpo));
    }

    @PostMapping("/{id}/aprobar")
    public ReposicionDetalle aprobar(HttpServletRequest request, @PathVariable UUID id, @RequestBody AprobarReposicion cuerpo) {
        return servicio.aprobar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/rechazar")
    public ReposicionDetalle rechazar(HttpServletRequest request, @PathVariable UUID id, @RequestBody DecisionTexto cuerpo) {
        return servicio.rechazar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/observar")
    public ReposicionDetalle observar(HttpServletRequest request, @PathVariable UUID id, @RequestBody DecisionTexto cuerpo) {
        return servicio.observar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/responder")
    public ReposicionDetalle responder(HttpServletRequest request, @PathVariable UUID id, @RequestBody DecisionTexto cuerpo) {
        return servicio.responder(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/cancelar")
    public ReposicionDetalle cancelar(HttpServletRequest request, @PathVariable UUID id, @RequestBody(required = false) DecisionTexto cuerpo) {
        return servicio.cancelar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/despachar")
    public ReposicionDetalle despachar(HttpServletRequest request, @PathVariable UUID id, @RequestBody Despacho cuerpo) {
        return servicio.despachar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/recepciones")
    public ReposicionDetalle recibir(HttpServletRequest request, @PathVariable UUID id, @RequestBody Recepcion cuerpo) {
        return servicio.registrarRecepcion(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/incidencias")
    public ReposicionDetalle incidencia(HttpServletRequest request, @PathVariable UUID id, @RequestBody NuevaIncidencia cuerpo) {
        return servicio.reportarIncidencia(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/cerrar-remanente")
    public ReposicionDetalle cerrarRemanente(HttpServletRequest request, @PathVariable UUID id, @RequestBody DecisionTexto cuerpo) {
        return servicio.cerrarRemanente(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/{id}/conciliar")
    public ReposicionDetalle conciliar(HttpServletRequest request, @PathVariable UUID id, @RequestBody(required = false) DecisionTexto cuerpo) {
        return servicio.conciliar(SesionPerfil.de(request), id, cuerpo);
    }

    @PostMapping("/incidencias/{incidenciaId}/resolver")
    public ReposicionDetalle resolver(HttpServletRequest request, @PathVariable UUID incidenciaId,
                                      @RequestBody ResolverIncidencia cuerpo) {
        return servicio.resolverIncidencia(SesionPerfil.de(request), incidenciaId, cuerpo);
    }
}
