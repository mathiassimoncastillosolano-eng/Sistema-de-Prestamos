package com.nexora.backend.dashboard.repositorios;

import com.nexora.backend.dashboard.dto.CarteraRespuesta.ClienteFila;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.CuotaFila;
import com.nexora.backend.dashboard.dto.CarteraRespuesta.PrestamoFila;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Consultas de solo lectura para el dashboard. Usa SQL directo para no depender de las entidades de los otros módulos.
 */
@Repository
public class DashboardRepositorio {

    private static final String NOMBRE_ASESOR = "btrim(regexp_replace(pf.nombres || ' ' || pf.apellidos, '\\s+', ' ', 'g'))";
    private static final String REGISTRADO = "to_char(%s.creado_en at time zone 'America/Lima', 'YYYY-MM-DD HH24:MI')";

    private final JdbcTemplate jdbc;

    public DashboardRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Qué agencias puede ver la sesión: todas (gerencia) o solo una (asesor). */
    public record Alcance(UUID agenciaId) {
        public static final Alcance TODAS = new Alcance(null);

        /** Condición SQL sobre la columna de agencia; se completa con {@link #args()}. */
        String sobre(String columna) {
            return agenciaId == null ? "true" : columna + " = ?";
        }

        Object[] args() {
            return agenciaId == null ? new Object[0] : new Object[] { agenciaId };
        }
    }

    public List<String> agenciasActivas(Alcance alcance) {
        String sql = "select nombre from public.agencias where activa and %s order by nombre".formatted(alcance.sobre("id"));
        return jdbc.queryForList(sql, String.class, alcance.args());
    }

    public List<ClienteFila> clientes(Alcance alcance) {
        String sql = """
                select c.id, c.nombre, c.tipo_documento, c.numero_documento, c.telefono,
                       a.nombre as agencia, %s as asesor, (c.creado_en at time zone 'America/Lima')::date as alta,
                       %s as registrado
                from public.clientes c
                join public.agencias a on a.id = c.agencia_id
                join public.perfiles pf on pf.id = c.creado_por
                where %s
                order by c.nombre
                """.formatted(NOMBRE_ASESOR, REGISTRADO.formatted("c"), alcance.sobre("c.agencia_id"));
        return jdbc.query(sql, (rs, i) -> new ClienteFila(
                uuid(rs, "id"), rs.getString("nombre"), rs.getString("tipo_documento"),
                rs.getString("numero_documento"), rs.getString("telefono"), rs.getString("agencia"),
                rs.getString("asesor"), rs.getObject("alta", LocalDate.class), rs.getString("registrado")), alcance.args());
    }

    /** Préstamos sin cuotas; el servicio les añade las cuotas de {@link #cuotas()}. */
    public List<PrestamoFila> prestamos(Alcance alcance) {
        String sql = """
                select p.id, p.numero, p.cliente_id, a.nombre as agencia, %s as asesor,
                       p.capital, p.plazo_meses, p.tea, p.fecha_desembolso, %s as registrado
                from public.prestamos p
                join public.agencias a on a.id = p.agencia_id
                join public.perfiles pf on pf.id = p.asesor_id
                where %s
                order by p.creado_en desc
                """.formatted(NOMBRE_ASESOR, REGISTRADO.formatted("p"), alcance.sobre("p.agencia_id"));
        return jdbc.query(sql, (rs, i) -> new PrestamoFila(
                uuid(rs, "id"), rs.getLong("numero"), uuid(rs, "cliente_id"), rs.getString("agencia"),
                rs.getString("asesor"), rs.getBigDecimal("capital"), rs.getInt("plazo_meses"),
                rs.getBigDecimal("tea"), rs.getObject("fecha_desembolso", LocalDate.class),
                rs.getString("registrado"), List.of()), alcance.args());
    }

    public List<CuotaDePrestamo> cuotas(Alcance alcance) {
        String sql = """
                select cu.prestamo_id, cu.numero, cu.fecha_vencimiento, cu.capital, cu.interes, cu.importe_cuota, cu.saldo, cu.estado
                from public.cuotas cu
                join public.prestamos p on p.id = cu.prestamo_id
                where %s
                order by cu.prestamo_id, cu.numero
                """.formatted(alcance.sobre("p.agencia_id"));
        return jdbc.query(sql, (rs, i) -> new CuotaDePrestamo(uuid(rs, "prestamo_id"), new CuotaFila(
                rs.getInt("numero"), rs.getObject("fecha_vencimiento", LocalDate.class),
                rs.getBigDecimal("capital"), rs.getBigDecimal("interes"), rs.getBigDecimal("importe_cuota"),
                rs.getBigDecimal("saldo"), "PAGADA".equals(rs.getString("estado")))), alcance.args());
    }

    public record CuotaDePrestamo(UUID prestamoId, CuotaFila cuota) { }

    private static UUID uuid(ResultSet rs, String columna) throws SQLException {
        return rs.getObject(columna, UUID.class);
    }
}
