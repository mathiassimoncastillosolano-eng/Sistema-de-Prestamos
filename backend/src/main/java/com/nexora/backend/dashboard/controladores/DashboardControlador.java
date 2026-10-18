package com.nexora.backend.dashboard.controladores;

import com.nexora.backend.dashboard.dto.CarteraRespuesta;
import com.nexora.backend.dashboard.servicios.DashboardServicio;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** US-11. Solo lectura. La seguridad ya exige sesión para todo /api/**. */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardControlador {

    private final DashboardServicio servicio;

    public DashboardControlador(DashboardServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public CarteraRespuesta cartera() {
        return servicio.cartera();
    }
}
