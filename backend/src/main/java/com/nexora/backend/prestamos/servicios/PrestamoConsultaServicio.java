package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.CapacidadEndeudamiento;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada.Aporte;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada.Integrante;
import com.nexora.backend.prestamos.dominio.EstadoCliente;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaEvaluada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import com.nexora.backend.prestamos.dto.PrestamoDetalle;
import com.nexora.backend.prestamos.dto.PrestamoDetalle.CuotaDetalle;
import com.nexora.backend.prestamos.dto.PrestamoDetalle.EventoHistorial;
import com.nexora.backend.prestamos.dto.PerfilFinancieroRespuesta;
import com.nexora.backend.prestamos.dto.PerfilFinancieroRespuesta.IntegranteRespuesta;
import com.nexora.backend.prestamos.dto.PerfilFinancieroRespuesta.PrestamoConsolidadoRespuesta;
import com.nexora.backend.prestamos.dto.PrestamoListado;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CabeceraPrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CuotaDePrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.Filtro;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.IntegranteGrupo;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consultas de préstamos: listado, detalle y resumen por cliente. Todo sale de la BD y todo estado/saldo lo calcula
 * EvaluadorCartera con la fecha de negocio de Lima, de modo que las tres vistas coinciden entre sí.
 */
@Service
public class PrestamoConsultaServicio {

    private static final Logger LOG = LoggerFactory.getLogger(PrestamoConsultaServicio.class);
    private static final Set<String> ESTADOS_PRESTAMO = Set.of(
            EvaluadorCartera.PRESTAMO_VIGENTE, EvaluadorCartera.PRESTAMO_EN_MORA, EvaluadorCartera.PRESTAMO_CANCELADO);
    private static final Set<String> ESTADOS_CUOTA = Set.of(
            EvaluadorCartera.CUOTA_PENDIENTE, EvaluadorCartera.CUOTA_PAGADA, EvaluadorCartera.CUOTA_VENCIDA);

    private final PrestamoConsultaRepositorio repositorio;
    private final Clock reloj;

    public PrestamoConsultaServicio(PrestamoConsultaRepositorio repositorio, Clock reloj) {
        this.repositorio = repositorio;
        this.reloj = reloj;
    }

    /** La gerencia ve todas las agencias; el asesor, solo la suya (igual que el dashboard). */
    @Transactional(readOnly = true)
    public List<PrestamoListado> listar(Perfil perfil) {
        Filtro filtro = alcanceDe(perfil);
        LocalDate hoy = LocalDate.now(reloj);
        Map<UUID, List<CuotaGuardada>> cuotas = cuotasPorPrestamo(repositorio.cuotas(filtro));
        List<PrestamoListado> filas = new ArrayList<>();
        for (CabeceraPrestamo c : repositorio.cabeceras(filtro)) {
            Evaluacion e = EvaluadorCartera.evaluar(c.estado(), cuotas.getOrDefault(c.id(), List.of()), hoy);
            filas.add(new PrestamoListado(c.id(), c.numero(), c.clienteId(), c.clienteNombre(),
                    c.clienteTipoDocumento(), c.clienteNumeroDocumento(), c.agenciaNombre(), c.asesorNombre(),
                    c.asesorId().equals(perfil.getId()), c.capital(), c.plazoMeses(), c.fechaDesembolso(), e.estado(),
                    e.totalContractual(), e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento(),
                    e.cuotasVencidas()));
        }
        return filas;
    }

