package com.nexora.backend.caja.repositorios;

import com.nexora.backend.caja.dto.CajaDtos.Movimiento;
import com.nexora.backend.caja.dto.CajaDtos.UltimaRecepcion;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Acceso a cajas y a su libro de movimientos. SQL directo: el saldo solo cambia insertando un movimiento (un trigger de la
 * base de datos lo aplica y rechaza todo lo que deje la caja fuera de 0..límite).
 */
@Repository
public class CajaRepositorio {

    public record CajaFila(UUID id, UUID asesorId, UUID agenciaId, BigDecimal limite, BigDecimal saldo,
                           BigDecimal saldoInicial, String estado, Instant abiertaEn) {
    }

    static final String COLUMNAS = "c.id, c.asesor_id, c.agencia_id, c.limite, c.saldo, c.saldo_inicial, c.estado, c.abierta_en";

    private final JdbcTemplate jdbc;

    public CajaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static CajaFila fila(ResultSet rs, int i) throws SQLException {
        return new CajaFila(rs.getObject("id", UUID.class), rs.getObject("asesor_id", UUID.class),
                rs.getObject("agencia_id", UUID.class), rs.getBigDecimal("limite"), rs.getBigDecimal("saldo"),
                rs.getBigDecimal("saldo_inicial"), rs.getString("estado"), instante(rs, "abierta_en"));
    }

    public static Instant instante(ResultSet rs, String columna) throws SQLException {
        Timestamp t = rs.getTimestamp(columna);
        return t == null ? null : t.toInstant();
    }

    public Optional<CajaFila> porAsesor(UUID asesorId) {
        return jdbc.query("select " + COLUMNAS + " from public.cajas c where c.asesor_id = ?", CajaRepositorio::fila, asesorId)
                .stream().findFirst();
    }

    public Optional<CajaFila> porId(UUID cajaId) {
        return jdbc.query("select " + COLUMNAS + " from public.cajas c where c.id = ?", CajaRepositorio::fila, cajaId)
                .stream().findFirst();
    }

    /** Bloquea la fila de la caja hasta el fin de la transacción: todo movimiento de la caja se serializa aquí. */
    public Optional<CajaFila> bloquearPorAsesor(UUID asesorId) {
        return jdbc.query("select " + COLUMNAS + " from public.cajas c where c.asesor_id = ? for update",
                CajaRepositorio::fila, asesorId).stream().findFirst();
    }

    public Optional<CajaFila> bloquearPorId(UUID cajaId) {
        return jdbc.query("select " + COLUMNAS + " from public.cajas c where c.id = ? for update",
                CajaRepositorio::fila, cajaId).stream().findFirst();
    }

    /** Crea la caja vacía si no existe (idempotente y seguro ante dos llamadas simultáneas). true = la creó esta llamada. */
    public boolean crearSiNoExiste(UUID asesorId, UUID agenciaId, UUID abiertaPor) {
        return jdbc.update("""
                insert into public.cajas (asesor_id, agencia_id, saldo, abierta_por)
                values (?, ?, 0, ?)
                on conflict (asesor_id) do nothing
                """, asesorId, agenciaId, abiertaPor) > 0;
    }

