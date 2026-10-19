package com.nexora.backend.prestamos.dominio;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Límite diario de colocación de un asesor: la suma del capital de los préstamos que registró en el día (fecha de Lima)
 * no puede pasar de {@link ReglasPrestamo#LIMITE_DIARIO_ASESOR}. Los pagos de cuotas no lo reponen: cuenta lo prestado,
 * no lo que falta cobrar. Lo usan la pantalla de solicitud y el registro del préstamo.
 */
public record LimiteDiarioAsesor(
        LocalDate fecha,
        BigDecimal limite,
        BigDecimal colocadoHoy,
        BigDecimal disponible,
        BigDecimal capitalMinimo) {

    private static final BigDecimal CERO = new BigDecimal("0.00");

    public static LimiteDiarioAsesor de(LocalDate fecha, BigDecimal colocadoHoy) {
        BigDecimal colocado = colocadoHoy == null ? CERO : colocadoHoy;
        BigDecimal limite = ReglasPrestamo.LIMITE_DIARIO_ASESOR;
        BigDecimal disponible = limite.subtract(colocado).max(CERO);
        return new LimiteDiarioAsesor(fecha, limite, colocado, disponible, ReglasPrestamo.CAPITAL_MINIMO);
    }

    /** colocado hoy + monto nuevo <= límite. Llegar justo al límite está permitido. */
    public boolean permite(BigDecimal monto) {
        return monto.compareTo(disponible) <= 0;
    }

    /** Si lo que queda no llega al mínimo de un préstamo, el asesor ya no puede iniciar otra solicitud hoy. */
    public boolean alcanzaElMinimo() {
        return disponible.compareTo(ReglasPrestamo.CAPITAL_MINIMO) >= 0;
    }
}