    @Transactional(readOnly = true)
    public PrestamoDetalle detalle(UUID id) {
        Filtro filtro = Filtro.deUnPrestamo(id);
        CabeceraPrestamo c = repositorio.cabeceras(filtro).stream().findFirst()
                .orElseThrow(() -> new PrestamoException(Codigo.PRESTAMO_NO_ENCONTRADO, "El préstamo indicado no existe."));
        List<CuotaGuardada> guardadas = cuotasPorPrestamo(repositorio.cuotas(filtro)).getOrDefault(id, List.of());
        if (guardadas.isEmpty()) {
            throw new IllegalStateException("El préstamo no tiene cronograma guardado.");
        }
        Evaluacion e = EvaluadorCartera.evaluar(c.estado(), guardadas, LocalDate.now(reloj));

        List<CuotaDetalle> cuotas = e.cuotas().stream().map(PrestamoConsultaServicio::aDetalle).toList();
        BigDecimal totalIntereses = guardadas.stream().map(CuotaGuardada::interes).reduce(BigDecimal.ZERO, BigDecimal::add);
        // Todas las cuotas valen lo mismo salvo la última (absorbe el redondeo): la primera es la cuota mensual.
        BigDecimal cuotaMensual = guardadas.get(0).importeCuota();
        List<EventoHistorial> historial = List.of(new EventoHistorial(c.registradoEn(), "Préstamo registrado",
                "PR-" + c.numero() + " por " + soles(c.capital()) + " a " + c.clienteNombre(), c.asesorNombre()));

        return new PrestamoDetalle(c.id(), c.numero(), c.clienteId(), c.clienteNombre(), c.clienteTipoDocumento(),
                c.clienteNumeroDocumento(), c.clienteCodigo(), c.clienteTelefono(), c.agenciaNombre(), c.asesorNombre(), "PEN", c.capital(), c.plazoMeses(),
                c.tea(), c.fechaDesembolso(), cuotas.get(0).fechaVencimiento(),
                cuotas.get(cuotas.size() - 1).fechaVencimiento(), e.estado(), c.observaciones(), cuotaMensual,
                totalIntereses, e.totalContractual(), e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento(),
                e.cuotasVencidas(), cuotas, historial);
    }

    /** Préstamos de un cliente en todas las agencias (detalle del cliente): mismos saldos y estados que el listado. */
    @Transactional(readOnly = true)
    public List<PrestamoResumen> listarPorCliente(UUID clienteId) {
        return evaluarPrestamosDe(clienteId).stream().map(p -> {
            CabeceraPrestamo c = p.cabecera();
            Evaluacion e = p.evaluacion();
            return new PrestamoResumen(c.id(), c.numero(), c.capital(), c.plazoMeses(), c.fechaDesembolso(), e.estado(),
                    e.totalContractual(), e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento());
        }).toList();
    }

    /**
     * Capacidad de endeudamiento del cliente con sus préstamos de TODAS las agencias Y los de su grupo crediticio (su DNI
     * y sus negocios RUC 10, ver GrupoCrediticioSql). La muestran el perfil y la solicitud, y el registro la vuelve a
     * calcular dentro de su transacción (con el grupo bloqueado). Un cliente sin vinculados cuenta solo.
     */
    @Transactional(readOnly = true)
    public CapacidadEndeudamiento capacidad(UUID clienteId) {
        exigirCliente(clienteId);
        List<UUID> grupo = idsDelGrupo(clienteId, repositorio.integrantesDelGrupo(clienteId));
        List<PrestamoEvaluado> prestamos = evaluarPrestamosDeGrupo(clienteId, grupo);
        prestamos.forEach(PrestamoConsultaServicio::avisarSiHayDatosRaros);
        return CapacidadEndeudamiento.de(prestamos.stream().map(PrestamoConsultaServicio::paraElLimite).toList(),
                Math.max(1, grupo.size()));
    }

