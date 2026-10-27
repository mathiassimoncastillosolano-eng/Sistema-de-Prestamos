package com.nexora.backend.caja.repositorios;

import static com.nexora.backend.caja.repositorios.CajaRepositorio.instante;

import com.nexora.backend.caja.dominio.EstadoReposicion;
import com.nexora.backend.caja.dto.CajaDtos.EventoLinea;
import com.nexora.backend.caja.dto.CajaDtos.IncidenciaFila;
import com.nexora.backend.caja.dto.CajaDtos.RecepcionFila;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionFila;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL de reposiciones, recepciones, incidencias, verificaciones Hermes y auditoría. */
@Repository
public class ReposicionRepositorio {

    /** Fila completa de reposiciones (uso interno de los servicios). */
    public record Registro(UUID id, long numero, UUID cajaId, UUID asesorId, UUID agenciaId, BigDecimal montoSolicitado,
                           String motivo, String comentarios, BigDecimal saldoAlSolicitar,
                           BigDecimal capacidadAlSolicitar, EstadoReposicion estado, BigDecimal montoAutorizado,
                           UUID decididoPor, Instant decididoEn, String justificacionDecision, UUID hermesVerificacionId,
                           BigDecimal montoEnviado, Instant enviadoEn, String referenciaEnvio, BigDecimal totalRecibido,
                           BigDecimal cierreRemanenteImporte, int version, Instant creadoEn, Instant actualizadoEn) {

        /** Autorizado − recibido − remanente cerrado, solo mientras el estado reserva capacidad; si no, 0. */
        public BigDecimal pendienteRecepcion() {
            if (montoAutorizado == null || !estado.reservaCapacidad()) return BigDecimal.ZERO.setScale(2);
            return montoAutorizado.subtract(totalRecibido).subtract(cierreRemanenteImporte).max(BigDecimal.ZERO.setScale(2));
        }
    }

    public record Filtro(List<EstadoReposicion> estados, String texto, UUID agenciaId, UUID asesorId, LocalDate desde,
                         LocalDate hasta) {
    }

    private static final String NOMBRE = "btrim(regexp_replace(%s.nombres || ' ' || %s.apellidos, '\\s+', ' ', 'g'))";

    private static final String COLUMNAS_REGISTRO = """
            r.id, r.numero, r.caja_id, r.asesor_id, r.agencia_id, r.monto_solicitado, r.motivo, r.comentarios,
            r.saldo_al_solicitar, r.capacidad_al_solicitar, r.estado, r.monto_autorizado, r.decidido_por, r.decidido_en,
            r.justificacion_decision, r.hermes_verificacion_id, r.monto_enviado, r.enviado_en, r.referencia_envio,
            r.total_recibido, r.cierre_remanente_importe, r.version, r.creado_en, r.actualizado_en
            """;

    private static final String SELECT_FILA = """
            select r.id, r.numero, r.asesor_id, %s as asesor, r.agencia_id, a.nombre as agencia, r.estado, r.motivo,
                   r.monto_solicitado, r.monto_autorizado, r.monto_enviado, r.total_recibido, r.cierre_remanente_importe,
                   r.saldo_al_solicitar, r.capacidad_al_solicitar,
                   (select count(*) from public.reposicion_incidencias i
                     where i.reposicion_id = r.id and i.estado = 'ABIERTA') as incidencias_abiertas,
                   r.creado_en, r.actualizado_en
            from public.reposiciones r
            join public.perfiles pa on pa.id = r.asesor_id
            join public.agencias a on a.id = r.agencia_id
            """.formatted(NOMBRE.formatted("pa", "pa"));

    private final JdbcTemplate jdbc;

