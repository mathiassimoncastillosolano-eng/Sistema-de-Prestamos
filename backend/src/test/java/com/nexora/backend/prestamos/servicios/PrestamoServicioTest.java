package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dominio.CapacidadEndeudamiento;
import com.nexora.backend.prestamos.dominio.EstadoCliente;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.InOrder;

class PrestamoServicioTest {

    private final PrestamoRepositorio prestamos = mock(PrestamoRepositorio.class);
    private final CuotaRepositorio cuotas = mock(CuotaRepositorio.class);
    private final ClienteResumenRepositorio clientes = mock(ClienteResumenRepositorio.class);
    private final PrestamoConsultaServicio consultas = mock(PrestamoConsultaServicio.class);
    private final EstadoClienteServicio estados = mock(EstadoClienteServicio.class);
    // 22:00 del 17-oct en Lima = 03:00 UTC del 18-oct: prueba que se usa la fecha de Perú, no la de UTC.
    private final Clock reloj = Clock.fixed(Instant.parse("2026-10-18T03:00:00Z"), ZoneId.of("America/Lima"));

    private final UUID clienteId = UUID.randomUUID();
    private PrestamoServicio servicio;
    private Perfil asesor;

    @BeforeEach
    void preparar() {
        servicio = new PrestamoServicio(prestamos, cuotas, clientes, consultas, estados, reloj);

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
        when(estados.actualizar(clienteId)).thenReturn(EstadoCliente.ACTIVO);
        acumulado("0");
    }

    /** Capital pendiente del cliente en toda la empresa, tal como lo calcula la consulta de capacidad. */
    private void acumulado(String valor) {
        when(consultas.capacidad(clienteId)).thenReturn(capacidadCon(valor));
    }

    private static CapacidadEndeudamiento capacidadCon(String capitalPendiente) {
        BigDecimal v = new BigDecimal(capitalPendiente);
        return CapacidadEndeudamiento.de(List.of(new Evaluacion("Vigente", v, v, v, null, 0, List.of())));
    }

    private PrestamoRespuesta registrar(String capital, Integer plazo, String moneda) {
        BigDecimal c = capital == null ? null : new BigDecimal(capital);
        return servicio.registrar(asesor, new SolicitudPrestamo(clienteId, c, plazo, moneda, null, null, null));
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
        assertEquals(LocalDate.of(2026, 11, 16), r.fechaPrimerVencimiento());
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
                servicio.registrar(asesor, new SolicitudPrestamo(otro, new BigDecimal("1000"), 6, null, null, null, null)));
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

    // ------------------------------------------------------------ capacidad disponible

