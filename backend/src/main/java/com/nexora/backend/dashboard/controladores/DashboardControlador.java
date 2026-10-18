package com.nexora.backend.dashboard.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.dashboard.dto.CarteraRespuesta;
import com.nexora.backend.dashboard.servicios.DashboardServicio;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** US-11. Solo lectura. La seguridad ya exige sesión para todo /api/**; el perfil lo deja el filtro de sesión. */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardControlador {

    private final DashboardServicio servicio;

    public DashboardControlador(DashboardServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public CarteraRespuesta cartera(@RequestAttribute("nexora.perfil") Perfil perfil) {
        return servicio.cartera(perfil);
    }
}
