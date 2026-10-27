package com.nexora.backend.caja.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.dto.CajaDtos.AprobarReposicion;
import com.nexora.backend.caja.dto.CajaDtos.DecisionTexto;
import com.nexora.backend.caja.dto.CajaDtos.Despacho;
import com.nexora.backend.caja.dto.CajaDtos.NuevaIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.Recepcion;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionDetalle;
import com.nexora.backend.caja.dto.CajaDtos.ResolverIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.SolicitudReposicion;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import com.nexora.backend.caja.servicios.CajaConsultaServicio.Consulta;
import com.nexora.backend.caja.hermes.HermesVerificador;
import com.nexora.backend.caja.hermes.ResultadoHermes;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Flujo completo de reposiciones contra un PostgreSQL REAL y LOCAL (solo corre con PRUEBA_PG_URL hacia localhost).
 *
 * <p>Hermes: el proyecto no tiene integración real, así que aquí se usa un DOBLE DE PRUEBA que acepta únicamente los códigos
 * que el propio test «emite». Es un doble de test, no un comportamiento de producción: sin ese bean el sistema usa
 * HermesNoConfigurado y rechaza toda aprobación.
 */
@EnabledIfEnvironmentVariable(named = "PRUEBA_PG_URL", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1)[:/].*")
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=none",
        "apiperu.token=sin-token",
        "nexora.caja.hermes.huella-secreto=secreto-solo-para-pruebas"
})
@Import(ReposicionPostgresTest.HermesDeTest.class)
class ReposicionPostgresTest {

    /** Códigos «emitidos» por el test: Hermes de prueba solo reconoce estos, sin importar el formato. */
    static final Set<String> EMITIDOS = ConcurrentHashMap.newKeySet();

    @TestConfiguration
    static class HermesDeTest {
        @Bean
        HermesVerificador hermesDeTest() {
            return s -> EMITIDOS.contains(s.codigo()) ? ResultadoHermes.valido("H-" + s.numeroReposicion())
                    : ResultadoHermes.de(ResultadoHermes.Estado.INVALIDO);
        }
    }

