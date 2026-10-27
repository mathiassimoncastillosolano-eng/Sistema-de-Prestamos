package com.nexora.backend.caja.repositorios;

import com.nexora.backend.caja.dto.CajaDtos.Pendientes;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Consultas agregadas de solo lectura: contadores, supervisión de cajas y reportes. */
@Repository
public class CajaConsultaRepositorio {

    public record CajaAgregada(UUID cajaId, UUID asesorId, String asesor, UUID agenciaId, String agencia, String estado,
                               BigDecimal saldo, BigDecimal limite, BigDecimal autorizadoPendiente, BigDecimal enTransito,
                               int parciales, int porRevisar, BigDecimal diferencias, int incidencias, boolean coincide) {
    }

    public record Totales(BigDecimal saldoInicial, BigDecimal entradas, BigDecimal salidas, BigDecimal saldoActual,
                          int reposiciones, BigDecimal solicitado, BigDecimal autorizado, BigDecimal enviado,
                          BigDecimal recibido, BigDecimal conciliado, BigDecimal diferencias) {
    }

    private static final String NOMBRE = "btrim(regexp_replace(pa.nombres || ' ' || pa.apellidos, '\\s+', ' ', 'g'))";

    private final JdbcTemplate jdbc;

    public CajaConsultaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Contadores para avisos: del asesor (si se indica) o de toda la empresa. */
    public Pendientes pendientes(UUID asesorId, Instant ahora) {
        String sql = """
                select count(*) filter (where r.estado = 'PENDIENTE_APROBACION') as por_revisar,
                       count(*) filter (where r.estado in ('APROBADA','EN_TRANSITO','RECEPCION_PARCIAL')) as por_recibir,
                       count(*) filter (where r.estado = 'OBSERVADA') as observadas,
                       count(*) filter (where r.estado = 'RECIBIDA') as por_conciliar,
                       count(*) filter (where r.estado = 'EN_TRANSITO') as en_transito,
                       coalesce(sum((select count(*) from public.reposicion_incidencias i
                                      where i.reposicion_id = r.id and i.estado = 'ABIERTA')), 0) as incidencias
                from public.reposiciones r
                """ + (asesorId == null ? "" : " where r.asesor_id = ?");
        return jdbc.query(sql, rs -> {
            rs.next();
            return new Pendientes(rs.getInt("por_revisar"), rs.getInt("por_recibir"), rs.getInt("observadas"),
                    rs.getInt("por_conciliar"), rs.getInt("incidencias"), rs.getInt("en_transito"), ahora);
        }, asesorId == null ? new Object[0] : new Object[] { asesorId });
    }

    public List<CajaAgregada> supervision() {
        return jdbc.query("""
                select c.id as caja_id, c.asesor_id, %s as asesor, c.agencia_id, a.nombre as agencia, c.estado, c.saldo, c.limite,
                       coalesce(sum(r.monto_autorizado - r.total_recibido - r.cierre_remanente_importe)
                                filter (where r.estado in ('APROBADA','EN_TRANSITO','RECEPCION_PARCIAL')), 0) as autorizado_pendiente,
                       coalesce(sum(r.monto_autorizado - r.total_recibido - r.cierre_remanente_importe)
                                filter (where r.estado = 'EN_TRANSITO'), 0) as en_transito,
                       count(r.id) filter (where r.estado = 'RECEPCION_PARCIAL') as parciales,
                       count(r.id) filter (where r.estado = 'PENDIENTE_APROBACION') as por_revisar,
                       coalesce((select sum(i.importe) from public.reposicion_incidencias i
                                   join public.reposiciones r2 on r2.id = i.reposicion_id
                                  where r2.caja_id = c.id and i.estado = 'ABIERTA'), 0) as diferencias,
                       (select count(*) from public.reposicion_incidencias i
                          join public.reposiciones r2 on r2.id = i.reposicion_id
                         where r2.caja_id = c.id and i.estado = 'ABIERTA') as incidencias,
                       c.saldo = coalesce((select sum(case m.sentido when 'ENTRADA' then m.importe else -m.importe end)
                                             from public.caja_movimientos m where m.caja_id = c.id), 0) as coincide
                from public.cajas c
                join public.perfiles pa on pa.id = c.asesor_id
                join public.agencias a on a.id = c.agencia_id
                left join public.reposiciones r on r.caja_id = c.id
                group by c.id, pa.nombres, pa.apellidos, a.nombre
                order by a.nombre, pa.apellidos, pa.nombres
                """.formatted(NOMBRE),
                (rs, i) -> new CajaAgregada(rs.getObject("caja_id", UUID.class), rs.getObject("asesor_id", UUID.class),
                        rs.getString("asesor"), rs.getObject("agencia_id", UUID.class), rs.getString("agencia"),
                        rs.getString("estado"), rs.getBigDecimal("saldo"), rs.getBigDecimal("limite"),
                        rs.getBigDecimal("autorizado_pendiente"), rs.getBigDecimal("en_transito"), rs.getInt("parciales"),
                        rs.getInt("por_revisar"), rs.getBigDecimal("diferencias"), rs.getInt("incidencias"),
                        rs.getBoolean("coincide")));
    }