    /**
     * Inserta un movimiento del libro. El trigger de la base de datos comprueba saldo_antes contra el saldo real y actualiza
     * el saldo de la caja; si el resultado queda fuera de 0..límite, el INSERT falla y no queda nada.
     */
    public void insertarMovimiento(UUID cajaId, String tipo, String sentido, BigDecimal importe, BigDecimal saldoAntes,
                                   BigDecimal saldoDespues, UUID prestamoId, UUID reposicionId, UUID recepcionId,
                                   String referencia, UUID creadoPor, UUID correlacionId) {
        jdbc.update("""
                insert into public.caja_movimientos
                    (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, prestamo_id, reposicion_id, recepcion_id,
                     referencia, creado_por, correlacion_id)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, cajaId, tipo, sentido, importe, saldoAntes, saldoDespues, prestamoId, reposicionId, recepcionId,
                referencia, creadoPor, correlacionId);
    }

    /** Lo autorizado y aún no recibido de las reposiciones de la caja (excluyendo una, si se indica). No es efectivo. */
    public BigDecimal autorizadoPendiente(UUID cajaId, UUID excluirReposicionId) {
        String base = """
                select coalesce(sum(monto_autorizado - total_recibido - cierre_remanente_importe), 0)
                from public.reposiciones
                where caja_id = ? and estado in ('APROBADA', 'EN_TRANSITO', 'RECEPCION_PARCIAL')
                """;
        BigDecimal r = excluirReposicionId == null
                ? jdbc.queryForObject(base, BigDecimal.class, cajaId)
                : jdbc.queryForObject(base + " and id <> ?", BigDecimal.class, cajaId, excluirReposicionId);
        return r == null ? BigDecimal.ZERO.setScale(2) : r.setScale(2);
    }

    public List<Movimiento> movimientos(UUID cajaId, int limite, int desplazamiento) {
        return jdbc.query("""
                select m.id, m.numero, m.tipo, m.sentido, m.importe, m.saldo_antes, m.saldo_despues,
                       p.numero as prestamo_numero, r.numero as reposicion_numero, m.referencia,
                       btrim(regexp_replace(pf.nombres || ' ' || pf.apellidos, '\\s+', ' ', 'g')) as registrado_por,
                       m.creado_en
                from public.caja_movimientos m
                join public.perfiles pf on pf.id = m.creado_por
                left join public.prestamos p on p.id = m.prestamo_id
                left join public.reposiciones r on r.id = m.reposicion_id
                where m.caja_id = ?
                order by m.numero desc
                limit ? offset ?
                """, (rs, i) -> new Movimiento(rs.getObject("id", UUID.class), rs.getLong("numero"), rs.getString("tipo"),
                rs.getString("sentido"), rs.getBigDecimal("importe"), rs.getBigDecimal("saldo_antes"),
                rs.getBigDecimal("saldo_despues"), (Long) rs.getObject("prestamo_numero"),
                (Long) rs.getObject("reposicion_numero"), rs.getString("referencia"), rs.getString("registrado_por"),
                instante(rs, "creado_en")), cajaId, limite, desplazamiento);
    }

    public long contarMovimientos(UUID cajaId) {
        Long n = jdbc.queryForObject("select count(*) from public.caja_movimientos where caja_id = ?", Long.class, cajaId);
        return n == null ? 0 : n;
    }

    public Optional<UltimaRecepcion> ultimaRecepcion(UUID cajaId) {
        return jdbc.query("""
                select rc.importe, rc.registrado_en, r.numero
                from public.reposicion_recepciones rc
                join public.reposiciones r on r.id = rc.reposicion_id
                where r.caja_id = ?
                order by rc.registrado_en desc
                limit 1
                """, (rs, i) -> new UltimaRecepcion(rs.getBigDecimal("importe"), instante(rs, "registrado_en"),
                rs.getLong("numero")), cajaId).stream().findFirst();
    }

    public int incidenciasAbiertas(UUID cajaId) {
        Integer n = jdbc.queryForObject("""
                select count(*) from public.reposicion_incidencias i
                join public.reposiciones r on r.id = i.reposicion_id
                where r.caja_id = ? and i.estado = 'ABIERTA'
                """, Integer.class, cajaId);
        return n == null ? 0 : n;
    }

    /** true si el saldo de la caja coincide con la suma de su libro de movimientos (control de consistencia). */
    public boolean saldoCoincideConLibro(UUID cajaId) {
        Boolean ok = jdbc.queryForObject("""
                select c.saldo = coalesce((select sum(case m.sentido when 'ENTRADA' then m.importe else -m.importe end)
                                           from public.caja_movimientos m where m.caja_id = c.id), 0)
                from public.cajas c where c.id = ?
                """, Boolean.class, cajaId);
        return Boolean.TRUE.equals(ok);
    }
}