    @Test
    void con_capacidad_6261_71_se_permite_6261_71_y_se_rechaza_6261_72() {
        acumulado("3738.29"); // disponible 6,261.71
        assertDoesNotThrow(() -> registrar("6261.71", 12, null));
        PrestamoException ex = rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("6261.72", 12, null));
        assertEquals(new BigDecimal("6261.71"), ex.getDetalle().get("disponible"));
        assertEquals(new BigDecimal("0.01"), ex.getDetalle().get("excedente"));
    }

    @Test
    void con_capacidad_8000_se_permiten_5000_y_8000_pero_no_8001() {
        acumulado("2000");
        assertDoesNotThrow(() -> registrar("5000", 12, null));
        assertDoesNotThrow(() -> registrar("8000", 12, null));
        rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("8001", 12, null));
    }

    @Test
    void sin_deuda_se_permiten_los_10000() {
        acumulado("0");
        assertDoesNotThrow(() -> registrar("10000", 12, null));
    }

    @Test
    void con_capacidad_0_no_se_registra_ni_el_minimo() {
        acumulado("10000");
        PrestamoException ex = rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("1000", 12, null));
        assertTrue(ex.getMessage().contains("no tiene capacidad suficiente"));
    }

    @Test
    void con_capacidad_menor_al_minimo_no_se_registra() {
        acumulado("9100"); // disponible 900 < 1,000
        PrestamoException ex = rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("1000", 12, null));
        assertTrue(ex.getMessage().contains("no tiene capacidad suficiente"));
    }

    @Test
    void cliente_moroso_no_puede_registrar_un_prestamo() {
        when(estados.actualizar(clienteId)).thenReturn(EstadoCliente.MOROSO);
        PrestamoException ex = rechaza(Codigo.CLIENTE_NO_APTO, () -> registrar("1000", 12, null));
        assertEquals(EstadoCliente.MOROSO, ex.getDetalle().get("estado"));
        verify(consultas, never()).capacidad(any());
    }

    @Test
    void cliente_extrajudicial_no_puede_registrar_un_prestamo() {
        when(estados.actualizar(clienteId)).thenReturn(EstadoCliente.EXTRAJUDICIAL);
        PrestamoException ex = rechaza(Codigo.CLIENTE_NO_APTO, () -> registrar("1000", 12, null));
        assertEquals(EstadoCliente.EXTRAJUDICIAL, ex.getDetalle().get("estado"));
    }

    @Test
    void el_estado_se_recalcula_despues_de_bloquear_al_cliente_y_antes_de_guardar() {
        registrar("1000", 12, null);
        InOrder orden = inOrder(clientes, estados, prestamos);
        orden.verify(clientes).buscarBloqueando(clienteId);
        orden.verify(estados).actualizar(clienteId);
        orden.verify(prestamos).save(any(Prestamo.class));
    }

    @Test
    void la_capacidad_se_lee_despues_de_bloquear_al_cliente() {
        registrar("1000", 12, null);
        InOrder orden = inOrder(clientes, consultas, prestamos);
        orden.verify(clientes).buscarBloqueando(clienteId);
        orden.verify(consultas).capacidad(clienteId);
        orden.verify(prestamos).save(any(Prestamo.class));
    }

    @Test
    void si_la_deuda_cambia_entre_la_consulta_y_el_registro_manda_la_deuda_actual() {
        // El formulario vio 8,000 disponibles; antes de registrar, otro asesor dejó al cliente con 5,000.
        when(consultas.capacidad(clienteId)).thenReturn(capacidadCon("2000"), capacidadCon("5000"));
        assertEquals(new BigDecimal("8000.00"), consultas.capacidad(clienteId).disponible()); // lo que mostró la pantalla
        PrestamoException ex = rechaza(Codigo.LIMITE_EXCEDIDO, () -> registrar("8000", 12, null));
        assertEquals(new BigDecimal("5000.00"), ex.getDetalle().get("disponible"));
    }

    // ------------------------------------------------------------ condiciones y simulación

    @Test
    void condiciones_usan_la_fecha_de_lima_y_la_primera_cuota_30_dias_despues() {
        var c = servicio.condiciones();
        assertEquals(LocalDate.of(2026, 10, 17), c.fechaDesembolso()); // no el 18 de UTC
        assertEquals(LocalDate.of(2026, 11, 16), c.fechaPrimerVencimiento());
        assertEquals("America/Lima", c.zonaHoraria());
        assertEquals(0, new BigDecimal("1000.00").compareTo(c.capitalMinimo()));
        assertEquals(60, c.plazoMaximoMeses());
    }

    @Test
    void simulacion_coincide_con_lo_que_se_registra_y_no_toca_la_base() {
        var sim = servicio.simular(new com.nexora.backend.prestamos.dto.SolicitudSimulacion(new BigDecimal("1000"), 12));
        PrestamoRespuesta real = registrar("1000", 12, null);

        assertEquals(12, sim.cuotas().size());
        assertEquals(real.fechaDesembolso(), sim.fechaDesembolso());
        assertEquals(real.fechaPrimerVencimiento(), sim.fechaPrimerVencimiento());
        assertEquals(0, real.cuotaMensual().compareTo(sim.cuotaMensual()));
        assertEquals(0, real.totalContractual().compareTo(sim.totalContractual()));
        for (int i = 0; i < 12; i++) {
            assertEquals(real.cuotas().get(i), sim.cuotas().get(i));
        }
    }

    @Test
    void simulacion_no_guarda_nada() {
        clearInvocations(prestamos, cuotas, clientes);
        servicio.simular(new com.nexora.backend.prestamos.dto.SolicitudSimulacion(new BigDecimal("2500"), 6));
        verify(prestamos, never()).save(any());
        verify(cuotas, never()).saveAll(any());
        verify(clientes, never()).buscarBloqueando(any());
    }

    @Test
    void simulacion_valida_capital_y_plazo_como_el_registro() {
        assertEquals(Codigo.CAPITAL_BAJO_MINIMO, assertThrows(PrestamoException.class, () ->
                servicio.simular(new com.nexora.backend.prestamos.dto.SolicitudSimulacion(new BigDecimal("0"), 12))).getCodigo());
        assertEquals(Codigo.PLAZO_FUERA_DE_RANGO, assertThrows(PrestamoException.class, () ->
                servicio.simular(new com.nexora.backend.prestamos.dto.SolicitudSimulacion(new BigDecimal("1000"), 0))).getCodigo());
        assertEquals(Codigo.PLAZO_FUERA_DE_RANGO, assertThrows(PrestamoException.class, () ->
                servicio.simular(new com.nexora.backend.prestamos.dto.SolicitudSimulacion(new BigDecimal("1000"), 61))).getCodigo());
    }

    // ------------------------------------------------------------ lo revisado = lo registrado

    @Test
    void si_la_fecha_revisada_ya_no_es_la_de_hoy_no_se_registra() {
        rechaza(Codigo.CONDICIONES_DESACTUALIZADAS, () -> servicio.registrar(asesor, new SolicitudPrestamo(
                clienteId, new BigDecimal("1000"), 12, null, null, LocalDate.of(2026, 10, 16), null)));
    }

    @Test
    void si_el_total_revisado_no_coincide_no_se_registra() {
        rechaza(Codigo.CONDICIONES_DESACTUALIZADAS, () -> servicio.registrar(asesor, new SolicitudPrestamo(
                clienteId, new BigDecimal("1000"), 12, null, null, null, new BigDecimal("1200.00"))));
    }

    @Test
    void si_lo_revisado_coincide_se_registra() {
        PrestamoRespuesta r = servicio.registrar(asesor, new SolicitudPrestamo(clienteId, new BigDecimal("1000"), 12,
                null, null, LocalDate.of(2026, 10, 17), new BigDecimal("1149.43")));
        assertEquals(12, r.cuotas().size());
    }
}
