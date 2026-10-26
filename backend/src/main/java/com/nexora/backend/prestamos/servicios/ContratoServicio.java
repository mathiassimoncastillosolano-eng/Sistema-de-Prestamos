package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.ContratoPrestamo;
import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Origen;
import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Prestamista;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dto.ContratoRespuesta;
import com.nexora.backend.prestamos.entidades.Prestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.repositorios.ContratoRepositorio;
import com.nexora.backend.prestamos.repositorios.ContratoRepositorio.ContratoGuardado;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contrato de cada préstamo: borrador previo a la confirmación y versión definitiva guardada junto con el préstamo.
 * Ambos se arman con {@link ContratoPrestamo#construir}, con los mismos datos y el mismo cronograma, así que lo que se
 * revisa es lo que se guarda. El definitivo se inserta en la misma transacción que el préstamo y sus cuotas: si falla,
 * no queda préstamo sin contrato ni contrato sin préstamo.
 */
@Service
public class ContratoServicio {

    private static final Logger LOG = LoggerFactory.getLogger(ContratoServicio.class);
    private static final DateTimeFormatter HORA_LIMA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ContratoRepositorio repositorio;
    private final Clock reloj;
    private final Prestamista prestamista;

    public ContratoServicio(ContratoRepositorio repositorio, Clock reloj,
                            @Value("${nexora.contrato.prestamista.denominacion:Préstamos Castillo}") String denominacion,
                            @Value("${nexora.contrato.prestamista.ruc:}") String ruc,
                            @Value("${nexora.contrato.prestamista.domicilio:}") String domicilio,
                            @Value("${nexora.contrato.prestamista.representante:}") String representante) {
        this.repositorio = repositorio;
        this.reloj = reloj;
        this.prestamista = new Prestamista(limpio(denominacion), limpio(ruc), limpio(domicilio), limpio(representante));
    }

    private static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Borrador: no guarda nada. El código del préstamo aún no existe. */
    @Transactional(readOnly = true)
    public ContratoRespuesta preliminar(UUID clienteId, UUID agenciaId, UUID asesorId, BigDecimal capital, int plazoMeses,
                                        BigDecimal tea, LocalDate fechaDesembolso, String observaciones, Cronograma cronograma) {
        ZonedDateTime ahora = ZonedDateTime.now(reloj);
        ContratoPrestamo.Datos datos = ContratoPrestamo.construir(ContratoPrestamo.ESTADO_BORRADOR, null, ahora,
                origen(clienteId, agenciaId, asesorId), prestamista, capital, plazoMeses, tea, fechaDesembolso,
                observaciones, cronograma);
        String json = ContratoPrestamo.aJson(datos);
        return new ContratoRespuesta(ContratoPrestamo.ESTADO_BORRADOR, null, 0, 0, ContratoPrestamo.PLANTILLA_VERSION,
                ahora.format(HORA_LIMA), ContratoPrestamo.huella(json), json);
    }

    /**
     * Guarda la versión 1 del contrato del préstamo recién creado. Se llama dentro de la transacción del registro: cualquier
     * error revierte también el préstamo.
     */
    @Transactional
    public void guardarDefinitivo(Perfil asesor, Prestamo prestamo, Long numero, Cronograma cronograma) {
        ZonedDateTime ahora = ZonedDateTime.now(reloj);
        ContratoPrestamo.Datos datos = ContratoPrestamo.construir(ContratoPrestamo.ESTADO_DEFINITIVO, numero, ahora,
                origen(prestamo.getClienteId(), prestamo.getAgenciaId(), prestamo.getAsesorId()), prestamista,
                prestamo.getCapital(), prestamo.getPlazoMeses(), prestamo.getTea(), prestamo.getFechaDesembolso(),
                prestamo.getObservaciones(), cronograma);
        String json = ContratoPrestamo.aJson(datos);
        repositorio.insertar(prestamo.getId(), 1, ContratoPrestamo.PLANTILLA_VERSION, json, ContratoPrestamo.huella(json),
                asesor.getId());
    }

    /**
     * Contrato guardado del préstamo (versión más reciente). La gerencia accede a todos; el asesor solo a los de su agencia.
     * Se verifica la huella: si el texto guardado no coincide, no se entrega.
     */
    private static final String MSG_FUERA_DE_ALCANCE = "El préstamo no existe o no está dentro de tu alcance.";

    @Transactional(readOnly = true)
    public ContratoRespuesta obtener(Perfil perfil, UUID prestamoId) {
        if (perfil == null) {
            throw new PrestamoException(Codigo.SIN_PERMISO, "No se pudo identificar al usuario de la sesión.");
        }
        UUID agencia = repositorio.agenciaDelPrestamo(prestamoId)
                .orElseThrow(() -> new PrestamoException(Codigo.PRESTAMO_NO_ENCONTRADO, MSG_FUERA_DE_ALCANCE));
        boolean gerencia = "gerencia".equals(perfil.getRol());
        boolean suAgencia = perfil.getAgencia() != null && agencia.equals(perfil.getAgencia().getId());
        if (!gerencia && !suAgencia) {
            // Misma respuesta que «no existe»: no se revela si un préstamo de otra agencia existe.
            throw new PrestamoException(Codigo.PRESTAMO_NO_ENCONTRADO, MSG_FUERA_DE_ALCANCE);
        }
        ContratoGuardado c = repositorio.ultimo(prestamoId).orElseThrow(() -> new PrestamoException(
                Codigo.CONTRATO_NO_DISPONIBLE,
                "Este préstamo no tiene un contrato guardado: se registró antes de que el sistema generara contratos. "
                        + "No se crea uno a posteriori para no atribuirle condiciones que no se firmaron."));
        if (!ContratoPrestamo.huella(c.datos()).equals(c.huella())) {
            LOG.error("Contrato {} del préstamo {}: la huella guardada no coincide con el texto.", c.id(), prestamoId);
            throw new IllegalStateException("La integridad del contrato guardado no se pudo verificar.");
        }
        Long numero = repositorio.numeroDelPrestamo(prestamoId).orElse(null);
        return new ContratoRespuesta(ContratoPrestamo.ESTADO_DEFINITIVO, numero == null ? null : "PR-" + numero,
                c.version(), c.totalVersiones(), c.plantillaVersion(), c.generadoEn(), c.huella(), c.datos());
    }

    private Origen origen(UUID clienteId, UUID agenciaId, UUID asesorId) {
        return repositorio.origen(clienteId, agenciaId, asesorId).orElseThrow(() -> new PrestamoException(
                Codigo.DATOS_INVALIDOS, "No se encontraron los datos del cliente, la agencia o el asesor para el contrato."));
    }
}
