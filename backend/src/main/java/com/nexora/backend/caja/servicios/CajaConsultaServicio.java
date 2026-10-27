package com.nexora.backend.caja.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.dominio.EstadoReposicion;
import com.nexora.backend.caja.dominio.ReglasCaja;
import com.nexora.backend.caja.dto.CajaDtos.AgenciaSupervision;
import com.nexora.backend.caja.dto.CajaDtos.CajaSupervision;
import com.nexora.backend.caja.dto.CajaDtos.Pagina;
import com.nexora.backend.caja.dto.CajaDtos.Pendientes;
import com.nexora.backend.caja.dto.CajaDtos.ReporteResumen;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionFila;
import com.nexora.backend.caja.dto.CajaDtos.SupervisionResumen;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import com.nexora.backend.caja.repositorios.CajaConsultaRepositorio;
import com.nexora.backend.caja.repositorios.CajaConsultaRepositorio.CajaAgregada;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio.Filtro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consultas de solo lectura: bandeja, avisos, supervisión de cajas y reportes. El alcance lo decide SIEMPRE el servidor
 * con el perfil de la sesión: un asesor ve únicamente lo suyo (aunque envíe otro asesor/agencia en la URL); gerencia ve
 * todas las agencias (la base de datos no modela agencias asignadas a gerencia, igual que el resto del sistema).
 */
@Service
public class CajaConsultaServicio {

    /** Efectivo por debajo del cual se avisa a gerencia. */
    static final BigDecimal SALDO_BAJO = new BigDecimal("10000.00");

    public record Consulta(String estados, String texto, UUID agenciaId, UUID asesorId, String desde, String hasta,
                           String orden, Integer pagina, Integer tamano) {
    }

    private final ReposicionRepositorio reposiciones;
    private final CajaConsultaRepositorio consultas;
    private final Clock reloj;

    public CajaConsultaServicio(ReposicionRepositorio reposiciones, CajaConsultaRepositorio consultas, Clock reloj) {
        this.reposiciones = reposiciones;
        this.consultas = consultas;
        this.reloj = reloj;
    }

    // ------------------------------------------------------------------------------------------ bandeja
    @Transactional(readOnly = true)
    public Pagina<ReposicionFila> listar(Perfil quien, Consulta c) {
        Filtro filtro = filtro(quien, c);
        int pagina = c.pagina() == null || c.pagina() < 1 ? 1 : c.pagina();
        int tamano = c.tamano() == null || c.tamano() < 1 ? 20 : Math.min(c.tamano(), ReglasCaja.PAGINA_MAX);
        String orden = null;
        boolean asc = false;
        if (c.orden() != null && !c.orden().isBlank()) {
            String[] partes = c.orden().split(":");
            orden = partes[0];
            asc = partes.length > 1 && "asc".equalsIgnoreCase(partes[1]);
        }
        return new Pagina<>(reposiciones.listar(filtro, orden, asc, tamano, (pagina - 1) * tamano),
                reposiciones.contar(filtro), pagina, tamano, Instant.now(reloj));
    }

