package com.nexora.backend.prestamos.dominio;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Cálculo determinista del cronograma (cuota fija, sistema francés).
 * No valida reglas de negocio (mínimo, plazo, límite): eso lo hace PrestamoService.
 */
public final class CalculadoraCronograma {

    private static final MathContext MC = new MathContext(34, RoundingMode.HALF_EVEN);
    private static final int MESES_POR_ANIO = 12;

    private CalculadoraCronograma() {
    }

    public static Cronograma calcular(BigDecimal capital, int plazoMeses,
                                      BigDecimal tea, LocalDate fechaDesembolso) {
        if (capital == null || capital.signum() <= 0) {
            throw new IllegalArgumentException("El capital debe ser mayor que cero");
        }
        if (plazoMeses <= 0) {
            throw new IllegalArgumentException("El plazo debe ser mayor que cero");
        }
        if (tea == null || tea.signum() < 0) {
            throw new IllegalArgumentException("La TEA no puede ser negativa");
        }
        if (fechaDesembolso == null) {
            throw new IllegalArgumentException("La fecha de desembolso es obligatoria");
        }

        BigDecimal tem = tasaMensual(tea);
        BigDecimal cuotaFija = cuotaFija(capital, plazoMeses, tem);

        List<Cronograma.Cuota> cuotas = new ArrayList<>(plazoMeses);
        BigDecimal saldo = capital;
        BigDecimal totalIntereses = BigDecimal.ZERO;

        for (int k = 1; k <= plazoMeses; k++) {
            BigDecimal interes = saldo.multiply(tem).setScale(2, RoundingMode.HALF_UP);
            // La última cuota cancela exactamente el saldo (absorbe el redondeo).
            BigDecimal capitalCuota = (k == plazoMeses) ? saldo : cuotaFija.subtract(interes);
            BigDecimal importe = capitalCuota.add(interes);
            saldo = saldo.subtract(capitalCuota);

            // plusMonths ajusta al último día del mes si el día no existe.
            // Siempre se calcula desde la fecha original para no arrastrar el ajuste.
            LocalDate vencimiento = fechaDesembolso.plusMonths(k);

            cuotas.add(new Cronograma.Cuota(k, vencimiento, capitalCuota, interes, importe, saldo));
            totalIntereses = totalIntereses.add(interes);
        }

        return new Cronograma(
                List.copyOf(cuotas),
                cuotaFija,
                totalIntereses,
                capital.add(totalIntereses));
    }

    /** TEM = (1 + TEA)^(1/12) - 1. StrictMath garantiza el mismo resultado en cualquier JVM. */
    static BigDecimal tasaMensual(BigDecimal tea) {
        if (tea.signum() == 0) {
            return BigDecimal.ZERO;
        }
        double base = 1.0 + tea.doubleValue();
        double raiz = StrictMath.pow(base, 1.0 / MESES_POR_ANIO);
        return BigDecimal.valueOf(raiz).subtract(BigDecimal.ONE);
    }

    /** Cuota = C * i * (1+i)^n / ((1+i)^n - 1); con i = 0, C / n. */
    static BigDecimal cuotaFija(BigDecimal capital, int n, BigDecimal tem) {
        if (tem.signum() == 0) {
            return capital.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
        }
        BigDecimal factor = BigDecimal.ONE.add(tem).pow(n, MC);
        return capital.multiply(tem).multiply(factor)
                .divide(factor.subtract(BigDecimal.ONE), MC)
                .setScale(2, RoundingMode.HALF_UP);
    }
}