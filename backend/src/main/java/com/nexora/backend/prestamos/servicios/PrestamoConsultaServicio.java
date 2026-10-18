package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaEvaluada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import com.nexora.backend.prestamos.dto.PrestamoDetalle;
import com.nexora.backend.prestamos.dto.PrestamoDetalle.CuotaDetalle;
import com.nexora.backend.prestamos.dto.PrestamoDetalle.EventoHistorial;
import com.nexora.backend.prestamos.dto.PrestamoListado;
import com.nexora.backend.prestamos.dto.PrestamoResumen;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CabeceraPrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.CuotaDePrestamo;
import com.nexora.backend.prestamos.repositorios.PrestamoConsultaRepositorio.Filtro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consultas de préstamos: listado, detalle y resumen por cliente. Todo sale de la BD y todo estado/saldo lo calcula
 * EvaluadorCartera con la fecha de negocio de Lima, de modo que las tres vistas coinciden entre sí.
 */
@Service
public class PrestamoConsultaServicio {

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
                c.clienteNumeroDocumento(), c.agenciaNombre(), c.asesorNombre(), "PEN", c.capital(), c.plazoMeses(),
                c.tea(), c.fechaDesembolso(), cuotas.get(0).fechaVencimiento(),
                cuotas.get(cuotas.size() - 1).fechaVencimiento(), e.estado(), c.observaciones(), cuotaMensual,
                totalIntereses, e.totalContractual(), e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento(),
                e.cuotasVencidas(), cuotas, historial);
    }

    /** Préstamos de un cliente en todas las agencias (detalle del cliente): mismos saldos y estados que el listado. */
    @Transactional(readOnly = true)
    public List<PrestamoResumen> listarPorCliente(UUID clienteId) {
        if (clienteId == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "Indica el cliente.");
        }
        Filtro filtro = Filtro.deCliente(clienteId);
        LocalDate hoy = LocalDate.now(reloj);
        Map<UUID, List<CuotaGuardada>> cuotas = cuotasPorPrestamo(repositorio.cuotas(filtro));
        return repositorio.cabeceras(filtro).stream().map(c -> {
            Evaluacion e = EvaluadorCartera.evaluar(c.estado(), cuotas.getOrDefault(c.id(), List.of()), hoy);
            return new PrestamoResumen(c.id(), c.numero(), c.capital(), c.plazoMeses(), c.fechaDesembolso(), e.estado(),
                    e.totalContractual(), e.capitalPendiente(), e.totalPendiente(), e.proximoVencimiento());
        }).toList();
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
