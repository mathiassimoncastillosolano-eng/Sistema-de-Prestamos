package com.nexora.backend.caja.dominio;

import java.math.BigDecimal;

/**
 * Capacidad de una caja, siempre derivada de datos del servidor (nunca del navegador):
 * <ul>
 *   <li>saldo: efectivo físico contabilizado (libro de movimientos).</li>
 *   <li>autorizadoPendiente: reposiciones autorizadas y todavía no recibidas. NO es efectivo: no suma al saldo.</li>
 *   <li>libre: lo que aún se puede autorizar sin que, al recibirse todo lo pendiente, se pase del límite.</li>
 * </ul>
 */
public record CapacidadCaja(BigDecimal limite, BigDecimal saldo, BigDecimal autorizadoPendiente) {

    private static final BigDecimal CERO = new BigDecimal("0.00");

    public static CapacidadCaja de(BigDecimal limite, BigDecimal saldo, BigDecimal autorizadoPendiente) {
        return new CapacidadCaja(limite, saldo, autorizadoPendiente == null ? CERO : autorizadoPendiente);
    }

    /** limite − saldo (nunca negativo): cuánto efectivo cabe físicamente hoy. */
    public BigDecimal capacidadHastaLimite() {
        return limite.subtract(saldo).max(CERO);
    }

    /** limite − saldo − autorizadoPendiente (nunca negativo): lo máximo que se puede solicitar o autorizar ahora. */
    public BigDecimal libre() {
        return limite.subtract(saldo).subtract(autorizadoPendiente).max(CERO);
    }

    /** Saldo si se recibiera todo lo autorizado pendiente. Proyección: no es efectivo. */
    public BigDecimal saldoProyectado() {
        return saldo.add(autorizadoPendiente);
    }

    public boolean permite(BigDecimal monto) {
        return monto.signum() > 0 && monto.compareTo(libre()) <= 0;
    }
}
