package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.entidades.ClienteResumen;
import com.nexora.backend.prestamos.entidades.Prestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.repositorios.ClienteResumenRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoRepositorio;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

class PrestamoServicioTest {

    private final PrestamoRepositorio prestamos = mock(PrestamoRepositorio.class);
    private final CuotaRepositorio cuotas = mock(CuotaRepositorio.class);
    private final ClienteResumenRepositorio clientes = mock(ClienteResumenRepositorio.class);
    // 22:00 del 17-oct en Lima = 03:00 UTC del 18-oct: prueba que se usa la fecha de Perú, no la de UTC.
    private final Clock reloj = Clock.fixed(Instant.parse("2026-10-18T03:00:00Z"), ZoneId.of("America/Lima"));

    private final UUID clienteId = UUID.randomUUID();
    private PrestamoServicio servicio;
    private Perfil asesor;

    @BeforeEach
    void preparar() {
        servicio = new PrestamoServicio(prestamos, cuotas, clientes, reloj);

        Agencia agencia = mock(Agencia.class);
        when(agencia.getId()).thenReturn(UUID.randomUUID());
        asesor = mock(Perfil.class);
        when(asesor.getId()).thenReturn(UUID.randomUUID());
        when(asesor.getRol()).thenReturn("asesor");
        when(asesor.getAgencia()).thenReturn(agencia);

        ClienteResumen cliente = mock(ClienteResumen.class);
        when(cliente.getId()).thenReturn(clienteId);
        when(clientes.buscarBloqueando(clienteId)).thenReturn(Optional.of(cliente));

        when(prestamos.save(any(Prestamo.class))).thenAnswer(i -> i.getArgument(0));
        when(prestamos.obtenerNumero(any())).thenReturn(1001L);
        acumulado("0");
    }

    private void acumulado(String valor) {
        when(prestamos.sumarCapitalActivo(clienteId)).thenReturn(Optional.of(new BigDecimal(valor)));
    }

    private PrestamoRespuesta registrar(String capital, Integer plazo, String moneda) {
        BigDecimal c = capital == null ? null : new BigDecimal(capital);
        return servicio.registrar(asesor, new SolicitudPrestamo(clienteId, c, plazo, moneda, null));
    }

    private PrestamoException rechaza(Codigo esperado, Executable accion) {
        // Olvida las llamadas de registros válidos previos del mismo test (conserva los stubs).
        clearInvocations(prestamos, cuotas);
        PrestamoException ex = assertThrows(PrestamoException.class, accion);
        assertEquals(esperado, ex.getCodigo());
        verify(prestamos, never()).save(any());
        verify(cuotas, never()).saveAll(any());
        return ex;
    }

    @Test
    void registra_prestamo_valido_con_cronograma_y_datos_del_servidor() {
        PrestamoRespuesta r = registrar("1000", 12, null);

        assertEquals(12, r.cuotas().size());
        assertEquals("Vigente", r.estado());
        assertEquals("PEN", r.moneda());
        assertEquals(0, new BigDecimal("0.30").compareTo(r.tea()));
        assertEquals(LocalDate.of(2026, 10, 17), r.fechaDesembolso());
        assertEquals(LocalDate.of(2026, 11, 17), r.fechaPrimerVencimiento());
        assertEquals(new BigDecimal("1149.43"), r.totalContractual());
        assertEquals(1001L, r.numero());
        verify(prestamos).save(any(Prestamo.class));
        verify(cuotas).saveAll(any());
    }

    @Test
    void capital_limite_1000_se_acepta_y_999_99_se_rechaza() {
        assertDoesNotThrow(() -> registrar("1000", 6, "PEN"));
        rechaza(Codigo.CAPITAL_BAJO_MINIMO, () -> registrar("999.99", 6, null));
    }

    @Test
    void capital_vacio_o_con_mas_de_dos_decimales_se_rechaza() {
        rechaza(Codigo.DATOS_INVALIDOS, () -> registrar(null, 6, null));
        rechaza(Codigo.DATOS_INVALIDOS, () -> registrar("1000.123", 6, null));
    }

    @Test
    void plazo_1_y_60_se_aceptan_y_0_y_61_se_rechazan() {
        assertDoesNotThrow(() -> registrar("1000", 1, null));
        assertDoesNotThrow(() -> registrar("1000", 60, null));
        rechaza(Codigo.PLAZO_FUERA_DE_RANGO, () -> registrar("1000", 0, null));
        rechaza(Codigo.PLAZO_FUERA_DE_RANGO, () -> registrar("1000", 61, null));
        rechaza(Codigo.DATOS_INVALIDOS, () -> registrar("1000", null, null));
    }

    @Test
    void moneda_distinta_de_pen_se_rechaza() {
        rechaza(Codigo.MONEDA_NO_PERMITIDA, () -> registrar("1000", 6, "USD"));
    }

    @Test
    void solo_un_asesor_puede_registrar() {
        when(asesor.getRol()).thenReturn("gerencia");
        rechaza(Codigo.SIN_PERMISO, () -> registrar("1000", 6, null));
    }

    @Test
    void cliente_inexistente_se_rechaza() {
        UUID otro = UUID.randomUUID();
        when(clientes.buscarBloqueando(otro)).thenReturn(Optional.empty());
        rechaza(Codigo.CLIENTE_NO_ENCONTRADO, () ->
                servicio.registrar(asesor, new SolicitudPrestamo(otro, new BigDecimal("1000"), 6, null, null)));
    }

    @Test
    void acumulado_9000_mas_1000_llega_al_limite_y_se_permite() {
        acumulado("9000");
        assertDoesNotThrow(() -> registrar("1000", 12, null));
    }

    @Test
    void acumulado_9000_mas_1001_se_bloquea_y_informa_acumulado_y_excedente() {
        acumulado("9000");
        PrestamoException ex = rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("1001", 12, null));
        assertEquals(new BigDecimal("9000.00"), ex.getDetalle().get("acumulado"));
        assertEquals(new BigDecimal("1.00"), ex.getDetalle().get("excedente"));
    }
}