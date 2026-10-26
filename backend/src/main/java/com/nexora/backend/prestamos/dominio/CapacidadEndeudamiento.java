package com.nexora.backend.prestamos.dominio;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.util.List;

/**
 * Capacidad de endeudamiento de un cliente en TODA la empresa (BR-END-01) y de las personas/negocios vinculados a él
 * (grupo crediticio DNI ↔ RUC 10, ver DeudaConsolidada). Es la única fórmula: la usan el perfil del cliente, el
 * formulario de solicitud y el registro del préstamo.
 *
 * <p>Se parte de los préstamos ya evaluados por {@link EvaluadorCartera}: un préstamo Cancelado aporta 0 y de los demás
 * solo cuentan las cuotas que no figuran PAGADA. Para el límite cuenta el capital; los intereses solo se informan.
 */
public record CapacidadEndeudamiento(
        BigDecimal limite,
        BigDecimal capitalPendiente,
        BigDecimal importePendiente,
        BigDecimal disponible,
        /** Cuántos clientes forman el grupo crediticio cuyo endeudamiento se suma (1 = sin vinculados). Ver DeudaConsolidada. */
        int integrantes) {

    private static final BigDecimal CERO = new BigDecimal("0.00");

    /** Sin información de grupo: el cliente cuenta solo. */
    public CapacidadEndeudamiento(BigDecimal limite, BigDecimal capitalPendiente, BigDecimal importePendiente,
                                  BigDecimal disponible) {
        this(limite, capitalPendiente, importePendiente, disponible, 1);
    }

    public static CapacidadEndeudamiento de(List<Evaluacion> prestamos) {
        return de(prestamos, 1);
    }

    /**
     * Misma fórmula para un cliente solo o para su grupo crediticio: se le pasan los préstamos de TODOS los integrantes
     * (cada uno una sola vez) y {@code integrantes} es solo informativo.
     */
    public static CapacidadEndeudamiento de(List<Evaluacion> prestamos, int integrantes) {
        BigDecimal capital = CERO;
        BigDecimal importe = CERO;
        for (Evaluacion e : prestamos) {
            capital = capital.add(e.capitalPendiente());
            importe = importe.add(e.totalPendiente());
        }
        BigDecimal limite = ReglasPrestamo.LIMITE_ENDEUDAMIENTO;
        BigDecimal disponible = limite.subtract(capital).max(CERO);
        return new CapacidadEndeudamiento(limite, capital, importe, disponible, Math.max(1, integrantes));
    }

    /** true si el endeudamiento incluye a otros clientes vinculados al consultado. */
    public boolean consolidada() {
        return integrantes > 1;
    }

    /** Un monto cabe si no supera lo disponible. */
    public boolean permite(BigDecimal monto) {
        return monto.compareTo(disponible) <= 0;
    }

    /** Si lo disponible no llega al mínimo, el cliente no puede pedir un préstamo nuevo. */
    public boolean alcanzaElMinimo() {
        return disponible.compareTo(ReglasPrestamo.CAPITAL_MINIMO) >= 0;
    }
}
