package com.nexora.backend.caja.controladores;

import com.nexora.backend.caja.dto.CajaDtos.SupervisionResumen;
import com.nexora.backend.caja.servicios.CajaConsultaServicio;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Supervisión de cajas: solo gerencia (el servicio lo exige con el rol de la sesión). */
@RestController
@RequestMapping("/api/supervision")
public class SupervisionCajaControlador {

    private final CajaConsultaServicio consultas;

    public SupervisionCajaControlador(CajaConsultaServicio consultas) {
        this.consultas = consultas;
    }

    @GetMapping("/cajas")
    public SupervisionResumen cajas(HttpServletRequest request) {
        return consultas.supervision(SesionPerfil.de(request));
    }
}
