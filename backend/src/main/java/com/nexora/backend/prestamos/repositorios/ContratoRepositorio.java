package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Origen;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * public.contratos_prestamo (solo inserción; ver backend/sql/2026-10-25-contratos-y-consolidacion.sql) y los datos reales
 * con que se redacta un contrato. Nada de aquí modifica ni borra contratos.
 */
@Repository
public class ContratoRepositorio {

    private final JdbcTemplate jdbc;

    public ContratoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record ContratoGuardado(UUID id, int version, String plantillaVersion, String datos, String huella,
                                   /** yyyy-MM-dd HH:mm en America/Lima. */ String generadoEn, int totalVersiones) { }

    /** Partes, agencia (con su ubicación) y asesor, tal como están hoy en la BD. Vacío si algún id no existe. */
    public Optional<Origen> origen(UUID clienteId, UUID agenciaId, UUID asesorId) {
        List<Origen> filas = jdbc.query("""
                select c.nombre, c.tipo_documento, c.numero_documento, c.telefono, c.correo, c.dni_titular, c.domicilio,
                       c.representante_nombre, c.representante_dni,
                       a.nombre as agencia, u.departamento, u.provincia, u.distrito, u.direccion,
                       btrim(regexp_replace(pf.nombres || ' ' || pf.apellidos, '\\s+', ' ', 'g')) as asesor
                from public.clientes c
                join public.agencias a on a.id = ?
                join public.ubicaciones u on u.id = a.ubicacion_id
                join public.perfiles pf on pf.id = ?
                where c.id = ?
                """, (rs, i) -> new Origen(rs.getString("nombre"), rs.getString("tipo_documento"),
                rs.getString("numero_documento"), rs.getString("telefono"), rs.getString("correo"),
                rs.getString("dni_titular"), rs.getString("domicilio"), rs.getString("representante_nombre"),
                rs.getString("representante_dni"), rs.getString("agencia"), rs.getString("departamento"),
                rs.getString("provincia"), rs.getString("distrito"), rs.getString("direccion"), rs.getString("asesor")),
                agenciaId, asesorId, clienteId);
        return filas.stream().findFirst();
    }

    /** Agencia del préstamo (para autorizar el acceso a su contrato). Vacío si el préstamo no existe. */
    public Optional<UUID> agenciaDelPrestamo(UUID prestamoId) {
        return jdbc.query("select agencia_id from public.prestamos where id = ?",
                (rs, i) -> rs.getObject("agencia_id", UUID.class), prestamoId).stream().findFirst();
    }

    /** Número del préstamo (PR-xxxx), para identificar el contrato. */
    public Optional<Long> numeroDelPrestamo(UUID prestamoId) {
        return jdbc.query("select numero from public.prestamos where id = ?",
                (rs, i) -> rs.getLong("numero"), prestamoId).stream().findFirst();
    }

    /** Guarda una versión del contrato. La BD comprueba que la huella corresponde al texto y que la versión no existe. */
    public void insertar(UUID prestamoId, int version, String plantillaVersion, String datos, String huella, UUID generadoPor) {
        jdbc.update("""
                insert into public.contratos_prestamo (prestamo_id, version, plantilla_version, datos, huella_sha256, generado_por)
                values (?, ?, ?, ?, ?, ?)
                """, prestamoId, version, plantillaVersion, datos, huella, generadoPor);
    }

    /** La versión más reciente del contrato del préstamo, con cuántas versiones existen. */
    public Optional<ContratoGuardado> ultimo(UUID prestamoId) {
        return jdbc.query("""
                select id, version, plantilla_version, datos, huella_sha256,
                       to_char(generado_en at time zone 'America/Lima', 'YYYY-MM-DD HH24:MI') as generado,
                       (select count(*) from public.contratos_prestamo t where t.prestamo_id = c.prestamo_id) as total
                from public.contratos_prestamo c
                where prestamo_id = ?
                order by version desc
                limit 1
                """, (rs, i) -> new ContratoGuardado(rs.getObject("id", UUID.class), rs.getInt("version"),
                rs.getString("plantilla_version"), rs.getString("datos"), rs.getString("huella_sha256"),
                rs.getString("generado"), rs.getInt("total")), prestamoId).stream().findFirst();
    }
}
