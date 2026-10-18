package com.nexora.backend.dashboard.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.dashboard.dto.CarteraRespuesta;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.CuotaFila;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.PrestamoFila;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio.Alcance;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio.CuotaDePrestamo;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DashboardServicio {

    private final DashboardRepositorio repositorio;
    private final Clock reloj;

    public DashboardServicio(DashboardRepositorio repositorio, Clock reloj) {
        this.repositorio = repositorio;
        this.reloj = reloj;
    }

    /** Lee todo en una sola transacción para que clientes, préstamos y cuotas sean coherentes entre sí. */
    @Transactional(readOnly = true)
    public CarteraRespuesta cartera(Perfil perfil) {
        Alcance alcance = alcanceDe(perfil);
        Map<UUID, List<CuotaFila>> cuotasPorPrestamo = repositorio.cuotas(alcance).stream()
                .collect(Collectors.groupingBy(CuotaDePrestamo::prestamoId,
                        Collectors.mapping(CuotaDePrestamo::cuota, Collectors.toList())));

        List<PrestamoFila> prestamos = repositorio.prestamos(alcance).stream()
                .map(p -> conCuotas(p, cuotasPorPrestamo.getOrDefault(p.id(), List.of())))
                .toList();

        return new CarteraRespuesta(LocalDate.now(reloj), repositorio.agenciasActivas(alcance), repositorio.clientes(alcance), prestamos);
    }

    /** La gerencia ve todas las agencias; el asesor, solo la suya (lo decide el servidor, no la pantalla). */
    static Alcance alcanceDe(Perfil perfil) {
        if ("gerencia".equals(perfil.getRol())) return Alcance.TODAS;
        if (perfil.getAgencia() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El asesor no tiene una agencia asignada.");
        }
        return new Alcance(perfil.getAgencia().getId());
    }

    private static PrestamoFila conCuotas(PrestamoFila p, List<CuotaFila> cuotas) {
        return new PrestamoFila(p.id(), p.numero(), p.clienteId(), p.agencia(), p.asesor(), p.capital(),
                p.plazoMeses(), p.tea(), p.fechaDesembolso(), p.registrado(), cuotas);
    }
}