    /**
     * Perfil financiero consolidado: la MISMA capacidad que valida el registro más el detalle por integrante. Los
     * préstamos y contadores de cuotas de un integrante vinculado solo se incluyen si el usuario es de gerencia o de la
     * agencia de ese cliente; el cliente consultado siempre se muestra completo (igual que su ficha). El capital pendiente
     * de cada vinculado sí se informa: explica por qué el cliente tiene o no capacidad.
     */
    @Transactional(readOnly = true)
    public PerfilFinancieroRespuesta perfilFinanciero(Perfil perfil, UUID clienteId) {
        exigirCliente(clienteId);
        if (perfil == null) {
            throw new PrestamoException(Codigo.SIN_PERMISO, "No se pudo identificar al usuario de la sesión.");
        }
        List<IntegranteGrupo> filas = repositorio.integrantesDelGrupo(clienteId);
        IntegranteGrupo consultado = filas.stream().filter(f -> clienteId.equals(f.id())).findFirst()
                .orElseThrow(() -> new PrestamoException(Codigo.CLIENTE_NO_ENCONTRADO, "El cliente indicado no existe."));
        List<UUID> grupo = idsDelGrupo(clienteId, filas);
        List<PrestamoEvaluado> evaluados = evaluarPrestamosDeGrupo(clienteId, grupo);
        evaluados.forEach(PrestamoConsultaServicio::avisarSiHayDatosRaros);

        List<Integrante> integrantes = filas.stream()
                .map(f -> new Integrante(f.id(), f.nombre(), f.tipoDocumento(), f.numeroDocumento(), f.agenciaId()))
                .toList();
        List<DeudaConsolidada.PrestamoEvaluado> aportes = evaluados.stream()
                .map(p -> new DeudaConsolidada.PrestamoEvaluado(p.cabecera().id(), p.cabecera().clienteId(), paraElLimite(p)))
                .toList();
        DeudaConsolidada.Resultado r = DeudaConsolidada.consolidar(clienteId, integrantes, aportes,
                i -> puedeVerDetalle(perfil, i));
        Map<UUID, Boolean> visibles = new HashMap<>();
        for (Aporte a : r.aportes()) {
            visibles.put(a.integrante().clienteId(), a.detalleVisible());
        }

        List<IntegranteRespuesta> integrantesRespuesta = r.aportes().stream()
                .map(a -> new IntegranteRespuesta(a.integrante().clienteId(), a.integrante().nombre(),
                        a.integrante().tipoDocumento(), a.integrante().numeroDocumento(), a.relacion(), a.consultado(),
                        a.detalleVisible(), a.capitalPendiente(), a.importePendiente(), a.prestamosConSaldo(),
                        a.cuotasPendientes(), a.cuotasVencidas(), a.cuotasPagadas()))
                .toList();

        Map<UUID, Integrante> porId = new HashMap<>();
        integrantes.forEach(i -> porId.putIfAbsent(i.clienteId(), i));
        List<PrestamoConsolidadoRespuesta> prestamos = new ArrayList<>();
        Set<UUID> vistos = new java.util.HashSet<>();
        for (PrestamoEvaluado p : evaluados) {
            CabeceraPrestamo c = p.cabecera();
            if (!Boolean.TRUE.equals(visibles.get(c.clienteId())) || !vistos.add(c.id())) {
                continue;
            }
            Evaluacion e = p.evaluacion();
            int pend = 0;
            int venc = 0;
            int pag = 0;
            if (EvaluadorCartera.PRESTAMO_CANCELADO.equals(e.estado())) {
                pag = e.cuotas().size();
            } else {
                for (CuotaEvaluada q : e.cuotas()) {
                    switch (q.estado()) {
                        case EvaluadorCartera.CUOTA_PAGADA -> pag++;
                        case EvaluadorCartera.CUOTA_VENCIDA -> venc++;
                        default -> pend++;
                    }
                }
            }
            Integrante dueno = porId.get(c.clienteId());
            prestamos.add(new PrestamoConsolidadoRespuesta(c.id(), c.numero(), c.clienteId(),
                    dueno != null ? dueno.nombre() : c.clienteNombre(),
                    dueno != null ? dueno.tipoDocumento() : c.clienteTipoDocumento(),
                    dueno != null ? dueno.numeroDocumento() : c.clienteNumeroDocumento(),
                    c.capital(), c.plazoMeses(), c.fechaDesembolso(), e.estado(), e.totalContractual(),
                    e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento(), pend, venc, pag));
        }

        CapacidadEndeudamiento cap = r.capacidad();
        return new PerfilFinancieroRespuesta(consultado.id(), consultado.tipoDocumento(), consultado.numeroDocumento(),
                consultado.nombre(), cap.limite(), cap.capitalPendiente(), cap.importePendiente(), cap.disponible(),
                r.deudaPropia(), r.deudaVinculada(), cap.consolidada(), r.cuotasPendientes(), r.cuotasVencidas(),
                r.cuotasPagadas(), integrantesRespuesta, List.copyOf(prestamos));
    }

