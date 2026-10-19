package com.nexora.backend.prestamos.dominio;

import java.math.BigDecimal;

/** Reglas de negocio fijas del préstamo (BR-PRE-*, BR-END-01). Un solo lugar para cambiarlas. */
public final class ReglasPrestamo {

    public static final String MONEDA = "PEN";
    public static final BigDecimal CAPITAL_MINIMO = new BigDecimal("1000.00");
    public static final BigDecimal LIMITE_ENDEUDAMIENTO = new BigDecimal("10000.00");
    /** Lo máximo que un asesor puede colocar (sumando el capital de sus préstamos) en un mismo día de Lima. */
    public static final BigDecimal LIMITE_DIARIO_ASESOR = new BigDecimal("50000.00");
    public static final int PLAZO_MINIMO_MESES = 1;
    public static final int PLAZO_MAXIMO_MESES = 60;
    /** TEA inicial de referencia: 30 % (escala 6, igual que la columna prestamos.tea). */
    public static final BigDecimal TEA = new BigDecimal("0.300000");

    private ReglasPrestamo() {
    }
}