package com.nexora.backend.dashboard.servicios;

import com.nexora.backend.dashboard.dto.CarteraRespuesta;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.CuotaFila;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.PrestamoFila;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio.CuotaDePrestamo;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    public CarteraRespuesta cartera() {
        Map<UUID, List<CuotaFila>> cuotasPorPrestamo = repositorio.cuotas().stream()
                .collect(Collectors.groupingBy(CuotaDePrestamo::prestamoId,
                        Collectors.mapping(CuotaDePrestamo::cuota, Collectors.toList())));

        List<PrestamoFila> prestamos = repositorio.prestamos().stream()
                .map(p -> conCuotas(p, cuotasPorPrestamo.getOrDefault(p.id(), List.of())))
                .toList();

        return new CarteraRespuesta(LocalDate.now(reloj), repositorio.agenciasActivas(), repositorio.clientes(), prestamos);
    }

    private static PrestamoFila conCuotas(PrestamoFila p, List<CuotaFila> cuotas) {
        return new PrestamoFila(p.id(), p.numero(), p.clienteId(), p.agencia(), p.asesor(), p.capital(),
                p.plazoMeses(), p.tea(), p.fechaDesembolso(), p.registrado(), cuotas);
    }
}