    /** Gerencia ve todo; el asesor, el detalle de los clientes de su agencia. El consultado lo decide el dominio. */
    private static boolean puedeVerDetalle(Perfil perfil, Integrante i) {
        if ("gerencia".equals(perfil.getRol())) {
            return true;
        }
        return perfil.getAgencia() != null && i.agenciaId() != null && i.agenciaId().equals(perfil.getAgencia().getId());
    }

    private static void exigirCliente(UUID clienteId) {
        if (clienteId == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "Indica el cliente.");
        }
    }

    /** Ids del grupo; si la consulta no devuelve nada (cliente inexistente) se evalúa el cliente solo. */
    private static List<UUID> idsDelGrupo(UUID clienteId, List<IntegranteGrupo> filas) {
        List<UUID> ids = filas.stream().map(IntegranteGrupo::id).distinct().toList();
        return ids.isEmpty() ? List.of(clienteId) : ids;
    }

    /** Estado del cliente (ACTIVO, MOROSO o EXTRAJUDICIAL) con sus préstamos de TODAS las agencias. No escribe nada. */
    @Transactional(readOnly = true)
    public String estadoCliente(UUID clienteId) {
        LocalDate hoy = LocalDate.now(reloj);
        return EstadoCliente.de(evaluarPrestamosDe(clienteId).stream().map(PrestamoEvaluado::evaluacion).toList(), hoy);
    }

    /**
     * Estado de cada cliente que tiene préstamos, en dos consultas para toda la cartera. Un cliente que no aparece
     * no tiene préstamos y está ACTIVO. No escribe nada.
     */
    @Transactional(readOnly = true)
    public Map<UUID, String> estadosDeClientes() {
        Filtro filtro = Filtro.todos();
        LocalDate hoy = LocalDate.now(reloj);
        Map<UUID, List<CuotaGuardada>> cuotas = cuotasPorPrestamo(repositorio.cuotas(filtro));
        Map<UUID, List<Evaluacion>> porCliente = new HashMap<>();
        for (CabeceraPrestamo c : repositorio.cabeceras(filtro)) {
            porCliente.computeIfAbsent(c.clienteId(), k -> new ArrayList<>())
                    .add(EvaluadorCartera.evaluar(c.estado(), cuotas.getOrDefault(c.id(), List.of()), hoy));
        }
        Map<UUID, String> estados = new HashMap<>();
        porCliente.forEach((clienteId, prestamos) -> estados.put(clienteId, EstadoCliente.de(prestamos, hoy)));
        return estados;
    }

    /**
     * Un préstamo activo sin cronograma no debería existir (se guardan juntos), pero si aparece no se le da por pagado:
     * para el límite cuenta todo su capital.
     */
    private static Evaluacion paraElLimite(PrestamoEvaluado p) {
        boolean sinCuotas = p.cuotas().isEmpty();
        boolean cancelado = EvaluadorCartera.PRESTAMO_CANCELADO.equals(p.cabecera().estado());
        if (!sinCuotas || cancelado) {
            return p.evaluacion();
        }
        BigDecimal capital = p.cabecera().capital();
        return new Evaluacion(p.cabecera().estado(), capital, capital, capital, null, 0, List.of());
    }

    private record PrestamoEvaluado(CabeceraPrestamo cabecera, List<CuotaGuardada> cuotas, Evaluacion evaluacion) { }

    private List<PrestamoEvaluado> evaluarPrestamosDe(UUID clienteId) {
        exigirCliente(clienteId);
        return evaluarConFiltro(Filtro.deCliente(clienteId));
    }

    /** Un solo cliente: la consulta de siempre. Varios (grupo crediticio): todos sus préstamos, cada uno una vez. */
    private List<PrestamoEvaluado> evaluarPrestamosDeGrupo(UUID clienteId, List<UUID> grupo) {
        return grupo.size() <= 1 ? evaluarPrestamosDe(clienteId) : evaluarConFiltro(Filtro.deClientes(grupo));
    }

    private List<PrestamoEvaluado> evaluarConFiltro(Filtro filtro) {
        LocalDate hoy = LocalDate.now(reloj);
        Map<UUID, List<CuotaGuardada>> cuotas = cuotasPorPrestamo(repositorio.cuotas(filtro));
        return repositorio.cabeceras(filtro).stream().map(c -> {
            List<CuotaGuardada> suyas = cuotas.getOrDefault(c.id(), List.of());
            return new PrestamoEvaluado(c, suyas, EvaluadorCartera.evaluar(c.estado(), suyas, hoy));
        }).toList();
    }

    /**
     * El evaluador ya es prudente con lo desconocido (un estado raro cuenta como deuda, nunca como pagado),
     * pero se deja constancia para que alguien revise el dato.
     */
    private static void avisarSiHayDatosRaros(PrestamoEvaluado p) {
        CabeceraPrestamo c = p.cabecera();
        if (!ESTADOS_PRESTAMO.contains(c.estado())) {
            LOG.warn("Préstamo PR-{} con estado desconocido '{}': se cuenta como deuda.", c.numero(), c.estado());
        }
        if (p.cuotas().isEmpty() && !EvaluadorCartera.PRESTAMO_CANCELADO.equals(c.estado())) {
            LOG.warn("Préstamo PR-{} ({}) sin cuotas guardadas: para el límite se cuenta todo su capital.", c.numero(), c.estado());
        }
        if (!p.cuotas().isEmpty() && !EvaluadorCartera.PRESTAMO_CANCELADO.equals(c.estado())
                && EvaluadorCartera.PRESTAMO_CANCELADO.equals(p.evaluacion().estado())) {
            LOG.warn("Préstamo PR-{} figura '{}' pero todas sus cuotas están PAGADA: no se cuenta como deuda.", c.numero(), c.estado());
        }
        p.cuotas().stream()
                .filter(q -> !ESTADOS_CUOTA.contains(q.estadoGuardado()))
                .forEach(q -> LOG.warn("Cuota {} del préstamo PR-{} con estado desconocido '{}': se cuenta como pendiente.",
                        q.numero(), c.numero(), q.estadoGuardado()));
    }

    static Filtro alcanceDe(Perfil perfil) {
        if (perfil == null) {
            throw new PrestamoException(Codigo.SIN_PERMISO, "No se pudo identificar al usuario de la sesión.");
        }
        if ("gerencia".equals(perfil.getRol())) {
            return Filtro.todos();
        }
        if (perfil.getAgencia() == null) {
            throw new PrestamoException(Codigo.SIN_PERMISO, "El asesor no tiene una agencia asignada.");
        }
        return Filtro.deAgencia(perfil.getAgencia().getId());
    }

    private static CuotaDetalle aDetalle(CuotaEvaluada q) {
        return new CuotaDetalle(q.numero(), q.fechaVencimiento(), q.capital(), q.interes(), q.importeCuota(),
                q.saldo(), q.estado(), q.importePendiente(), q.diasAtraso());
    }

    private static Map<UUID, List<CuotaGuardada>> cuotasPorPrestamo(List<CuotaDePrestamo> filas) {
        Map<UUID, List<CuotaGuardada>> mapa = new HashMap<>();
        for (CuotaDePrestamo f : filas) {
            mapa.computeIfAbsent(f.prestamoId(), k -> new ArrayList<>()).add(f.cuota());
        }
        return mapa;
    }

    private static String soles(BigDecimal importe) {
        return String.format(Locale.US, "S/ %,.2f", importe);
    }
}
