package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.cuotas.entidades.Cuota;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dominio.CalculadoraCronograma;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dominio.ReglasPrestamo;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.entidades.Prestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.repositorios.ClienteResumenRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoRepositorio;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PrestamoServicioConsultaTest {

    private final PrestamoRepositorio prestamos = mock(PrestamoRepositorio.class);
    private final CuotaRepositorio cuotas = mock(CuotaRepositorio.class);
    private final ClienteResumenRepositorio clientes = mock(ClienteResumenRepositorio.class);
    private final PrestamoServicio servicio =
            new PrestamoServicio(prestamos, cuotas, clientes, Clock.systemUTC());

    @Test
    void consultarDevuelveElMismoCronogramaQueSeCalculoAlRegistrar() {
        UUID id = UUID.randomUUID();
        LocalDate fecha = LocalDate.of(2026, 10, 17);
        BigDecimal capital = new BigDecimal("1000.00");
        Cronograma original = CalculadoraCronograma.calcular(capital, 12, ReglasPrestamo.TEA, fecha);

        Prestamo prestamo = new Prestamo(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                capital, 12, ReglasPrestamo.TEA, fecha, null);
        ReflectionTestUtils.setField(prestamo, "id", id);
        ReflectionTestUtils.setField(prestamo, "numero", 1001L);

        when(prestamos.findById(id)).thenReturn(Optional.of(prestamo));
        when(cuotas.findByIdPrestamoIdOrderByIdNumeroAsc(id))
                .thenReturn(original.cuotas().stream().map(c -> Cuota.desde(id, c)).toList());

        PrestamoRespuesta r = servicio.consultar(id);

        assertEquals(1001L, r.numero());
        assertEquals(12, r.cuotas().size());
        assertEquals(LocalDate.of(2026, 11, 17), r.fechaPrimerVencimiento());
        assertEquals(0, original.cuotaMensual().compareTo(r.cuotaMensual()));
        assertEquals(0, original.totalIntereses().compareTo(r.totalIntereses()));
        assertEquals(0, original.totalContractual().compareTo(r.totalContractual()));
        for (int i = 0; i < 12; i++) {
            Cronograma.Cuota esperada = original.cuotas().get(i);
            PrestamoRespuesta.CuotaRespuesta real = r.cuotas().get(i);
            assertEquals(esperada.numero(), real.numero());
            assertEquals(esperada.fechaVencimiento(), real.fechaVencimiento());
            assertEquals(0, esperada.importeCuota().compareTo(real.importeCuota()));
            assertEquals(0, esperada.saldo().compareTo(real.saldo()));
        }
    }

    @Test
    void consultarUnPrestamoInexistenteLanzaNoEncontrado() {
        UUID id = UUID.randomUUID();
        when(prestamos.findById(id)).thenReturn(Optional.empty());

        PrestamoException ex = assertThrows(PrestamoException.class, () -> servicio.consultar(id));

        assertEquals(PrestamoException.Codigo.PRESTAMO_NO_ENCONTRADO, ex.getCodigo());
    }
}