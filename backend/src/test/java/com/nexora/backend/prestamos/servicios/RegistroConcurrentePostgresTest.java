package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import java.math.BigDecimal;
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
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Pruebas de concurrencia contra un PostgreSQL REAL (no simulado): dos asesores registran a la vez para el mismo cliente,
 * y un mismo asesor registra préstamos a la vez contra el efectivo de su caja.
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
        // Migración de caja (aditiva e idempotente) sobre la base LOCAL de prueba; se ejecuta desde backend/.
        new ResourceDatabasePopulator(new FileSystemResource("sql/2026-10-26-caja-y-reposiciones.sql"))
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

    // ------------------------------------------------------------ efectivo de la caja del asesor

    private UUID nuevoAsesor() {
        return jdbc.queryForObject("insert into public.perfiles (nombres, apellidos, correo, rol, agencia_id, clave_hash) "
                + "values ('Otro', 'Asesor', 'otro@prueba.local', 'asesor', ?, 'x') returning id", UUID.class, agenciaId);
    }

    private UUID clienteSinDeuda() {
        return jdbc.queryForObject("insert into public.clientes (tipo_documento, numero_documento, nombre, agencia_id, "
                + "creado_por) values ('DNI', '00000001', 'Cliente Sin Deuda', ?, ?) returning id",
                UUID.class, agenciaId, asesorId);
    }

    private BigDecimal saldoCaja(UUID asesor) {
        return jdbc.queryForObject("select saldo from public.cajas where asesor_id = ?", BigDecimal.class, asesor);
    }

    @Test
    void la_primera_vez_se_abre_la_caja_con_50000_y_el_desembolso_queda_en_el_libro() {
        UUID id = nuevoAsesor();
        servicio.registrar(asesor(id), new SolicitudPrestamo(clienteSinDeuda(), new BigDecimal("4000"), 12,
                null, null, null, null));
        assertEquals(0, new BigDecimal("46000").compareTo(saldoCaja(id)));
        assertEquals(1, jdbc.queryForObject("select count(*) from public.caja_movimientos m join public.cajas c "
                + "on c.id = m.caja_id where c.asesor_id = ? and m.tipo = 'APERTURA'", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("select count(*) from public.caja_movimientos m join public.cajas c "
                + "on c.id = m.caja_id where c.asesor_id = ? and m.tipo = 'DESEMBOLSO'", Integer.class, id));
        // El saldo coincide con el libro de movimientos.
        assertEquals(0, new BigDecimal("46000").compareTo(jdbc.queryForObject(
                "select coalesce(sum(case sentido when 'ENTRADA' then importe else -importe end), 0) "
                        + "from public.caja_movimientos m join public.cajas c on c.id = m.caja_id where c.asesor_id = ?",
                BigDecimal.class, id)));
    }

    @Test
    void el_saldo_se_arrastra_entre_dias_y_no_hay_tope_diario() {
        UUID id = nuevoAsesor();
        // Tres desembolsos de 10,000 en el mismo día (30,000) y uno más: antes lo frenaba el tope diario de 50,000
        // solo al pasar de ahí; ahora manda el efectivo.
        for (int i = 0; i < 4; i++) {
            servicio.registrar(asesor(id), new SolicitudPrestamo(clienteSinDeuda(), new BigDecimal("10000"), 12,
                    null, null, null, null));
        }
        assertEquals(0, new BigDecimal("10000").compareTo(saldoCaja(id)));
        // El saldo no se reinicia: se conserva hasta que llegue una reposición.
        PrestamoException ex = null;
        try {
            servicio.registrar(asesor(id), new SolicitudPrestamo(clienteSinDeuda(), new BigDecimal("10000.01"), 12,
                    null, null, null, null));
        } catch (PrestamoException e) {
            ex = e;
        }
        assertEquals(Codigo.SALDO_CAJA_INSUFICIENTE, ex.getCodigo());
        assertEquals(0, new BigDecimal("10000").compareTo(saldoCaja(id)));
    }

    @Test
    void dosRegistrosSimultaneosDelMismoAsesorNoGastanMasEfectivoDelQueTiene() throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(2);
        try {
            for (int ronda = 0; ronda < RONDAS; ronda++) {
                UUID id = nuevoAsesor();
                // Deja la caja con 5,000: abre la caja con un desembolso de 45,000 repartido en 5 préstamos de 9,000.
                for (int i = 0; i < 5; i++) {
                    servicio.registrar(asesor(id), new SolicitudPrestamo(clienteSinDeuda(), new BigDecimal("9000"), 12,
                            null, null, null, null));
                }
                assertEquals(0, new BigDecimal("5000").compareTo(saldoCaja(id)), "ronda " + ronda);
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
                            assertEquals(Codigo.SALDO_CAJA_INSUFICIENTE, e.getCodigo());
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
                assertEquals(0, BigDecimal.ZERO.compareTo(saldoCaja(id)), "ronda " + ronda + ": la caja queda en cero, nunca negativa");
                BigDecimal desembolsado = jdbc.queryForObject("select sum(capital) from public.prestamos where asesor_id = ?",
                        BigDecimal.class, id);
                assertEquals(0, new BigDecimal("50000").compareTo(desembolsado), "ronda " + ronda);
                // Un movimiento DESEMBOLSO por préstamo guardado, ni uno más ni uno menos.
                assertEquals(6, jdbc.queryForObject("select count(*) from public.caja_movimientos m join public.cajas c "
                        + "on c.id = m.caja_id where c.asesor_id = ? and m.tipo = 'DESEMBOLSO'", Integer.class, id));
            }
        } finally {
            hilos.shutdownNow();
        }
    }
}