    public ReposicionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------------------------------ lectura de registros
    private static Registro registro(ResultSet rs, int i) throws SQLException {
        return new Registro(rs.getObject("id", UUID.class), rs.getLong("numero"), rs.getObject("caja_id", UUID.class),
                rs.getObject("asesor_id", UUID.class), rs.getObject("agencia_id", UUID.class),
                rs.getBigDecimal("monto_solicitado"), rs.getString("motivo"), rs.getString("comentarios"),
                rs.getBigDecimal("saldo_al_solicitar"), rs.getBigDecimal("capacidad_al_solicitar"),
                EstadoReposicion.valueOf(rs.getString("estado")), rs.getBigDecimal("monto_autorizado"),
                rs.getObject("decidido_por", UUID.class), instante(rs, "decidido_en"), rs.getString("justificacion_decision"),
                rs.getObject("hermes_verificacion_id", UUID.class), rs.getBigDecimal("monto_enviado"),
                instante(rs, "enviado_en"), rs.getString("referencia_envio"), rs.getBigDecimal("total_recibido"),
                rs.getBigDecimal("cierre_remanente_importe"), rs.getInt("version"), instante(rs, "creado_en"),
                instante(rs, "actualizado_en"));
    }

    public Optional<Registro> porId(UUID id) {
        return jdbc.query("select " + COLUMNAS_REGISTRO + " from public.reposiciones r where r.id = ?",
                ReposicionRepositorio::registro, id).stream().findFirst();
    }

    /** Bloquea la fila: dos decisiones sobre la misma reposición se hacen una tras otra. */
    public Optional<Registro> porIdBloqueando(UUID id) {
        return jdbc.query("select " + COLUMNAS_REGISTRO + " from public.reposiciones r where r.id = ? for update",
                ReposicionRepositorio::registro, id).stream().findFirst();
    }

    public Optional<Registro> porClave(UUID asesorId, String clave) {
        return jdbc.query("select " + COLUMNAS_REGISTRO
                        + " from public.reposiciones r where r.asesor_id = ? and r.clave_idempotencia = ?",
                ReposicionRepositorio::registro, asesorId, clave).stream().findFirst();
    }

    public Optional<Registro> abiertaDeCaja(UUID cajaId) {
        return jdbc.query("select " + COLUMNAS_REGISTRO + """
                         from public.reposiciones r
                         where r.caja_id = ? and r.estado in ('PENDIENTE_APROBACION','OBSERVADA','APROBADA','EN_TRANSITO','RECEPCION_PARCIAL')
                        """, ReposicionRepositorio::registro, cajaId).stream().findFirst();
    }

    // ------------------------------------------------------------------------------------------ escritura
    public UUID insertar(UUID cajaId, UUID asesorId, UUID agenciaId, BigDecimal monto, String motivo, String comentarios,
                         BigDecimal saldo, BigDecimal capacidad, String clave) {
        return jdbc.queryForObject("""
                insert into public.reposiciones
                    (caja_id, asesor_id, agencia_id, monto_solicitado, motivo, comentarios, saldo_al_solicitar,
                     capacidad_al_solicitar, clave_idempotencia, creado_por)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                returning id
                """, UUID.class, cajaId, asesorId, agenciaId, monto, motivo, comentarios, saldo, capacidad, clave, asesorId);
    }

    /** Cambio de estado puro (observar, responder, cancelar). Falla (0 filas) si el estado ya no es {@code desde}. */
    public int transicion(UUID id, EstadoReposicion desde, EstadoReposicion hacia) {
        return jdbc.update("""
                update public.reposiciones set estado = ?, version = version + 1, actualizado_en = now()
                where id = ? and estado = ?
                """, hacia.name(), id, desde.name());
    }

    public int rechazar(UUID id, EstadoReposicion desde, UUID gerente, String justificacion) {
        return jdbc.update("""
                update public.reposiciones set estado = 'RECHAZADA', decidido_por = ?, decidido_en = now(),
                       justificacion_decision = ?, version = version + 1, actualizado_en = now()
                where id = ? and estado = ?
                """, gerente, justificacion, id, desde.name());
    }

    public int aprobar(UUID id, UUID gerente, BigDecimal monto, String justificacion, UUID hermesId) {
        return jdbc.update("""
                update public.reposiciones set estado = 'APROBADA', monto_autorizado = ?, decidido_por = ?,
                       decidido_en = now(), justificacion_decision = ?, hermes_verificacion_id = ?,
                       version = version + 1, actualizado_en = now()
                where id = ? and estado = 'PENDIENTE_APROBACION'
                """, monto, gerente, justificacion, hermesId, id);
    }

