package com.nexora.backend.caja.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.dominio.CapacidadCaja;
import com.nexora.backend.caja.dominio.ReglasCaja;
import com.nexora.backend.caja.dto.CajaDtos.CajaResumen;
import com.nexora.backend.caja.dto.CajaDtos.Movimiento;
import com.nexora.backend.caja.dto.CajaDtos.Pagina;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import com.nexora.backend.caja.repositorios.CajaRepositorio;
import com.nexora.backend.caja.repositorios.CajaRepositorio.CajaFila;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Caja del asesor: apertura, resumen, libro de movimientos y la integración con el desembolso de préstamos.
 *
 * <p>Orden de bloqueos (común a todo el sistema, para que dos transacciones nunca se esperen en círculo):
 * grupo crediticio del cliente → caja → reposición.
 */
@Service
public class CajaServicio {

    private static final int TAMANO_DEFECTO = 20;

    private final CajaRepositorio cajas;
    private final ReposicionRepositorio reposiciones;
    private final Clock reloj;

    public CajaServicio(CajaRepositorio cajas, ReposicionRepositorio reposiciones, Clock reloj) {
        this.cajas = cajas;
        this.reposiciones = reposiciones;
        this.reloj = reloj;
    }

    /**
     * Devuelve la caja del asesor BLOQUEADA hasta el fin de la transacción, abriéndola con S/ 50,000 si es la primera vez.
     * La apertura es el primer movimiento del libro. Seguro ante dos llamadas simultáneas (índice único por asesor).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public CajaFila bloquearCaja(Perfil asesor) {
        Validaciones.exigirAsesor(asesor);
        UUID asesorId = asesor.getId();
        boolean creada = cajas.crearSiNoExiste(asesorId, asesor.getAgencia().getId(), asesorId);
        CajaFila caja = cajas.bloquearPorAsesor(asesorId)
                .orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No se pudo abrir la caja del asesor."));
        if (creada) {
            UUID correlacion = UUID.randomUUID();
            cajas.insertarMovimiento(caja.id(), "APERTURA", "ENTRADA", ReglasCaja.SALDO_APERTURA, caja.saldo(),
                    caja.saldo().add(ReglasCaja.SALDO_APERTURA), null, null, null, "Apertura de caja", asesorId, correlacion);
            reposiciones.auditar(caja.id(), null, asesorId, "CAJA_ABIERTA", ReglasCaja.SALDO_APERTURA,
                    "Apertura con saldo inicial " + Validaciones.soles(ReglasCaja.SALDO_APERTURA), correlacion);
            caja = cajas.bloquearPorAsesor(asesorId).orElseThrow();
        }
        return caja;
    }

    /**
     * Comprueba (con la caja ya bloqueada) que el desembolso cabe en el efectivo. Si no, el préstamo NO se registra y se
     * indica cuánto falta y que debe solicitar una reposición.
     */
    public void verificarEfectivo(CajaFila caja, BigDecimal monto) {
        if (!"ABIERTA".equals(caja.estado())) {
            throw new PrestamoException(PrestamoException.Codigo.CAJA_CERRADA,
                    "Tu caja está cerrada: no se pueden registrar desembolsos.");
        }
        if (monto.compareTo(caja.saldo()) > 0) {
            throw sinEfectivo(caja.saldo(), monto);
        }
    }

    /** Variante de solo lectura para el borrador del contrato: sin caja todavía, el efectivo será el de la apertura. */
    @Transactional(readOnly = true)
    public void verificarEfectivoLectura(Perfil asesor, BigDecimal monto) {
        Validaciones.exigirAsesor(asesor);
        BigDecimal saldo = cajas.porAsesor(asesor.getId()).map(CajaFila::saldo).orElse(ReglasCaja.SALDO_APERTURA);
        if (monto.compareTo(saldo) > 0) {
            throw sinEfectivo(saldo, monto);
        }
    }

