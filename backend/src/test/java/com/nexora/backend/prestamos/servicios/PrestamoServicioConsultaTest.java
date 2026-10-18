package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.cuotas.entidades.Cuota;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dominio.CalculadoraCronograma;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dominio.ReglasPrestamo;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.entidades.Prestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.repositorios.ClienteResumenRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoRepositorio;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
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

    @Test
    void listarPorClienteCalculaPendientesYProximoVencimientoDesdeElCronograma() {
        UUID clienteId = UUID.randomUUID();
        LocalDate desembolso = LocalDate.of(2026, 5, 13);
        Clock reloj = Clock.fixed(LocalDate.of(2026, 10, 18).atStartOfDay(ZoneId.of("UTC")).toInstant(), ZoneId.of("UTC"));
        PrestamoServicio conFecha = new PrestamoServicio(prestamos, cuotas, clientes, reloj);

        Prestamo vigente = prestamoDe(clienteId, new BigDecimal("2500.00"), desembolso, 1006L);
        Prestamo cancelado = prestamoDe(clienteId, new BigDecimal("1000.00"), desembolso.minusMonths(6), 1001L);
        ReflectionTestUtils.setField(cancelado, "estado", "Cancelado");
        Cronograma cronVigente = guardarCronograma(vigente, 6);
        guardarCronograma(cancelado, 3);
        when(prestamos.findByClienteIdOrderByFechaDesembolsoDescNumeroDesc(clienteId))
                .thenReturn(List.of(vigente, cancelado));

        List<PrestamoResumen> r = conFecha.listarPorCliente(clienteId);

        assertEquals(2, r.size());
        PrestamoResumen v = r.get(0);
        assertEquals(1006L, v.numero());
        assertEquals(0, new BigDecimal("2500.00").compareTo(v.capitalPendiente()));
        assertEquals(0, cronVigente.totalContractual().compareTo(v.totalPendiente()));
        assertEquals(0, cronVigente.totalContractual().compareTo(v.totalContractual()));
        assertEquals(LocalDate.of(2026, 11, 13), v.proximoVencimiento());

        PrestamoResumen c = r.get(1);
        assertEquals("Cancelado", c.estado());
        assertEquals(0, BigDecimal.ZERO.compareTo(c.capitalPendiente()));
        assertEquals(0, BigDecimal.ZERO.compareTo(c.totalPendiente()));
        assertNull(c.proximoVencimiento());
    }

    private static Prestamo prestamoDe(UUID clienteId, BigDecimal capital, LocalDate fecha, Long numero) {
        Prestamo p = new Prestamo(clienteId, UUID.randomUUID(), UUID.randomUUID(),
                capital, 6, ReglasPrestamo.TEA, fecha, null);
        ReflectionTestUtils.setField(p, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(p, "numero", numero);
        return p;
    }

    private Cronograma guardarCronograma(Prestamo p, int plazo) {
        Cronograma c = CalculadoraCronograma.calcular(p.getCapital(), plazo, ReglasPrestamo.TEA, p.getFechaDesembolso());
        when(cuotas.findByIdPrestamoIdOrderByIdNumeroAsc(p.getId()))
                .thenReturn(c.cuotas().stream().map(q -> Cuota.desde(p.getId(), q)).toList());
        return c;
    }
}