    public int despachar(UUID id, UUID usuario, BigDecimal montoEnviado, String referencia) {
        return jdbc.update("""
                update public.reposiciones set estado = 'EN_TRANSITO', monto_enviado = ?, enviado_por = ?,
                       enviado_en = now(), referencia_envio = ?, version = version + 1, actualizado_en = now()
                where id = ? and estado = 'APROBADA'
                """, montoEnviado, usuario, referencia, id);
    }

    public int registrarRecibido(UUID id, EstadoReposicion desde, BigDecimal nuevoTotal, EstadoReposicion nuevoEstado) {
        return jdbc.update("""
                update public.reposiciones set total_recibido = ?, estado = ?, version = version + 1, actualizado_en = now()
                where id = ? and estado = ?
                """, nuevoTotal, nuevoEstado.name(), id, desde.name());
    }

    public int cerrarRemanente(UUID id, EstadoReposicion desde, BigDecimal importe, UUID usuario, String motivo,
                               EstadoReposicion nuevoEstado) {
        return jdbc.update("""
                update public.reposiciones set cierre_remanente_importe = ?, cierre_remanente_por = ?,
                       cierre_remanente_en = now(), cierre_remanente_motivo = ?, estado = ?,
                       version = version + 1, actualizado_en = now()
                where id = ? and estado = ?
                """, importe, usuario, motivo, nuevoEstado.name(), id, desde.name());
    }

    public int conciliar(UUID id, UUID usuario, String nota) {
        return jdbc.update("""
                update public.reposiciones set estado = 'COMPLETADA', conciliado_por = ?, conciliado_en = now(),
                       conciliacion_nota = ?, version = version + 1, actualizado_en = now()
                where id = ? and estado = 'RECIBIDA'
                """, usuario, nota, id);
    }

    // ------------------------------------------------------------------------------------------ recepciones
    public Optional<UUID> recepcionPorClave(UUID reposicionId, String clave) {
        return jdbc.query("select id from public.reposicion_recepciones where reposicion_id = ? and clave_idempotencia = ?",
                (rs, i) -> rs.getObject("id", UUID.class), reposicionId, clave).stream().findFirst();
    }

    public UUID insertarRecepcion(UUID reposicionId, BigDecimal importe, Instant recibidoEnDeclarado, UUID usuario,
                                  String referencia, String comentarios, String clave) {
        return jdbc.queryForObject("""
                insert into public.reposicion_recepciones
                    (reposicion_id, importe, recibido_en_declarado, registrado_por, referencia, comentarios, clave_idempotencia)
                values (?, ?, ?, ?, ?, ?, ?)
                returning id
                """, UUID.class, reposicionId, importe,
                recibidoEnDeclarado == null ? null : java.sql.Timestamp.from(recibidoEnDeclarado),
                usuario, referencia, comentarios, clave);
    }

    public List<RecepcionFila> recepciones(UUID reposicionId) {
        return jdbc.query("""
                select rc.id, rc.importe, rc.recibido_en_declarado, rc.registrado_en, rc.referencia, rc.comentarios,
                       %s as registrado_por
                from public.reposicion_recepciones rc
                join public.perfiles pu on pu.id = rc.registrado_por
                where rc.reposicion_id = ?
                order by rc.registrado_en
                """.formatted(NOMBRE.formatted("pu", "pu")),
                (rs, i) -> new RecepcionFila(rs.getObject("id", UUID.class), rs.getBigDecimal("importe"),
                        instante(rs, "recibido_en_declarado"), instante(rs, "registrado_en"),
                        rs.getString("registrado_por"), rs.getString("referencia"), rs.getString("comentarios")),
                reposicionId);
    }