    /** Alcance + filtros validados. El asesor queda forzado a sus propias reposiciones. */
    Filtro filtro(Perfil quien, Consulta c) {
        boolean gerencia = esGerencia(quien);
        if (!gerencia && !(quien != null && "asesor".equals(quien.getRol()))) {
            throw new CajaException(Codigo.SIN_PERMISO, "No tienes acceso a las reposiciones.");
        }
        List<EstadoReposicion> estados = new ArrayList<>();
        if (c.estados() != null && !c.estados().isBlank()) {
            for (String e : c.estados().split(",")) {
                estados.add(EstadoReposicion.de(e).orElseThrow(
                        () -> new CajaException(Codigo.DATOS_INVALIDOS, "Estado de filtro no válido: " + e.trim())));
            }
        }
        LocalDate desde = fecha(c.desde(), "desde");
        LocalDate hasta = fecha(c.hasta(), "hasta");
        if (desde != null && hasta != null && desde.isAfter(hasta)) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "La fecha «desde» no puede ser posterior a «hasta».");
        }
        String texto = c.texto() == null ? null : c.texto().trim();
        if (texto != null && texto.length() > 80) texto = texto.substring(0, 80);
        return new Filtro(estados, texto, gerencia ? c.agenciaId() : null, gerencia ? c.asesorId() : quien.getId(), desde, hasta);
    }

    private static LocalDate fecha(String valor, String campo) {
        if (valor == null || valor.isBlank()) return null;
        try {
            return LocalDate.parse(valor.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "La fecha «" + campo + "» debe tener el formato AAAA-MM-DD.");
        }
    }

    // ------------------------------------------------------------------------------------------ avisos
    /** Contadores del menú. Se consultan cada cierto tiempo desde el navegador: NO son notificaciones en tiempo real. */
    @Transactional(readOnly = true)
    public Pendientes pendientes(Perfil quien) {
        if (esGerencia(quien)) return consultas.pendientes(null, Instant.now(reloj));
        Validaciones.exigirAsesor(quien);
        return consultas.pendientes(quien.getId(), Instant.now(reloj));
    }

    // ------------------------------------------------------------------------------------------ supervisión (gerencia)
    @Transactional(readOnly = true)
    public SupervisionResumen supervision(Perfil gerente) {
        Validaciones.exigirGerencia(gerente);
        List<CajaSupervision> cajas = new ArrayList<>();
        Map<UUID, BigDecimal[]> porAgencia = new LinkedHashMap<>();
        Map<UUID, String> nombres = new LinkedHashMap<>();
        Map<UUID, Integer> conteo = new LinkedHashMap<>();
        BigDecimal saldoTotal = BigDecimal.ZERO, pendienteTotal = BigDecimal.ZERO, transitoTotal = BigDecimal.ZERO,
                difTotal = BigDecimal.ZERO;
        int alertasTotal = 0;
        for (CajaAgregada c : consultas.supervision()) {
            List<String> alertas = new ArrayList<>();
            if (!c.coincide()) alertas.add("El saldo no coincide con el libro de movimientos: revisar de inmediato.");
            if (c.saldo().signum() == 0) alertas.add("La caja no tiene efectivo.");
            else if (c.saldo().compareTo(SALDO_BAJO) < 0) alertas.add("Efectivo bajo (menos de " + Validaciones.soles(SALDO_BAJO) + ").");
            if (c.incidencias() > 0) alertas.add(c.incidencias() + " incidencia(s) sin resolver.");
            if (c.saldo().add(c.autorizadoPendiente()).compareTo(c.limite()) > 0) {
                alertas.add("Efectivo + autorizado pendiente supera el límite de caja.");
            }
            if (!"ABIERTA".equals(c.estado())) alertas.add("La caja está cerrada.");
            alertasTotal += alertas.size();
            cajas.add(new CajaSupervision(c.cajaId(), c.asesorId(), c.asesor(), c.agenciaId(), c.agencia(), c.estado(),
                    c.saldo(), c.limite(), c.autorizadoPendiente(), c.enTransito(), c.parciales(), c.porRevisar(),
                    c.diferencias(), c.incidencias(), c.coincide(), alertas));
            saldoTotal = saldoTotal.add(c.saldo());
            pendienteTotal = pendienteTotal.add(c.autorizadoPendiente());
            transitoTotal = transitoTotal.add(c.enTransito());
            difTotal = difTotal.add(c.diferencias());
            BigDecimal[] acc = porAgencia.computeIfAbsent(c.agenciaId(),
                    k -> new BigDecimal[] { BigDecimal.ZERO, BigDecimal.ZERO });
            acc[0] = acc[0].add(c.saldo());
            acc[1] = acc[1].add(c.autorizadoPendiente());
            nombres.put(c.agenciaId(), c.agencia());
            conteo.merge(c.agenciaId(), 1, Integer::sum);
        }
        List<AgenciaSupervision> agencias = new ArrayList<>();
        porAgencia.forEach((id, v) -> agencias.add(new AgenciaSupervision(id, nombres.get(id), conteo.get(id), v[0], v[1])));
        return new SupervisionResumen(cajas, agencias, saldoTotal, pendienteTotal, transitoTotal, difTotal, alertasTotal,
                Instant.now(reloj));
    }

    // ------------------------------------------------------------------------------------------ reportes
    @Transactional(readOnly = true)
    public ReporteResumen reporte(Perfil quien, Consulta c) {
        Filtro f = filtro(quien, c);   // valida alcance y fechas con las mismas reglas que la bandeja
        ZoneId zona = reloj.getZone();
        LocalDate hoy = LocalDate.now(reloj);
        LocalDate desde = f.desde() != null ? f.desde() : hoy.withDayOfMonth(1);
        LocalDate hasta = f.hasta() != null ? f.hasta() : hoy;
        List<String> estados = f.estados().stream().map(EstadoReposicion::name).toList();
        var t = consultas.totales(f.asesorId(), f.agenciaId(), desde, hasta, estados);
        return new ReporteResumen(desde.atStartOfDay(zona).toInstant(), hasta.plusDays(1).atStartOfDay(zona).toInstant(),
                t.saldoInicial(), t.entradas(), t.salidas(), t.saldoActual(), t.solicitado(), t.autorizado(), t.enviado(),
                t.recibido(), t.conciliado(), t.diferencias(), t.reposiciones(), Instant.now(reloj));
    }

    /** CSV con las mismas filas y cifras que la bandeja filtrada (sin paginar). Neutraliza fórmulas de hoja de cálculo. */
    @Transactional(readOnly = true)
    public String csv(Perfil quien, Consulta c) {
        Filtro f = filtro(quien, c);
        StringBuilder sb = new StringBuilder("﻿");
        sb.append("Codigo;Asesor;Agencia;Estado;Motivo;Solicitado;Autorizado;Enviado;Recibido;Remanente cerrado;")
                .append("Pendiente de recepcion;Incidencias abiertas;Creado (Lima);Actualizado (Lima)\r\n");
        ZoneId zona = reloj.getZone();
        for (ReposicionFila r : reposiciones.todas(f)) {
            sb.append(celda(r.codigo())).append(';').append(celda(r.asesor())).append(';').append(celda(r.agencia())).append(';')
                    .append(celda(r.estadoEtiqueta())).append(';').append(celda(r.motivo())).append(';')
                    .append(num(r.montoSolicitado())).append(';').append(num(r.montoAutorizado())).append(';')
                    .append(num(r.montoEnviado())).append(';').append(num(r.totalRecibido())).append(';')
                    .append(num(r.remanenteCerrado())).append(';').append(num(r.pendienteRecepcion())).append(';')
                    .append(r.incidenciasAbiertas()).append(';')
                    .append(r.creadoEn().atZone(zona).toLocalDateTime().withNano(0)).append(';')
                    .append(r.actualizadoEn().atZone(zona).toLocalDateTime().withNano(0)).append("\r\n");
        }
        return sb.toString();
    }

    static String celda(String v) {
        if (v == null) return "";
        String t = v.replace("\r", " ").replace("\n", " ");
        if (!t.isEmpty() && "=+-@\t".indexOf(t.charAt(0)) >= 0) t = "'" + t;   // evita inyección de fórmulas
        if (t.contains(";") || t.contains("\"")) t = "\"" + t.replace("\"", "\"\"") + "\"";
        return t;
    }

    private static String num(BigDecimal v) {
        return v == null ? "" : v.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static boolean esGerencia(Perfil p) {
        return p != null && "gerencia".equals(p.getRol());
    }
}
