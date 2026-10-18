package com.nexora.backend.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.dashboard.dto.CarteraRespuesta;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.CuotaFila;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.PrestamoFila;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio.Alcance;
import com.nexora.backend.dashboard.repositorios.DashboardRepositorio.CuotaDePrestamo;
import com.nexora.backend.dashboard.servicios.DashboardServicio;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DashboardServicioTest {

    private final DashboardRepositorio repositorio = mock(DashboardRepositorio.class);
    private final Clock reloj = Clock.fixed(Instant.parse("2026-10-18T15:00:00Z"), ZoneId.of("America/Lima"));
    private final DashboardServicio servicio = new DashboardServicio(repositorio, reloj);

    private static PrestamoFila prestamo(UUID id) {
        return new PrestamoFila(id, 1001, UUID.randomUUID(), "Agencia Trujillo", "Juan Perez",
                new BigDecimal("1000.00"), 2, new BigDecimal("0.30"), LocalDate.of(2026, 10, 17), "2026-10-17 10:30", List.of());
    }

    private static Perfil perfil(String rol, Agencia agencia) {
        Perfil p = mock(Perfil.class);
        when(p.getRol()).thenReturn(rol);
        when(p.getAgencia()).thenReturn(agencia);
        return p;
    }

    private static final Perfil GERENTE = perfil("gerencia", null);

    private static CuotaFila cuota(int n) {
        return new CuotaFila(n, LocalDate.of(2026, 10 + n, 17), BigDecimal.TEN, BigDecimal.ONE, BigDecimal.valueOf(11), BigDecimal.ZERO, false);
    }

    @Test
    void cadaPrestamoRecibeSoloSusCuotas() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        when(repositorio.prestamos(any())).thenReturn(List.of(prestamo(a), prestamo(b)));
        when(repositorio.cuotas(any())).thenReturn(List.of(
                new CuotaDePrestamo(a, cuota(1)), new CuotaDePrestamo(a, cuota(2)), new CuotaDePrestamo(b, cuota(1))));
        when(repositorio.agenciasActivas(any())).thenReturn(List.of("Agencia Trujillo"));
        when(repositorio.clientes(any())).thenReturn(List.of());

        CarteraRespuesta r = servicio.cartera(GERENTE);

        assertThat(r.prestamos()).hasSize(2);
        assertThat(r.prestamos().get(0).cuotas()).extracting(CuotaFila::numero).containsExactly(1, 2);
        assertThat(r.prestamos().get(1).cuotas()).hasSize(1);
    }

    @Test
    void prestamoSinCuotasDevuelveListaVaciaYFechaDeLima() {
        when(repositorio.prestamos(any())).thenReturn(List.of(prestamo(UUID.randomUUID())));
        when(repositorio.cuotas(any())).thenReturn(List.of());

        CarteraRespuesta r = servicio.cartera(GERENTE);

        assertThat(r.prestamos().get(0).cuotas()).isEmpty();
        assertThat(r.hoy()).isEqualTo(LocalDate.of(2026, 10, 18));
    }

    @Test
    void elGerenteVeTodasLasAgencias() {
        servicio.cartera(GERENTE);

        verify(repositorio).prestamos(Alcance.TODAS);
    }

    @Test
    void elAsesorSoloVeSuAgencia() {
        UUID trujillo = UUID.randomUUID();
        Agencia agencia = mock(Agencia.class);
        when(agencia.getId()).thenReturn(trujillo);

        servicio.cartera(perfil("asesor", agencia));

        verify(repositorio).prestamos(new Alcance(trujillo));
        verify(repositorio).clientes(new Alcance(trujillo));
    }

    @Test
    void asesorSinAgenciaNoVeNada() {
        assertThatThrownBy(() -> servicio.cartera(perfil("asesor", null))).isInstanceOf(ResponseStatusException.class);
    }
}