    // ------------------------------------------------------------------------------------------ incidencias
    public UUID insertarIncidencia(UUID reposicionId, String tipo, BigDecimal importe, String descripcion, UUID reportadaPor) {
        return jdbc.queryForObject("""
                insert into public.reposicion_incidencias (reposicion_id, tipo, importe, descripcion, reportada_por)
                values (?, ?, ?, ?, ?)
                returning id
                """, UUID.class, reposicionId, tipo, importe, descripcion, reportadaPor);
    }

    public int incidenciasAbiertas(UUID reposicionId) {
        Integer n = jdbc.queryForObject(
                "select count(*) from public.reposicion_incidencias where reposicion_id = ? and estado = 'ABIERTA'",
                Integer.class, reposicionId);
        return n == null ? 0 : n;
    }

    public record IncidenciaRegistro(UUID id, UUID reposicionId, String estado, BigDecimal importe) {
    }

    public Optional<IncidenciaRegistro> incidenciaBloqueando(UUID incidenciaId) {
        return jdbc.query("select id, reposicion_id, estado, importe from public.reposicion_incidencias where id = ? for update",
                (rs, i) -> new IncidenciaRegistro(rs.getObject("id", UUID.class), rs.getObject("reposicion_id", UUID.class),
                        rs.getString("estado"), rs.getBigDecimal("importe")), incidenciaId).stream().findFirst();
    }

    public int resolverIncidencia(UUID incidenciaId, UUID usuario, String resolucion) {
        return jdbc.update("""
                update public.reposicion_incidencias set estado = 'RESUELTA', resuelta_por = ?, resuelta_en = now(),
                       resolucion = ?
                where id = ? and estado = 'ABIERTA'
                """, usuario, resolucion, incidenciaId);
    }

    public List<IncidenciaFila> incidencias(UUID reposicionId) {
        return jdbc.query("""
                select i.id, i.tipo, i.importe, i.descripcion, i.estado, i.reportada_en, i.resuelta_en, i.resolucion,
                       case when i.reportada_por is null then 'Sistema' else %s end as reportada_por,
                       case when i.resuelta_por is null then null else %s end as resuelta_por
                from public.reposicion_incidencias i
                left join public.perfiles pr on pr.id = i.reportada_por
                left join public.perfiles ps on ps.id = i.resuelta_por
                where i.reposicion_id = ?
                order by i.reportada_en
                """.formatted(NOMBRE.formatted("pr", "pr"), NOMBRE.formatted("ps", "ps")),
                (rs, n) -> new IncidenciaFila(rs.getObject("id", UUID.class), rs.getString("tipo"), rs.getBigDecimal("importe"),
                        rs.getString("descripcion"), rs.getString("estado"), rs.getString("reportada_por"),
                        instante(rs, "reportada_en"), rs.getString("resuelta_por"), instante(rs, "resuelta_en"),
                        rs.getString("resolucion")), reposicionId);
    }

    // ------------------------------------------------------------------------------------------ Hermes
    /** Intentos fallidos recientes del gerente sobre la reposición (ventana móvil): base del bloqueo anti fuerza bruta. */
    public int hermesFallidosRecientes(UUID reposicionId, UUID usuarioId, int ventanaMinutos) {
        Integer n = jdbc.queryForObject("""
                select count(*) from public.hermes_verificaciones
                where reposicion_id = ? and usuario_id = ? and resultado in ('INVALIDO', 'EXPIRADO')
                  and creado_en > now() - make_interval(mins => ?)
                """, Integer.class, reposicionId, usuarioId, ventanaMinutos);
        return n == null ? 0 : n;
    }

    /** Registra un intento (NUNCA el código). Con huella única: un código ya aceptado lanza DuplicateKeyException. */
    public UUID registrarIntentoHermes(UUID reposicionId, UUID usuarioId, BigDecimal monto, String resultado, String huella,
                                       String referenciaExterna, UUID correlacionId) {
        return jdbc.queryForObject("""
                insert into public.hermes_verificaciones
                    (reposicion_id, usuario_id, monto, resultado, huella, referencia_externa, correlacion_id)
                values (?, ?, ?, ?, ?, ?, ?)
                returning id
                """, UUID.class, reposicionId, usuarioId, monto, resultado, huella, referenciaExterna, correlacionId);
    }

