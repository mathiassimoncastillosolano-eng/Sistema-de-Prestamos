package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Consultas de solo lectura para el listado y el detalle de préstamos. Cada una trae todo en dos sentencias
 * (préstamos con sus joins y cuotas del mismo filtro): no hay consultas por fila.
 */
@Repository
public class PrestamoConsultaRepositorio {

    private static final String NOMBRE_ASESOR = "btrim(regexp_replace(pf.nombres || ' ' || pf.apellidos, '\\s+', ' ', 'g'))";

    private final JdbcTemplate jdbc;

    public PrestamoConsultaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Qué préstamos se consultan. Las condiciones son literales del código; los valores siempre van enlazados. */
    public record Filtro(String condicion, Object[] argumentos) {
        public static Filtro todos() { return new Filtro("true", new Object[0]); }
        public static Filtro deAgencia(UUID agenciaId) { return new Filtro("p.agencia_id = ?", new Object[] { agenciaId }); }
        public static Filtro deCliente(UUID clienteId) { return new Filtro("p.cliente_id = ?", new Object[] { clienteId }); }
        public static Filtro deUnPrestamo(UUID prestamoId) { return new Filtro("p.id = ?", new Object[] { prestamoId }); }
    }

    public record CabeceraPrestamo(
            UUID id,
            Long numero,
            UUID clienteId,
            String clienteNombre,
            String clienteTipoDocumento,
            String clienteNumeroDocumento,
            /** Código de cliente (clientes.numero) y celular, tal como están en la BD; el celular puede ser null. */
            Long clienteCodigo,
            String clienteTelefono,
            String agenciaNombre,
            String asesorNombre,
            UUID asesorId,
            BigDecimal capital,
            int plazoMeses,
            BigDecimal tea,
            LocalDate fechaDesembolso,
            String estado,
            String observaciones,
            /** yyyy-MM-dd HH:mm en America/Lima. */
            String registradoEn) { }

    public record CuotaDePrestamo(UUID prestamoId, CuotaGuardada cuota) { }

    public List<CabeceraPrestamo> cabeceras(Filtro filtro) {
        String sql = """
                select p.id, p.numero, p.cliente_id, c.nombre as cliente_nombre, c.tipo_documento, c.numero_documento,
                       c.numero as cliente_codigo, c.telefono as cliente_telefono,
                       a.nombre as agencia, %s as asesor, p.asesor_id, p.capital, p.plazo_meses, p.tea,
                       p.fecha_desembolso, p.estado, p.observaciones,
                       to_char(p.creado_en at time zone 'America/Lima', 'YYYY-MM-DD HH24:MI') as registrado
                from public.prestamos p
                join public.clientes c on c.id = p.cliente_id
                join public.agencias a on a.id = p.agencia_id
                join public.perfiles pf on pf.id = p.asesor_id
                where %s
                order by p.fecha_desembolso desc, p.numero desc
                """.formatted(NOMBRE_ASESOR, filtro.condicion());
        return jdbc.query(sql, (rs, i) -> new CabeceraPrestamo(
                uuid(rs, "id"), rs.getLong("numero"), uuid(rs, "cliente_id"), rs.getString("cliente_nombre"),
                rs.getString("tipo_documento"), rs.getString("numero_documento"),
                rs.getObject("cliente_codigo", Long.class), rs.getString("cliente_telefono"), rs.getString("agencia"),
                rs.getString("asesor"), uuid(rs, "asesor_id"), rs.getBigDecimal("capital"), rs.getInt("plazo_meses"),
                rs.getBigDecimal("tea"), rs.getObject("fecha_desembolso", LocalDate.class), rs.getString("estado"),
                rs.getString("observaciones"), rs.getString("registrado")), filtro.argumentos());
    }

    public List<CuotaDePrestamo> cuotas(Filtro filtro) {
        String sql = """
                select cu.prestamo_id, cu.numero, cu.fecha_vencimiento, cu.capital, cu.interes, cu.importe_cuota,
                       cu.saldo, cu.estado
                from public.cuotas cu
                join public.prestamos p on p.id = cu.prestamo_id
                where %s
                order by cu.prestamo_id, cu.numero
                """.formatted(filtro.condicion());
        return jdbc.query(sql, (rs, i) -> new CuotaDePrestamo(uuid(rs, "prestamo_id"), new CuotaGuardada(
                rs.getInt("numero"), rs.getObject("fecha_vencimiento", LocalDate.class),
                rs.getBigDecimal("capital"), rs.getBigDecimal("interes"), rs.getBigDecimal("importe_cuota"),
                rs.getBigDecimal("saldo"), rs.getString("estado"))), filtro.argumentos());
    }

    private static UUID uuid(ResultSet rs, String columna) throws SQLException {
        return rs.getObject(columna, UUID.class);
    }
}