    @DynamicPropertySource
    static void baseLocal(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("PRUEBA_PG_URL"));
        r.add("spring.datasource.username", () -> System.getenv().getOrDefault("PRUEBA_PG_USER", "postgres"));
        r.add("spring.datasource.password", () -> System.getenv().getOrDefault("PRUEBA_PG_PASSWORD", ""));
    }

    @Autowired private ReposicionServicio reposiciones;
    @Autowired private CajaServicio cajas;
    @Autowired private CajaConsultaServicio consultas;
    @Autowired private JdbcTemplate jdbc;

    private UUID agenciaId;
    private Perfil asesor;
    private Perfil gerente;

    @BeforeEach
    void preparar() {
        new ResourceDatabasePopulator(new ClassPathResource("esquema-prueba-concurrencia.sql")).execute(jdbc.getDataSource());
        new ResourceDatabasePopulator(new FileSystemResource("sql/2026-10-26-caja-y-reposiciones.sql")).execute(jdbc.getDataSource());
        UUID ubicacion = jdbc.queryForObject("insert into public.ubicaciones (departamento, provincia, distrito) "
                + "values ('Piura', 'Piura', 'Piura') returning id", UUID.class);
        agenciaId = jdbc.queryForObject("insert into public.agencias (nombre, ubicacion_id) values ('Agencia Caja', ?) "
                + "returning id", UUID.class, ubicacion);
        asesor = perfil("asesor");
        gerente = perfil("gerencia");
        cajas.resumen(asesor); // abre la caja con S/ 50,000
    }

    private Perfil perfil(String rol) {
        UUID id = jdbc.queryForObject("insert into public.perfiles (nombres, apellidos, correo, rol, agencia_id, clave_hash) "
                + "values (?, 'Prueba', ?, ?, ?, 'x') returning id", UUID.class, rol, rol + UUID.randomUUID() + "@prueba.local", rol, agenciaId);
        Agencia agencia = mock(Agencia.class);
        when(agencia.getId()).thenReturn(agenciaId);
        Perfil p = mock(Perfil.class);
        when(p.getId()).thenReturn(id);
        when(p.getRol()).thenReturn(rol);
        when(p.getAgencia()).thenReturn(agencia);
        return p;
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    private static String clave() {
        return "k-" + UUID.randomUUID();
    }

    private BigDecimal saldo() {
        return jdbc.queryForObject("select saldo from public.cajas where asesor_id = ?", BigDecimal.class, asesor.getId());
    }

    /** Baja el efectivo de la caja con desembolsos reales del libro (como lo hace el registro de préstamos). */
    private void gastar(String importe) {
        UUID caja = jdbc.queryForObject("select id from public.cajas where asesor_id = ?", UUID.class, asesor.getId());
        BigDecimal antes = saldo();
        jdbc.update("insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, referencia, creado_por) "
                + "values (?, 'AJUSTE', 'SALIDA', ?, ?, ?, 'preparación de prueba', ?)", caja, d(importe), antes,
                antes.subtract(d(importe)), asesor.getId());
    }

    private String codigoNuevo() {
        String c = String.format("%08d", (long) (Math.random() * 100_000_000L));
        EMITIDOS.add(c);
        return c;
    }

    private ReposicionDetalle solicitar(String monto) {
        return reposiciones.solicitar(asesor, new SolicitudReposicion(d(monto), "DESEMBOLSOS_PROGRAMADOS",
                "Necesito efectivo para los desembolsos de la semana", clave()));
    }

    private ReposicionDetalle aprobar(ReposicionDetalle det, String monto, String justificacion) {
        return reposiciones.aprobar(gerente, det.fila().id(), new AprobarReposicion(d(monto), justificacion, codigoNuevo(), det.version()));
    }

    private void rechaza(Codigo esperado, org.junit.jupiter.api.function.Executable accion) {
        assertEquals(esperado, assertThrows(CajaException.class, accion).getCodigo());
    }

    @Test
    void flujo_completo_con_recepciones_parciales_y_conciliacion() {
        gastar("30000.00");                                             // efectivo 20,000
        ReposicionDetalle sol = solicitar("30000");
        assertEquals("PENDIENTE_APROBACION", sol.fila().estado());
        assertEquals(0, d("20000").compareTo(saldo()));                 // pedir no mueve efectivo

        ReposicionDetalle apr = aprobar(sol, "25000", "Se autoriza menos por política de caja");
        assertEquals("APROBADA", apr.fila().estado());
        assertEquals(0, d("25000").compareTo(apr.fila().montoAutorizado()));
        assertEquals(0, d("20000").compareTo(saldo()));                 // autorizar tampoco mueve efectivo

        ReposicionDetalle env = reposiciones.despachar(gerente, sol.fila().id(), new Despacho(d("25000"), "Ruta 14", null, apr.version()));
        assertEquals("EN_TRANSITO", env.fila().estado());
        assertEquals(0, d("20000").compareTo(saldo()));                 // enviar tampoco

        ReposicionDetalle p1 = reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("10000"), null, null, null, clave()));
        assertEquals("RECEPCION_PARCIAL", p1.fila().estado());
        assertEquals(0, d("30000").compareTo(saldo()));                 // recién aquí entra el efectivo
        ReposicionDetalle p2 = reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("15000"), null, null, null, clave()));
        assertEquals("RECIBIDA", p2.fila().estado());
        assertEquals(0, d("45000").compareTo(saldo()));
        assertEquals(2, p2.recepciones().size());                       // cada recepción es su propio registro

        ReposicionDetalle fin = reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto("Conciliado", p2.version()));
        assertEquals("COMPLETADA", fin.fila().estado());
        assertTrue(fin.linea().size() >= 6, "la línea de tiempo sale de la auditoría real");
        // saldo = libro de movimientos
        assertEquals(0, saldo().compareTo(jdbc.queryForObject("select coalesce(sum(case sentido when 'ENTRADA' then importe else -importe end),0) "
                + "from public.caja_movimientos m join public.cajas c on c.id = m.caja_id where c.asesor_id = ?", BigDecimal.class, asesor.getId())));
    }

    @Test
    void no_se_puede_recibir_de_mas_ni_pasar_de_50000_y_el_excedente_va_a_incidencia() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("10000");
        aprobar(sol, "10000", null);
        rechaza(Codigo.EXCEDE_AUTORIZADO, () -> reposiciones.registrarRecepcion(asesor, sol.fila().id(),
                new Recepcion(d("10000.01"), null, null, null, clave())));
        assertEquals(0, d("20000").compareTo(saldo()));                 // el excedente no se contabilizó
        ReposicionDetalle conInc = reposiciones.reportarIncidencia(asesor, sol.fila().id(),
                new NuevaIncidencia("EXCEDENTE", d("0.01"), "Llegó un centavo de más en el sobre"));
        assertEquals(1, conInc.incidencias().size());
        ReposicionDetalle rec = reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("10000"), null, null, null, clave()));
        assertEquals("RECIBIDA", rec.fila().estado());
        // con una incidencia abierta NO se puede conciliar
        rechaza(Codigo.INCIDENCIAS_ABIERTAS, () -> reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto(null, rec.version())));
        reposiciones.resolverIncidencia(gerente, conInc.incidencias().get(0).id(),
                new ResolverIncidencia("Revisado: error de conteo del asesor"));
        assertEquals("COMPLETADA", reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto(null, null)).fila().estado());
    }

    @Test
    void una_recepcion_repetida_con_la_misma_clave_no_suma_dos_veces() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("10000");
        aprobar(sol, "10000", null);
        String k = clave();
        reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("4000"), null, null, null, k));
        reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("4000"), null, null, null, k));
        assertEquals(0, d("24000").compareTo(saldo()));
        assertEquals(1, jdbc.queryForObject("select count(*) from public.reposicion_recepciones where reposicion_id = ?",
                Integer.class, sol.fila().id()));
    }

    @Test
    void la_misma_solicitud_enviada_dos_veces_no_se_duplica_y_no_hay_dos_abiertas() {
        gastar("30000.00");
        SolicitudReposicion cuerpo = new SolicitudReposicion(d("5000"), "ALTA_DEMANDA", "Hay mucha demanda esta semana", clave());
        ReposicionDetalle a = reposiciones.solicitar(asesor, cuerpo);
        ReposicionDetalle b = reposiciones.solicitar(asesor, cuerpo);   // doble clic
        assertEquals(a.fila().id(), b.fila().id());
        rechaza(Codigo.REPOSICION_EN_TRAMITE, () -> solicitar("1000")); // otra distinta mientras hay una abierta
    }

    @Test
    void la_solicitud_no_puede_superar_lo_que_cabe_en_la_caja() {
        gastar("10000.00");                                              // caben 10,000
        rechaza(Codigo.MONTO_EXCEDE_CAPACIDAD, () -> solicitar("10000.01"));
        assertEquals("PENDIENTE_APROBACION", solicitar("10000").fila().estado());
    }

    @Test
    void un_codigo_hermes_no_sirve_dos_veces() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("5000");
        String codigo = codigoNuevo();
        reposiciones.aprobar(gerente, sol.fila().id(), new AprobarReposicion(d("5000"), null, codigo, sol.version()));
        // cancelar el resto del circuito y pedir otra: el mismo código no vale para la nueva
        reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("5000"), null, null, null, clave()));
        reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto(null, null));
        gastar("5000.00");
        ReposicionDetalle otra = solicitar("5000");
        rechaza(Codigo.CODIGO_HERMES_REUTILIZADO, () -> reposiciones.aprobar(gerente, otra.fila().id(),
                new AprobarReposicion(d("5000"), null, codigo, otra.version())));
        assertEquals("PENDIENTE_APROBACION", reposiciones.detalle(gerente, otra.fila().id()).fila().estado());
    }

    @Test
    void un_codigo_que_hermes_no_reconoce_no_aprueba() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("5000");
        rechaza(Codigo.CODIGO_HERMES_INVALIDO, () -> reposiciones.aprobar(gerente, sol.fila().id(),
                new AprobarReposicion(d("5000"), null, "99999999", sol.version())));
        assertEquals("PENDIENTE_APROBACION", reposiciones.detalle(gerente, sol.fila().id()).fila().estado());
        assertEquals(1, jdbc.queryForObject("select count(*) from public.hermes_verificaciones where reposicion_id = ? and resultado = 'INVALIDO'",
                Integer.class, sol.fila().id()));
        // los códigos jamás se guardan: ninguna columna de hermes_verificaciones contiene los 8 dígitos
        assertEquals(0, jdbc.queryForObject("select count(*) from public.hermes_verificaciones h where h::text like '%99999999%'", Integer.class));
    }

    @Test
    void dos_aprobaciones_simultaneas_de_la_misma_solicitud_solo_aprueban_una_vez() throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            gastar("30000.00");
            ReposicionDetalle sol = solicitar("5000");
            CyclicBarrier salida = new CyclicBarrier(2);
            List<Future<Boolean>> res = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                String codigo = codigoNuevo();
                Callable<Boolean> aprobar = () -> {
                    salida.await();
                    try {
                        reposiciones.aprobar(gerente, sol.fila().id(), new AprobarReposicion(d("5000"), null, codigo, sol.version()));
                        return true;
                    } catch (CajaException e) {
                        assertTrue(e.getCodigo() == Codigo.ESTADO_INVALIDO || e.getCodigo() == Codigo.VERSION_DESACTUALIZADA
                                || e.getCodigo() == Codigo.CONFLICTO_CONCURRENCIA, e.getCodigo().name());
                        return false;
                    }
                };
                res.add(hilos.submit(aprobar));
            }
            int ok = 0;
            for (Future<Boolean> f : res) ok += f.get() ? 1 : 0;
            assertEquals(1, ok);
            assertEquals(1, jdbc.queryForObject("select count(*) from public.hermes_verificaciones where reposicion_id = ? and consumida_en is not null",
                    Integer.class, sol.fila().id()));
        } finally {
            hilos.shutdownNow();
        }
    }

    @Test
    void dos_recepciones_simultaneas_no_pasan_de_lo_autorizado() throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            gastar("30000.00");
            ReposicionDetalle sol = solicitar("10000");
            aprobar(sol, "10000", null);
            CyclicBarrier salida = new CyclicBarrier(2);
            List<Future<Boolean>> res = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                Callable<Boolean> recibir = () -> {
                    salida.await();
                    try {
                        reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("6000"), null, null, null, clave()));
                        return true;
                    } catch (CajaException e) {
                        assertTrue(e.getCodigo() == Codigo.EXCEDE_AUTORIZADO || e.getCodigo() == Codigo.ESTADO_INVALIDO, e.getCodigo().name());
                        return false;
                    }
                };
                res.add(hilos.submit(recibir));
            }
            int ok = 0;
            for (Future<Boolean> f : res) ok += f.get() ? 1 : 0;
            assertEquals(1, ok);
            assertEquals(0, d("26000").compareTo(saldo()));
        } finally {
            hilos.shutdownNow();
        }
    }

    @Test
    void recepcion_con_diferencia_abre_incidencia_se_cierra_el_remanente_y_solo_se_concilia_al_resolverla() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("10000");
        ReposicionDetalle apr = aprobar(sol, "10000", null);
        reposiciones.despachar(gerente, sol.fila().id(), new Despacho(d("10000"), "Ruta 3", null, apr.version()));
        ReposicionDetalle parcial = reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("7000"), null, null, null, clave()));
        rechaza(Codigo.DATOS_INVALIDOS, () -> reposiciones.cerrarRemanente(gerente, sol.fila().id(), new DecisionTexto("corto", parcial.version())));
        ReposicionDetalle cerrada = reposiciones.cerrarRemanente(gerente, sol.fila().id(),
                new DecisionTexto("El banco devolvió S/ 3,000 por error de empaque", parcial.version()));
        assertEquals("RECIBIDA", cerrada.fila().estado());
        assertEquals(0, d("3000").compareTo(cerrada.fila().remanenteCerrado()));
        // enviado (10,000) ≠ recibido (7,000): el sistema abre solo la incidencia de diferencia
        assertEquals(1, cerrada.incidencias().size());
        assertEquals("DIFERENCIA_ENVIO_RECEPCION", cerrada.incidencias().get(0).tipo());
        rechaza(Codigo.INCIDENCIAS_ABIERTAS, () -> reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto(null, null)));
        reposiciones.resolverIncidencia(gerente, cerrada.incidencias().get(0).id(), new ResolverIncidencia("Aclarado con el banco"));
        assertEquals("COMPLETADA", reposiciones.conciliar(gerente, sol.fila().id(), new DecisionTexto(null, null)).fila().estado());
        assertEquals(0, d("27000").compareTo(saldo()));
        // Tras cerrar la reposición se puede pedir otra (escenario: nueva solicitud después de una reposición parcial)
        assertEquals("PENDIENTE_APROBACION", solicitar("5000").fila().estado());
    }

    @Test
    void el_rechazo_exige_justificacion_la_cierra_y_no_deja_efectivo_ni_reserva() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("10000");
        rechaza(Codigo.DATOS_INVALIDOS, () -> reposiciones.rechazar(gerente, sol.fila().id(), new DecisionTexto("no", sol.version())));
        rechaza(Codigo.SIN_PERMISO, () -> reposiciones.rechazar(asesor, sol.fila().id(), new DecisionTexto("quiero rechazar la mía", sol.version())));
        ReposicionDetalle r = reposiciones.rechazar(gerente, sol.fila().id(), new DecisionTexto("No hay justificación operativa suficiente", sol.version()));
        assertEquals("RECHAZADA", r.fila().estado());
        assertEquals("No hay justificación operativa suficiente", r.justificacionDecision());
        assertEquals(0, d("20000").compareTo(saldo()));
        // una rechazada no se aprueba ni se recibe, y el asesor puede pedir otra
        rechaza(Codigo.ESTADO_INVALIDO, () -> reposiciones.aprobar(gerente, sol.fila().id(),
                new AprobarReposicion(d("10000"), null, codigoNuevo(), r.version())));
        rechaza(Codigo.ESTADO_INVALIDO, () -> reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("1"), null, null, null, clave())));
        assertEquals("PENDIENTE_APROBACION", solicitar("5000").fila().estado());
    }

    @Test
    void un_asesor_no_ve_ni_opera_la_reposicion_de_otro_y_no_se_filtra_que_existe() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("10000");
        Perfil otro = perfil("asesor");
        rechaza(Codigo.REPOSICION_NO_ENCONTRADA, () -> reposiciones.detalle(otro, sol.fila().id()));
        rechaza(Codigo.REPOSICION_NO_ENCONTRADA, () -> reposiciones.cancelar(otro, sol.fila().id(), new DecisionTexto(null, null)));
        assertEquals(0, consultas.listar(otro, new Consulta(null, null, null, asesor.getId(), null, null, null, null, null)).items().size()); // el filtro de otro asesor se ignora: ve solo lo suyo
        assertEquals(1, consultas.listar(gerente, new Consulta(null, null, null, asesor.getId(), null, null, null, null, null)).items().size());
    }

    @Test
    void el_reporte_cuadra_con_el_libro_de_movimientos() {
        gastar("30000.00");
        ReposicionDetalle sol = solicitar("20000");
        aprobar(sol, "20000", null);
        reposiciones.registrarRecepcion(asesor, sol.fila().id(), new Recepcion(d("12000"), null, null, null, clave()));
        var rep = consultas.reporte(gerente, new Consulta(null, null, null, asesor.getId(), null, null, null, null, null));
        BigDecimal esperado = rep.saldoInicial().add(rep.entradas()).subtract(rep.salidas());
        assertEquals(0, esperado.compareTo(rep.saldoActual()), "saldo inicial + entradas − salidas = saldo actual");
        assertEquals(0, d("32000").compareTo(rep.saldoActual()));
        assertEquals(0, saldo().compareTo(rep.saldoActual()));
        assertEquals(0, d("20000").compareTo(rep.totalSolicitado()));
        assertEquals(0, d("20000").compareTo(rep.totalAutorizado()));
        assertEquals(0, d("12000").compareTo(rep.totalRecibido()));
        assertEquals(0, BigDecimal.ZERO.compareTo(rep.totalConciliado()));  // recibir no es conciliar
        var supervision = consultas.supervision(gerente);
        assertTrue(supervision.cajas().stream().allMatch(c -> c.saldoCoincideConLibro()));
    }

    @Test
    void un_ajuste_con_motivo_queda_en_el_libro_y_en_el_saldo() {
        UUID caja = jdbc.queryForObject("select id from public.cajas where asesor_id = ?", UUID.class, asesor.getId());
        jdbc.update("insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, referencia, creado_por) "
                + "values (?, 'AJUSTE', 'SALIDA', 150, 50000, 49850, 'Faltante detectado en arqueo del 26/10', ?)", caja, gerente.getId());
        assertEquals(0, d("49850").compareTo(saldo()));
        assertThrows(org.springframework.dao.DataAccessException.class, () -> jdbc.update("update public.caja_movimientos set importe = 1"));
        assertThrows(org.springframework.dao.DataAccessException.class, () -> jdbc.update("delete from public.caja_movimientos"));
    }

    @Test
    void la_base_impide_pasarse_de_50000_aunque_el_codigo_fallara() {
        // Defensa en profundidad: aun saltándose el servicio, el libro rechaza un ingreso que pase del límite.
        UUID caja = jdbc.queryForObject("select id from public.cajas where asesor_id = ?", UUID.class, asesor.getId());
        assertThrows(org.springframework.dao.DataAccessException.class, () -> jdbc.update(
                "insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, referencia, creado_por) "
                        + "values (?, 'AJUSTE', 'ENTRADA', 1, 50000, 50001, 'intento de exceder el límite', ?)", caja, asesor.getId()));
        assertEquals(0, d("50000").compareTo(saldo()));
    }
}