    /**
     * Totales del periodo. {@code asesorId}/{@code agenciaId} acotan el alcance (null = sin acotar). Las fechas son días de
     * Lima. Todo sale de movimientos y reposiciones reales.
     */
    public Totales totales(UUID asesorId, UUID agenciaId, LocalDate desde, LocalDate hasta, List<String> estados) {
        List<Object> pc = new ArrayList<>();
        String cajasWhere = " where true" + filtroCaja(asesorId, agenciaId, pc);
        List<Object> pm = new ArrayList<>(pc);

        // movimientos
        String fechaMov = "(m.creado_en at time zone 'America/Lima')::date";
        StringBuilder sbm = new StringBuilder();
        sbm.append("""
                select coalesce(sum(case when m.sentido = 'ENTRADA' then m.importe else -m.importe end)
                                filter (where %1$s < ?), 0) as saldo_inicial,
                       coalesce(sum(m.importe) filter (where m.sentido = 'ENTRADA' and %1$s >= ? and %1$s <= ?), 0) as entradas,
                       coalesce(sum(m.importe) filter (where m.sentido = 'SALIDA' and %1$s >= ? and %1$s <= ?), 0) as salidas
                from public.caja_movimientos m
                join public.cajas c on c.id = m.caja_id
                """.formatted(fechaMov)).append(cajasWhere);
        List<Object> argsMov = new ArrayList<>();
        Date d = Date.valueOf(desde), h = Date.valueOf(hasta);
        argsMov.add(d); argsMov.add(d); argsMov.add(h); argsMov.add(d); argsMov.add(h);
        argsMov.addAll(pm);
        BigDecimal[] mov = jdbc.query(sbm.toString(), rs -> {
            rs.next();
            return new BigDecimal[] { rs.getBigDecimal("saldo_inicial"), rs.getBigDecimal("entradas"), rs.getBigDecimal("salidas") };
        }, argsMov.toArray());

        BigDecimal saldoActual = jdbc.queryForObject("select coalesce(sum(c.saldo), 0) from public.cajas c" + cajasWhere,
                BigDecimal.class, pc.toArray());

        // reposiciones del periodo
        List<Object> argsRep = new ArrayList<>();
        StringBuilder wr = new StringBuilder(" where (r.creado_en at time zone 'America/Lima')::date >= ? "
                + "and (r.creado_en at time zone 'America/Lima')::date <= ?");
        argsRep.add(d); argsRep.add(h);
        if (asesorId != null) { wr.append(" and r.asesor_id = ?"); argsRep.add(asesorId); }
        if (agenciaId != null) { wr.append(" and r.agencia_id = ?"); argsRep.add(agenciaId); }
        if (estados != null && !estados.isEmpty()) {
            wr.append(" and r.estado in (").append(String.join(",", java.util.Collections.nCopies(estados.size(), "?"))).append(")");
            argsRep.addAll(estados);
        }
        Totales t = jdbc.query("""
                select count(*) as n,
                       coalesce(sum(r.monto_solicitado), 0) as solicitado,
                       coalesce(sum(r.monto_autorizado), 0) as autorizado,
                       coalesce(sum(r.monto_enviado), 0) as enviado,
                       coalesce(sum(r.total_recibido), 0) as recibido,
                       coalesce(sum(r.total_recibido) filter (where r.estado = 'COMPLETADA'), 0) as conciliado,
                       coalesce(sum((select coalesce(sum(i.importe), 0) from public.reposicion_incidencias i
                                      where i.reposicion_id = r.id and i.estado = 'ABIERTA')), 0) as diferencias
                from public.reposiciones r
                """ + wr, rs -> {
            rs.next();
            return new Totales(mov[0], mov[1], mov[2], saldoActual, rs.getInt("n"), rs.getBigDecimal("solicitado"),
                    rs.getBigDecimal("autorizado"), rs.getBigDecimal("enviado"), rs.getBigDecimal("recibido"),
                    rs.getBigDecimal("conciliado"), rs.getBigDecimal("diferencias"));
        }, argsRep.toArray());
        return t;
    }

    private static String filtroCaja(UUID asesorId, UUID agenciaId, List<Object> args) {
        StringBuilder sb = new StringBuilder();
        if (asesorId != null) { sb.append(" and c.asesor_id = ?"); args.add(asesorId); }
        if (agenciaId != null) { sb.append(" and c.agencia_id = ?"); args.add(agenciaId); }
        return sb.toString();
    }
}
