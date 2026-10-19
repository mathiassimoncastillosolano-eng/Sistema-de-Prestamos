package com.nexora.backend.prestamos.dominio;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaEvaluada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.time.LocalDate;
import java.util.List;

/**
 * ÚNICA regla del estado del cliente ({@code clientes.estado}). Lógica pura (sin Spring ni BD), a partir de TODOS sus
 * préstamos ya evaluados por {@link EvaluadorCartera}, así que una cuota vencida es la misma que muestran el listado y
 * el detalle de préstamos.
 *
 * <ul>
 *   <li>ACTIVO: ninguna cuota vencida sin pagar (con o sin préstamos).</li>
 *   <li>MOROSO: al menos una cuota VENCIDA en un préstamo no cancelado.</li>
 *   <li>EXTRAJUDICIAL: desde el vencimiento de su primera cuota impaga ha pasado un año o más.</li>
 * </ul>
 * Aún no existe registro de pagos ni abonos: lo único que cubre una cuota es {@code cuotas.estado = 'PAGADA'}. Al marcar
 * cuotas como PAGADA se recalcula la primera impaga, de modo que el cliente baja a MOROSO o a ACTIVO según lo que quede.
 */
public final class EstadoCliente {

    public static final String ACTIVO = "ACTIVO";
    public static final String MOROSO = "MOROSO";
    public static final String EXTRAJUDICIAL = "EXTRAJUDICIAL";

    /** Plazo desde la primera cuota impaga vencida para pasar a EXTRAJUDICIAL. */
    public static final int ANIOS_EXTRAJUDICIAL = 1;

    private EstadoCliente() {
    }

    public static String de(List<Evaluacion> prestamos, LocalDate hoy) {
        LocalDate primeraImpaga = null;
        for (Evaluacion e : prestamos) {
            if (EvaluadorCartera.PRESTAMO_CANCELADO.equals(e.estado())) {
                continue;
            }
            for (CuotaEvaluada q : e.cuotas()) {
                if (EvaluadorCartera.CUOTA_VENCIDA.equals(q.estado())
                        && (primeraImpaga == null || q.fechaVencimiento().isBefore(primeraImpaga))) {
                    primeraImpaga = q.fechaVencimiento();
                }
            }
        }
        if (primeraImpaga == null) {
            return ACTIVO;
        }
        return hoy.isBefore(primeraImpaga.plusYears(ANIOS_EXTRAJUDICIAL)) ? MOROSO : EXTRAJUDICIAL;
    }

    /** Solo un cliente ACTIVO puede recibir un préstamo nuevo. */
    public static boolean permiteNuevoPrestamo(String estado) {
        return ACTIVO.equals(estado);
    }
}
