package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.dominio.LimiteDiarioAsesor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Pruebas de concurrencia contra un PostgreSQL REAL (no simulado): dos asesores registran a la vez para el mismo cliente,
 * y un mismo asesor registra dos préstamos a la vez cerca de su límite diario.
 * Solo corre si se define PRUEBA_PG_URL y apunta a una base local (nunca a Supabase). Ejemplo:
 * {@code PRUEBA_PG_URL=jdbc:postgresql://localhost:5432/postgres PRUEBA_PG_USER=postgres mvn test}
 */
@EnabledIfEnvironmentVariable(named = "PRUEBA_PG_URL", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1)[:/].*")
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=none",
        "apiperu.token=sin-token"
})
class RegistroConcurrentePostgresTest {

    private static final int RONDAS = 20;

    @DynamicPropertySource
    static void baseLocal(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("PRUEBA_PG_URL"));
        r.add("spring.datasource.username", () -> System.getenv().getOrDefault("PRUEBA_PG_USER", "postgres"));
        r.add("spring.datasource.password", () -> System.getenv().getOrDefault("PRUEBA_PG_PASSWORD", ""));
    }

    @Autowired
    private PrestamoServicio servicio;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID agenciaId;
    private UUID asesorId;

    @BeforeEach
    void preparar() {
        new ResourceDatabasePopulator(new ClassPathResource("esquema-prueba-concurrencia.sql"))
                .execute(jdbc.getDataSource());
        UUID ubicacion = jdbc.queryForObject("insert into public.ubicaciones (departamento, provincia, distrito) "
                + "values ('Piura', 'Piura', 'Piura') returning id", UUID.class);
        agenciaId = jdbc.queryForObject("insert into public.agencias (nombre, ubicacion_id) values ('Agencia Prueba', ?) "
                + "returning id", UUID.class, ubicacion);
        asesorId = jdbc.queryForObject("insert into public.perfiles (nombres, apellidos, correo, rol, agencia_id, clave_hash) "
                + "values ('Asesor', 'Prueba', 'asesor@prueba.local', 'asesor', ?, 'x') returning id", UUID.class, agenciaId);
    }

    /** Cliente nuevo que ya debe S/ 2,000 (un préstamo Vigente con una sola cuota pendiente). */
    private UUID clienteQueDebe2000() {
        UUID cliente = jdbc.queryForObject("insert into public.clientes (tipo_documento, numero_documento, nombre, "
                + "agencia_id, creado_por) values ('DNI', '00000000', 'Cliente Prueba', ?, ?) returning id",
                UUID.class, agenciaId, asesorId);
        UUID prestamo = jdbc.queryForObject("insert into public.prestamos (cliente_id, agencia_id, asesor_id, capital, "
                + "plazo_meses, tea, fecha_desembolso) values (?, ?, ?, 2000, 1, 0.3, current_date) returning id",
                UUID.class, cliente, agenciaId, asesorId);
        jdbc.update("insert into public.cuotas (prestamo_id, numero, fecha_vencimiento, capital, interes, importe_cuota, saldo) "
                + "values (?, 1, current_date + 30, 2000, 44, 2044, 0)", prestamo);
        return cliente;
    }

    private Perfil asesor() {
        return asesor(asesorId);
    }

    private Perfil asesor(UUID id) {
        Agencia agencia = mock(Agencia.class);
        when(agencia.getId()).thenReturn(agenciaId);
        Perfil p = mock(Perfil.class);
        when(p.getId()).thenReturn(id);
        when(p.getRol()).thenReturn("asesor");
        when(p.getAgencia()).thenReturn(agencia);
        return p;
    }

    @Test
    void dosRegistrosSimultaneosNoSuperanElLimite() throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            for (int ronda = 0; ronda < RONDAS; ronda++) {
                // Un asesor por ronda: 20 préstamos de 5,000 de un mismo asesor chocarían con su límite diario.
                Perfil asesor = asesor(nuevoAsesor());
                UUID cliente = clienteQueDebe2000(); // disponible: 8,000
                CyclicBarrier salida = new CyclicBarrier(2);
                // Cada uno pide 5,000: por separado caben, juntos sumarían 12,000.
                Callable<Boolean> registrar = () -> {
                    salida.await();
                    try {
                        servicio.registrar(asesor, new SolicitudPrestamo(cliente, new BigDecimal("5000"), 12,
                                null, null, null, null));
                        return true;
                    } catch (PrestamoException e) {
                        assertEquals(Codigo.LIMITE_EXCEDIDO, e.getCodigo());
                        return false;
                    }
                };
                List<Future<Boolean>> resultados = new ArrayList<>();
                resultados.add(hilos.submit(registrar));
                resultados.add(hilos.submit(registrar));
                int aceptados = 0;
                for (Future<Boolean> r : resultados) {
                    aceptados += r.get() ? 1 : 0;
                }

                assertEquals(1, aceptados, "ronda " + ronda + ": solo uno de los dos registros debe pasar");
                BigDecimal capital = jdbc.queryForObject("select sum(capital) from public.prestamos where cliente_id = ?",
                        BigDecimal.class, cliente);
                assertEquals(0, new BigDecimal("7000").compareTo(capital), "ronda " + ronda);
                // El rechazado no dejó nada a medias: solo hay cuotas de los dos préstamos guardados (1 + 12).
                Integer cuotas = jdbc.queryForObject("select count(*) from public.cuotas cu join public.prestamos p "
                        + "on p.id = cu.prestamo_id where p.cliente_id = ?", Integer.class, cliente);
                assertEquals(13, cuotas, "ronda " + ronda);
            }
        } finally {
            hilos.shutdownNow();
        }
    }

    // ------------------------------------------------------------ límite diario del asesor

    private static final LocalDate HOY_LIMA = LocalDate.now(ZoneId.of("America/Lima"));

    private UUID nuevoAsesor() {
        return jdbc.queryForObject("insert into public.perfiles (nombres, apellidos, correo, rol, agencia_id, clave_hash) "
                + "values ('Otro', 'Asesor', 'otro@prueba.local', 'asesor', ?, 'x') returning id", UUID.class, agenciaId);
    }

    private UUID clienteSinDeuda() {
        return jdbc.queryForObject("insert into public.clientes (tipo_documento, numero_documento, nombre, agencia_id, "
                + "creado_por) values ('DNI', '00000001', 'Cliente Sin Deuda', ?, ?) returning id",
                UUID.class, agenciaId, asesorId);
    }

    /** Préstamo guardado directo en la tabla (sin cuotas): solo sirve para sumar lo colocado por un asesor. */
    private void prestamoDe(UUID asesor, String capital, LocalDate fecha, String estado) {
        jdbc.update("insert into public.prestamos (cliente_id, agencia_id, asesor_id, capital, plazo_meses, tea, "
                + "fecha_desembolso, estado) values (?, ?, ?, ?, 12, 0.3, ?, ?)",
                clienteSinDeuda(), agenciaId, asesor, new BigDecimal(capital), fecha, estado);
    }

    @Test
    void soloCuentaLoColocadoHoyPorEseAsesorAunqueYaEsteCancelado() {
        UUID otro = nuevoAsesor();
        prestamoDe(asesorId, "9000", HOY_LIMA.minusDays(1), "Vigente"); // ayer: no cuenta
        prestamoDe(otro, "9000", HOY_LIMA, "Vigente");                  // otro asesor: no cuenta
        prestamoDe(asesorId, "4000", HOY_LIMA, "Vigente");
        prestamoDe(asesorId, "3000", HOY_LIMA, "Cancelado");            // ya pagado: igual cuenta

        LimiteDiarioAsesor l = servicio.limiteDiario(asesor());
        assertEquals(0, new BigDecimal("7000").compareTo(l.colocadoHoy()));
        assertEquals(0, new BigDecimal("43000").compareTo(l.disponible()));
        assertEquals(0, new BigDecimal("9000").compareTo(servicio.limiteDiario(asesor(otro)).colocadoHoy()));
        // El préstamo de ayer sigue guardado: el límite se reinicia sin borrar nada.
        Integer historicos = jdbc.queryForObject("select count(*) from public.prestamos where asesor_id = ? "
                + "and fecha_desembolso < ?", Integer.class, asesorId, HOY_LIMA);
        assertEquals(1, historicos);
    }

    @Test
    void dosRegistrosSimultaneosDelMismoAsesorNoPasanSuLimiteDiario() throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            for (int ronda = 0; ronda < RONDAS; ronda++) {
                UUID id = nuevoAsesor();
                for (int i = 0; i < 5; i++) {
                    prestamoDe(id, "9000", HOY_LIMA, "Vigente"); // 45,000 colocados hoy: le quedan 5,000
                }
                Perfil asesor = asesor(id);
                CyclicBarrier salida = new CyclicBarrier(2);
                // Dos clientes distintos, sin deuda: cada préstamo de 5,000 cabe solo, los dos juntos no.
                List<Future<Boolean>> resultados = new ArrayList<>();
                for (int i = 0; i < 2; i++) {
                    UUID cliente = clienteSinDeuda();
                    Callable<Boolean> registrar = () -> {
                        salida.await();
                        try {
                            servicio.registrar(asesor, new SolicitudPrestamo(cliente, new BigDecimal("5000"), 12,
                                    null, null, null, null));
                            return true;
                        } catch (PrestamoException e) {
                            assertEquals(Codigo.LIMITE_DIARIO_EXCEDIDO, e.getCodigo());
                            return false;
                        }
                    };
                    resultados.add(hilos.submit(registrar));
                }
                int aceptados = 0;
                for (Future<Boolean> r : resultados) {
                    aceptados += r.get() ? 1 : 0;
                }

                assertEquals(1, aceptados, "ronda " + ronda + ": solo uno de los dos registros debe pasar");
                BigDecimal colocado = jdbc.queryForObject("select sum(capital) from public.prestamos where asesor_id = ? "
                        + "and fecha_desembolso = ?", BigDecimal.class, id, HOY_LIMA);
                assertEquals(0, new BigDecimal("50000").compareTo(colocado), "ronda " + ronda);
            }
        } finally {
            hilos.shutdownNow();
        }
    }
}
