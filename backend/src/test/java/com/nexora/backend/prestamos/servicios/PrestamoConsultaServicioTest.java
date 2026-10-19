package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.CalculadoraCronograma;
import com.nexora.backend.prestamos.dominio.CapacidadEndeudamiento;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.ReglasPrestamo;
import com.nexora.backend.prestamos.dto.PrestamoDetalle;
import com.nexora.backend.prestamos.dto.PrestamoListado;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CabeceraPrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CuotaDePrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.Filtro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PrestamoConsultaServicioTest {

    private final PrestamoConsultaRepositorio repo = mock(PrestamoConsultaRepositorio.class);
    private final ZoneId lima = ZoneId.of("America/Lima");
    // 18-oct-2026 en Lima
    private final Clock reloj = Clock.fixed(LocalDate.of(2026, 10, 18).atStartOfDay(lima).toInstant().plusSeconds(12 * 3600), lima);
    private final PrestamoConsultaServicio servicio = new PrestamoConsultaServicio(repo, reloj);

    private final UUID asesorId = UUID.randomUUID();
    private final UUID agenciaId = UUID.randomUUID();

    private CabeceraPrestamo cabecera(UUID id, long numero, UUID asesor, BigDecimal capital, LocalDate desembolso, String estado) {
        return new CabeceraPrestamo(id, numero, UUID.randomUUID(), "Rosa Elena Quispe Huamán", "DNI", "12345678",
                27L, "987654321", "Lima Centro", "Camila Ortiz", asesor, capital, 6, ReglasPrestamo.TEA, desembolso, estado, null,
                "2026-07-13 15:38");
    }

    /** Cuotas reales de la calculadora; las primeras `pagadas` figuran PAGADA en la BD. */
    private List<CuotaDePrestamo> cuotas(UUID id, BigDecimal capital, LocalDate desembolso, int pagadas) {
        Cronograma c = CalculadoraCronograma.calcular(capital, 6, ReglasPrestamo.TEA, desembolso);
        List<CuotaDePrestamo> filas = new ArrayList<>();
        for (Cronograma.Cuota q : c.cuotas()) {
            filas.add(new CuotaDePrestamo(id, new CuotaGuardada(q.numero(), q.fechaVencimiento(), q.capital(),
                    q.interes(), q.importeCuota(), q.saldo(), q.numero() <= pagadas ? "PAGADA" : "PENDIENTE")));
        }
        return filas;
    }

    private Perfil asesor() {
        Agencia agencia = mock(Agencia.class);
        when(agencia.getId()).thenReturn(agenciaId);
        Perfil p = mock(Perfil.class);
        when(p.getId()).thenReturn(asesorId);
        when(p.getRol()).thenReturn("asesor");
        when(p.getAgencia()).thenReturn(agencia);
        return p;
    }

    @Test
    void detalleYListadoCoincidenEnSaldosYEstado() {
        UUID id = UUID.randomUUID();
        LocalDate desembolso = LocalDate.of(2026, 7, 13); // cuotas: 13-ago, 13-sep (vencidas), 13-oct (vencida), 13-nov...
        var cab = cabecera(id, 1001, asesorId, new BigDecimal("6000.00"), desembolso, "Vigente");
        var cuo = cuotas(id, new BigDecimal("6000.00"), desembolso, 1); // la 1 pagada; la 2 y la 3 vencidas
        when(repo.cabeceras(any())).thenReturn(List.of(cab));
        when(repo.cuotas(any())).thenReturn(cuo);

        PrestamoListado fila = servicio.listar(asesor()).get(0);
        PrestamoDetalle det = servicio.detalle(id);

        assertEquals("En mora", fila.estado());
        assertEquals(fila.estado(), det.estado());
        assertEquals(0, fila.capitalPendiente().compareTo(det.capitalPendiente()));
        assertEquals(0, fila.totalPendiente().compareTo(det.totalPendiente()));
        assertEquals(0, fila.totalContractual().compareTo(det.totalContractual()));
        assertEquals(fila.proximoVencimiento(), det.proximoVencimiento());
        assertEquals(LocalDate.of(2026, 9, 11), det.proximoVencimiento()); // primera cuota impaga (vencida)
        assertEquals(2, det.cuotasVencidas());
        assertTrue(fila.propio());
        assertEquals("PAGADA", det.cuotas().get(0).estado());
        assertEquals("VENCIDA", det.cuotas().get(1).estado());
        assertEquals("PENDIENTE", det.cuotas().get(3).estado());
        // capital pendiente = capital de las cuotas no pagadas, NO capital total menos nada
        assertTrue(det.capitalPendiente().compareTo(det.capital()) < 0);
        assertTrue(det.totalPendiente().compareTo(det.capitalPendiente()) > 0);
    }

    @Test
    void detalleArmaHistorialSoloConLoQueExisteEnLaBase() {
        UUID id = UUID.randomUUID();
        var cab = cabecera(id, 1001, asesorId, new BigDecimal("6000.00"), LocalDate.of(2026, 10, 18), "Vigente");
        when(repo.cabeceras(any())).thenReturn(List.of(cab));
        when(repo.cuotas(any())).thenReturn(cuotas(id, new BigDecimal("6000.00"), LocalDate.of(2026, 10, 18), 0));

        PrestamoDetalle det = servicio.detalle(id);

        assertEquals(1, det.historial().size());
        assertEquals("Préstamo registrado", det.historial().get(0).tipo());
        assertEquals("2026-07-13 15:38", det.historial().get(0).fechaHora());
        assertEquals("Camila Ortiz", det.historial().get(0).usuario());
        assertEquals("PR-1001 por S/ 6,000.00 a Rosa Elena Quispe Huamán", det.historial().get(0).descripcion());
        assertEquals("Vigente", det.estado());
        assertEquals(LocalDate.of(2026, 11, 17), det.fechaPrimerVencimiento());
        assertEquals(6, det.cuotas().size());
        assertEquals(LocalDate.of(2027, 4, 16), det.fechaUltimoVencimiento());
    }

    @Test
    void prestamoInexistenteLanzaNoEncontrado() {
        when(repo.cabeceras(any())).thenReturn(List.of());
        PrestamoException ex = assertThrows(PrestamoException.class, () -> servicio.detalle(UUID.randomUUID()));
        assertEquals(PrestamoException.Codigo.PRESTAMO_NO_ENCONTRADO, ex.getCodigo());
    }

    @Test
    void listadoMarcaComoPropioSoloLosDelUsuarioYAgrupaCuotasSinConsultasPorFila() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        LocalDate d = LocalDate.of(2026, 10, 1);
        when(repo.cabeceras(any())).thenReturn(List.of(
                cabecera(a, 1002, asesorId, new BigDecimal("2000.00"), d, "Vigente"),
                cabecera(b, 1001, UUID.randomUUID(), new BigDecimal("3000.00"), d, "Vigente")));
        List<CuotaDePrestamo> todas = new ArrayList<>(cuotas(a, new BigDecimal("2000.00"), d, 0));
        todas.addAll(cuotas(b, new BigDecimal("3000.00"), d, 0));
        when(repo.cuotas(any())).thenReturn(todas);

        List<PrestamoListado> filas = servicio.listar(asesor());

        assertEquals(2, filas.size());
        assertTrue(filas.get(0).propio());
        assertFalse(filas.get(1).propio());
        assertEquals("Vigente", filas.get(0).estado());
        assertEquals(0, new BigDecimal("2000.00").compareTo(filas.get(0).capitalPendiente()));
        assertEquals(0, new BigDecimal("3000.00").compareTo(filas.get(1).capitalPendiente()));
    }

    @Test
    void prestamoConTodasLasCuotasPagadasEsCancelado() {
        UUID id = UUID.randomUUID();
        LocalDate d = LocalDate.of(2026, 1, 5);
        when(repo.cabeceras(any())).thenReturn(List.of(cabecera(id, 1001, asesorId, new BigDecimal("1000.00"), d, "Vigente")));
        when(repo.cuotas(any())).thenReturn(cuotas(id, new BigDecimal("1000.00"), d, 6));

        PrestamoListado fila = servicio.listar(asesor()).get(0);

        assertEquals("Cancelado", fila.estado());
        assertEquals(0, BigDecimal.ZERO.compareTo(fila.capitalPendiente()));
        assertEquals(0, BigDecimal.ZERO.compareTo(fila.totalPendiente()));
        assertNull(fila.proximoVencimiento());
    }

    @Test
    void resumenPorClienteUsaLosMismosSaldosQueElListado() {
        UUID id = UUID.randomUUID();
        UUID clienteId = UUID.randomUUID();
        LocalDate d = LocalDate.of(2026, 10, 1);
        when(repo.cabeceras(any())).thenReturn(List.of(cabecera(id, 1001, asesorId, new BigDecimal("2500.00"), d, "Vigente")));
        when(repo.cuotas(any())).thenReturn(cuotas(id, new BigDecimal("2500.00"), d, 0));

        PrestamoResumen r = servicio.listarPorCliente(clienteId).get(0);
        PrestamoListado fila = servicio.listar(asesor()).get(0);

        assertEquals(fila.estado(), r.estado());
        assertEquals(0, fila.capitalPendiente().compareTo(r.capitalPendiente()));
        assertEquals(0, fila.totalPendiente().compareTo(r.totalPendiente()));
        assertEquals(LocalDate.of(2026, 10, 31), r.proximoVencimiento());
    }

    @Test
    void asesorSinAgenciaNoPuedeListar() {
        Perfil sin = mock(Perfil.class);
        when(sin.getRol()).thenReturn("asesor");
        when(sin.getAgencia()).thenReturn(null);
        assertEquals(PrestamoException.Codigo.SIN_PERMISO,
                assertThrows(PrestamoException.class, () -> servicio.listar(sin)).getCodigo());
    }

    // ------------------------------------------------------------ capacidad de endeudamiento

    private CabeceraPrestamo enAgencia(UUID id, long numero, String agencia, BigDecimal capital, LocalDate d, String estado) {
        return new CabeceraPrestamo(id, numero, UUID.randomUUID(), "Rosa Elena Quispe Huamán", "DNI", "12345678",
                27L, "987654321", agencia, "Camila Ortiz", UUID.randomUUID(), capital, 6, ReglasPrestamo.TEA, d, estado,
                null, "2026-07-13 15:38");
    }

    @Test
    void capacidadSumaLosPrestamosDelClienteEnTodasLasAgencias() {
        UUID clienteId = UUID.randomUUID();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        LocalDate d = LocalDate.of(2026, 10, 1);
        when(repo.cabeceras(any())).thenReturn(List.of(
                enAgencia(a, 1001, "Agencia Piura", new BigDecimal("2000.00"), d, "Vigente"),
                enAgencia(b, 1002, "Agencia Trujillo", new BigDecimal("3000.00"), d, "En mora"),
                enAgencia(c, 1003, "Agencia Chiclayo", new BigDecimal("4000.00"), d, "Cancelado")));
        List<CuotaDePrestamo> todas = new ArrayList<>(cuotas(a, new BigDecimal("2000.00"), d, 0));
        todas.addAll(cuotas(b, new BigDecimal("3000.00"), d, 0));
        todas.addAll(cuotas(c, new BigDecimal("4000.00"), d, 0));
        when(repo.cuotas(any())).thenReturn(todas);

        CapacidadEndeudamiento cap = servicio.capacidad(clienteId);

        // Se consulta por cliente, nunca por agencia ni por asesor.
        ArgumentCaptor<Filtro> filtro = ArgumentCaptor.forClass(Filtro.class);
        verify(repo).cabeceras(filtro.capture());
        assertEquals("p.cliente_id = ?", filtro.getValue().condicion());
        assertEquals(clienteId, filtro.getValue().argumentos()[0]);

        assertEquals(new BigDecimal("5000.00"), cap.capitalPendiente()); // el cancelado no suma
        assertEquals(new BigDecimal("5000.00"), cap.disponible());
    }

    @Test
    void capacidadCoincideConLoQueSumaElPerfil() {
        UUID clienteId = UUID.randomUUID();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        LocalDate d = LocalDate.of(2026, 7, 13);
        when(repo.cabeceras(any())).thenReturn(List.of(
                enAgencia(a, 1001, "Agencia Piura", new BigDecimal("6000.00"), d, "Vigente"),
                enAgencia(b, 1002, "Agencia Trujillo", new BigDecimal("1500.00"), d, "Vigente")));
        List<CuotaDePrestamo> todas = new ArrayList<>(cuotas(a, new BigDecimal("6000.00"), d, 2));
        todas.addAll(cuotas(b, new BigDecimal("1500.00"), d, 1));
        when(repo.cuotas(any())).thenReturn(todas);

        List<PrestamoResumen> filas = servicio.listarPorCliente(clienteId);
        CapacidadEndeudamiento cap = servicio.capacidad(clienteId);

        BigDecimal capital = filas.stream().map(PrestamoResumen::capitalPendiente).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal importe = filas.stream().map(PrestamoResumen::totalPendiente).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, capital.compareTo(cap.capitalPendiente()));
        assertEquals(0, importe.compareTo(cap.importePendiente()));
        assertEquals(0, new BigDecimal("10000.00").subtract(capital).compareTo(cap.disponible()));
    }

    @Test
    void prestamoActivoSinCuotasCuentaTodoSuCapital() {
        UUID id = UUID.randomUUID();
        when(repo.cabeceras(any())).thenReturn(List.of(
                enAgencia(id, 1001, "Agencia Piura", new BigDecimal("4000.00"), LocalDate.of(2026, 10, 1), "Vigente")));
        when(repo.cuotas(any())).thenReturn(List.of());

        assertEquals(new BigDecimal("6000.00"), servicio.capacidad(UUID.randomUUID()).disponible());
    }

    // ------------------------------------------------------------ estado del cliente

    private CabeceraPrestamo deCliente(UUID id, long numero, UUID clienteId, LocalDate desembolso, String estado) {
        return new CabeceraPrestamo(id, numero, clienteId, "Cliente", "DNI", "12345678", 27L, null, "Lima Centro",
                "Camila Ortiz", asesorId, new BigDecimal("1000.00"), 6, ReglasPrestamo.TEA, desembolso, estado, null,
                "2026-01-01 10:00");
    }

    @Test
    void estadoClienteConsideraTodosSusPrestamos() {
        UUID clienteId = UUID.randomUUID();
        UUID alDia = UUID.randomUUID();
        UUID atrasado = UUID.randomUUID();
        LocalDate reciente = LocalDate.of(2026, 10, 1);   // primera cuota: 1-nov (futura)
        LocalDate antiguo = LocalDate.of(2026, 7, 13);    // cuotas de ago, sep y oct vencidas
        when(repo.cabeceras(any())).thenReturn(List.of(
                deCliente(alDia, 1001, clienteId, reciente, "Vigente"),
                deCliente(atrasado, 1002, clienteId, antiguo, "Vigente")));
        List<CuotaDePrestamo> todas = new ArrayList<>(cuotas(alDia, new BigDecimal("1000.00"), reciente, 0));
        todas.addAll(cuotas(atrasado, new BigDecimal("1000.00"), antiguo, 0));
        when(repo.cuotas(any())).thenReturn(todas);

        assertEquals("MOROSO", servicio.estadoCliente(clienteId));
    }

    @Test
    void estadosDeClientesAgrupaPorCliente() {
        UUID moroso = UUID.randomUUID();
        UUID extrajudicial = UUID.randomUUID();
        UUID activo = UUID.randomUUID();
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        UUID p3 = UUID.randomUUID();
        when(repo.cabeceras(any())).thenReturn(List.of(
                deCliente(p1, 1001, moroso, LocalDate.of(2026, 7, 13), "Vigente"),
                deCliente(p2, 1002, extrajudicial, LocalDate.of(2025, 9, 1), "En mora"), // 1.ª cuota: 1-oct-2025
                deCliente(p3, 1003, activo, LocalDate.of(2026, 10, 1), "Vigente")));
        List<CuotaDePrestamo> todas = new ArrayList<>(cuotas(p1, new BigDecimal("1000.00"), LocalDate.of(2026, 7, 13), 0));
        todas.addAll(cuotas(p2, new BigDecimal("1000.00"), LocalDate.of(2025, 9, 1), 0));
        todas.addAll(cuotas(p3, new BigDecimal("1000.00"), LocalDate.of(2026, 10, 1), 0));
        when(repo.cuotas(any())).thenReturn(todas);

        var estados = servicio.estadosDeClientes();

        assertEquals("MOROSO", estados.get(moroso));
        assertEquals("EXTRAJUDICIAL", estados.get(extrajudicial));
        assertEquals("ACTIVO", estados.get(activo));
        ArgumentCaptor<Filtro> filtro = ArgumentCaptor.forClass(Filtro.class);
        verify(repo).cabeceras(filtro.capture());
        assertEquals("true", filtro.getValue().condicion());
    }
}