    private static PrestamoException sinEfectivo(BigDecimal saldo, BigDecimal monto) {
        BigDecimal falta = monto.subtract(saldo);
        return new PrestamoException(PrestamoException.Codigo.SALDO_CAJA_INSUFICIENTE,
                "El préstamo no se registró: tu caja tiene " + Validaciones.soles(saldo) + " en efectivo y el desembolso es de "
                        + Validaciones.soles(monto) + " (te faltan " + Validaciones.soles(falta)
                        + "). Solicita una reposición a gerencia desde «Caja y reposiciones».",
                Map.of("saldo", saldo, "solicitado", monto, "falta", falta));
    }

    /**
     * Descuenta el desembolso de la caja. Debe ejecutarse en la MISMA transacción que el registro del préstamo: si algo
     * falla, no queda ni el préstamo ni el movimiento. Un préstamo descuenta una sola vez (índice único por préstamo).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void registrarDesembolso(CajaFila caja, Perfil asesor, UUID prestamoId, Long numeroPrestamo, BigDecimal capital) {
        verificarEfectivo(caja, capital);
        UUID correlacion = UUID.randomUUID();
        cajas.insertarMovimiento(caja.id(), "DESEMBOLSO", "SALIDA", capital, caja.saldo(), caja.saldo().subtract(capital),
                prestamoId, null, null, numeroPrestamo == null ? null : "Préstamo PR-" + numeroPrestamo, asesor.getId(),
                correlacion);
        reposiciones.auditar(caja.id(), null, asesor.getId(), "DESEMBOLSO", capital,
                numeroPrestamo == null ? "Desembolso de préstamo" : "Desembolso del préstamo PR-" + numeroPrestamo, correlacion);
    }

    // ------------------------------------------------------------------------------------------ consultas del asesor
    /** Resumen de la caja del asesor en sesión (la abre si todavía no existe; si ya existe solo lee, sin bloquear). */
    @Transactional
    public CajaResumen resumen(Perfil asesor) {
        Validaciones.exigirAsesor(asesor);
        CajaFila caja = cajas.porAsesor(asesor.getId()).orElseGet(() -> bloquearCaja(asesor));
        BigDecimal pendiente = cajas.autorizadoPendiente(caja.id(), null);
        CapacidadCaja cap = CapacidadCaja.de(caja.limite(), caja.saldo(), pendiente);
        var abierta = reposiciones.abiertaDeCaja(caja.id()).flatMap(r -> reposiciones.filaPorId(r.id())).orElse(null);
        var ultima = cajas.ultimaRecepcion(caja.id()).orElse(null);
        String nombre = (asesor.getNombres() + " " + asesor.getApellidos()).replaceAll("\\s+", " ").trim();
        return new CajaResumen(caja.id(), caja.asesorId(), nombre, caja.agenciaId(), asesor.getAgencia().getNombre(),
                caja.estado(), caja.limite(), caja.saldo(), caja.saldoInicial(), cap.capacidadHastaLimite(), pendiente,
                cap.libre(), cap.saldoProyectado(), abierta, ultima, cajas.incidenciasAbiertas(caja.id()),
                caja.abiertaEn(), Instant.now(reloj));
    }

    @Transactional(readOnly = true)
    public Pagina<Movimiento> movimientos(Perfil asesor, Integer pagina, Integer tamano) {
        Validaciones.exigirAsesor(asesor);
        CajaFila caja = cajas.porAsesor(asesor.getId()).orElse(null);
        int p = pagina == null || pagina < 1 ? 1 : pagina;
        int t = tamano == null || tamano < 1 ? TAMANO_DEFECTO : Math.min(tamano, ReglasCaja.PAGINA_MAX);
        if (caja == null) {
            return new Pagina<>(java.util.List.of(), 0, p, t, Instant.now(reloj));
        }
        return new Pagina<>(cajas.movimientos(caja.id(), t, (p - 1) * t), cajas.contarMovimientos(caja.id()), p, t,
                Instant.now(reloj));
    }
}