    public int consumirHermes(UUID verificacionId) {
        return jdbc.update("update public.hermes_verificaciones set consumida_en = now() where id = ? and consumida_en is null",
                verificacionId);
    }

    // ------------------------------------------------------------------------------------------ auditoría
    public void auditar(UUID cajaId, UUID reposicionId, UUID actorId, String accion, BigDecimal importe, String detalle,
                        UUID correlacionId) {
        jdbc.update("""
                insert into public.caja_auditoria (caja_id, reposicion_id, actor_id, accion, importe, detalle, correlacion_id)
                values (?, ?, ?, ?, ?, ?, ?)
                """, cajaId, reposicionId, actorId, accion, importe, detalle, correlacionId);
    }

    public List<EventoLinea> linea(UUID reposicionId, Map<String, String> etiquetas) {
        return jdbc.query("""
                select au.accion, au.importe, au.detalle, au.creado_en,
                       case when au.actor_id is null then 'Sistema' else %s end as actor
                from public.caja_auditoria au
                left join public.perfiles pg on pg.id = au.actor_id
                where au.reposicion_id = ?
                order by au.creado_en, au.id
                """.formatted(NOMBRE.formatted("pg", "pg")),
                (rs, i) -> new EventoLinea(rs.getString("accion"),
                        etiquetas.getOrDefault(rs.getString("accion"), rs.getString("accion")), rs.getString("actor"),
                        rs.getBigDecimal("importe"), rs.getString("detalle"), instante(rs, "creado_en")), reposicionId);
    }

    /** Nombres de las personas que intervinieron (para el detalle). */
    public record Extra(String decididoPor, String enviadoPor, String cierrePor, Instant cierreEn, String cierreMotivo,
                        String conciliadoPor, Instant conciliadoEn, String conciliacionNota) {
    }

    public Extra extraDetalle(UUID id) {
        return jdbc.queryForObject("""
                select %s as decidido_por, %s as enviado_por, %s as cierre_por, r.cierre_remanente_en,
                       r.cierre_remanente_motivo, %s as conciliado_por, r.conciliado_en, r.conciliacion_nota
                from public.reposiciones r
                left join public.perfiles pd on pd.id = r.decidido_por
                left join public.perfiles pe on pe.id = r.enviado_por
                left join public.perfiles pc on pc.id = r.cierre_remanente_por
                left join public.perfiles pk on pk.id = r.conciliado_por
                where r.id = ?
                """.formatted(NOMBRE.formatted("pd", "pd"), NOMBRE.formatted("pe", "pe"), NOMBRE.formatted("pc", "pc"),
                        NOMBRE.formatted("pk", "pk")),
                (rs, i) -> new Extra(rs.getString("decidido_por"), rs.getString("enviado_por"), rs.getString("cierre_por"),
                        instante(rs, "cierre_remanente_en"), rs.getString("cierre_remanente_motivo"),
                        rs.getString("conciliado_por"), instante(rs, "conciliado_en"), rs.getString("conciliacion_nota")), id);
    }

    // ------------------------------------------------------------------------------------------ consultas
    private static ReposicionFila fila(ResultSet rs, int i) throws SQLException {
        EstadoReposicion estado = EstadoReposicion.valueOf(rs.getString("estado"));
        BigDecimal autorizado = rs.getBigDecimal("monto_autorizado");
        BigDecimal recibido = rs.getBigDecimal("total_recibido");
        BigDecimal remanente = rs.getBigDecimal("cierre_remanente_importe");
        BigDecimal pendiente = autorizado != null && estado.reservaCapacidad()
                ? autorizado.subtract(recibido).subtract(remanente).max(BigDecimal.ZERO) : BigDecimal.ZERO.setScale(2);
        long numero = rs.getLong("numero");
        return new ReposicionFila(rs.getObject("id", UUID.class), numero, "REP-" + numero,
                rs.getObject("asesor_id", UUID.class), rs.getString("asesor"), rs.getObject("agencia_id", UUID.class),
                rs.getString("agencia"), estado.name(), estado.etiqueta(), rs.getString("motivo"),
                rs.getBigDecimal("monto_solicitado"), autorizado, rs.getBigDecimal("monto_enviado"), recibido, remanente,
                pendiente, rs.getBigDecimal("saldo_al_solicitar"), rs.getBigDecimal("capacidad_al_solicitar"),
                rs.getInt("incidencias_abiertas"), instante(rs, "creado_en"), instante(rs, "actualizado_en"));
    }

