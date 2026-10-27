package com.nexora.backend.caja.controladores;

import com.nexora.backend.caja.dto.CajaDtos.CajaResumen;
import com.nexora.backend.caja.dto.CajaDtos.Movimiento;
import com.nexora.backend.caja.dto.CajaDtos.Pagina;
import com.nexora.backend.caja.dto.CajaDtos.Pendientes;
import com.nexora.backend.caja.dto.CajaDtos.ReporteResumen;
import com.nexora.backend.caja.servicios.CajaConsultaServicio;
import com.nexora.backend.caja.servicios.CajaConsultaServicio.Consulta;
import com.nexora.backend.caja.servicios.CajaServicio;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Caja del asesor en sesión y reportes. El asesor siempre sale de la sesión, nunca de la URL. */
@RestController
@RequestMapping("/api/caja")
public class CajaControlador {

    private final CajaServicio caja;
    private final CajaConsultaServicio consultas;

    public CajaControlador(CajaServicio caja, CajaConsultaServicio consultas) {
        this.caja = caja;
        this.consultas = consultas;
    }

    /** Resumen de la caja propia (la abre con S/ 50,000 la primera vez). Solo asesores. */
    @GetMapping
    public CajaResumen resumen(HttpServletRequest request) {
        return caja.resumen(SesionPerfil.de(request));
    }

    @GetMapping("/movimientos")
    public Pagina<Movimiento> movimientos(HttpServletRequest request, @RequestParam(required = false) Integer pagina,
                                          @RequestParam(required = false) Integer tamano) {
        return caja.movimientos(SesionPerfil.de(request), pagina, tamano);
    }

    /** Contadores para los avisos del menú (asesor: lo suyo; gerencia: toda la empresa). */
    @GetMapping("/pendientes")
    public Pendientes pendientes(HttpServletRequest request) {
        return consultas.pendientes(SesionPerfil.de(request));
    }

    @GetMapping("/reportes/resumen")
    public ReporteResumen reporte(HttpServletRequest request,
                                  @RequestParam(required = false) String estados,
                                  @RequestParam(required = false) UUID agenciaId,
                                  @RequestParam(required = false) UUID asesorId,
                                  @RequestParam(required = false) String desde,
                                  @RequestParam(required = false) String hasta) {
        return consultas.reporte(SesionPerfil.de(request), new Consulta(estados, null, agenciaId, asesorId, desde, hasta, null, null, null));
    }

    @GetMapping("/reportes/reposiciones.csv")
    public ResponseEntity<byte[]> csv(HttpServletRequest request,
                                      @RequestParam(required = false) String estados,
                                      @RequestParam(required = false) UUID agenciaId,
                                      @RequestParam(required = false) UUID asesorId,
                                      @RequestParam(required = false) String desde,
                                      @RequestParam(required = false) String hasta) {
        String contenido = consultas.csv(SesionPerfil.de(request), new Consulta(estados, null, agenciaId, asesorId, desde, hasta, null, null, null));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"reposiciones.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(contenido.getBytes(StandardCharsets.UTF_8));
    }
}