    public Optional<ReposicionFila> filaPorId(UUID id) {
        return jdbc.query(SELECT_FILA + " where r.id = ?", ReposicionRepositorio::fila, id).stream().findFirst();
    }

    private static final Map<String, String> ORDENES = Map.of(
            "numero", "r.numero",
            "creado", "r.creado_en",
            "solicitado", "r.monto_solicitado",
            "autorizado", "r.monto_autorizado",
            "estado", "r.estado",
            "asesor", "pa.apellidos, pa.nombres",
            "agencia", "a.nombre");

    private static final String PRIORIDAD = """
            case r.estado when 'PENDIENTE_APROBACION' then 0 when 'RECIBIDA' then 1 when 'RECEPCION_PARCIAL' then 2
                          when 'EN_TRANSITO' then 2 when 'APROBADA' then 2 when 'OBSERVADA' then 3 else 4 end
            """;

    private static String donde(Filtro f, List<Object> args) {
        StringBuilder sb = new StringBuilder(" where true");
        if (f.estados() != null && !f.estados().isEmpty()) {
            sb.append(" and r.estado in (").append(String.join(",", java.util.Collections.nCopies(f.estados().size(), "?"))).append(")");
            f.estados().forEach(e -> args.add(e.name()));
        }
        if (f.asesorId() != null) { sb.append(" and r.asesor_id = ?"); args.add(f.asesorId()); }
        if (f.agenciaId() != null) { sb.append(" and r.agencia_id = ?"); args.add(f.agenciaId()); }
        if (f.desde() != null) { sb.append(" and (r.creado_en at time zone 'America/Lima')::date >= ?"); args.add(java.sql.Date.valueOf(f.desde())); }
        if (f.hasta() != null) { sb.append(" and (r.creado_en at time zone 'America/Lima')::date <= ?"); args.add(java.sql.Date.valueOf(f.hasta())); }
        if (f.texto() != null && !f.texto().isBlank()) {
            sb.append(" and ('REP-' || r.numero::text ilike ? or pa.nombres || ' ' || pa.apellidos ilike ? or a.nombre ilike ?)");
            String patron = "%" + f.texto().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(patron); args.add(patron); args.add(patron);
        }
        return sb.toString();
    }

    public List<ReposicionFila> listar(Filtro f, String orden, boolean ascendente, int limite, int desplazamiento) {
        List<Object> args = new ArrayList<>();
        String where = donde(f, args);
        String columna = orden == null ? null : ORDENES.get(orden);
        String order = columna == null
                ? PRIORIDAD + ", r.creado_en desc"
                : columna + (ascendente ? " asc" : " desc") + ", r.numero desc";
        args.add(limite);
        args.add(desplazamiento);
        return jdbc.query(SELECT_FILA + where + " order by " + order + " limit ? offset ?",
                ReposicionRepositorio::fila, args.toArray());
    }

    public long contar(Filtro f) {
        List<Object> args = new ArrayList<>();
        String where = donde(f, args);
        Long n = jdbc.queryForObject("""
                select count(*) from public.reposiciones r
                join public.perfiles pa on pa.id = r.asesor_id
                join public.agencias a on a.id = r.agencia_id
                """ + where, Long.class, args.toArray());
        return n == null ? 0 : n;
    }

    public List<ReposicionFila> todas(Filtro f) {
        List<Object> args = new ArrayList<>();
        String where = donde(f, args);
        return jdbc.query(SELECT_FILA + where + " order by r.numero", ReposicionRepositorio::fila, args.toArray());
    }
}
