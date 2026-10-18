package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CalculadoraCronogramaTest {

    private static final BigDecimal TEA = new BigDecimal("0.30");

    private static Cronograma calc(String capital, int plazo, LocalDate fecha) {
        return CalculadoraCronograma.calcular(new BigDecimal(capital), plazo, TEA, fecha);
    }

    @Test
    void mil_soles_12_meses() {
        Cronograma c = calc("1000", 12, LocalDate.of(2026, 1, 15));
        assertEquals(12, c.cuotas().size());
        assertEquals(new BigDecimal("95.79"), c.cuotaMensual());
        assertEquals(new BigDecimal("149.43"), c.totalIntereses());
        assertEquals(new BigDecimal("1149.43"), c.totalContractual());
        assertEquals(new BigDecimal("95.74"), c.cuotas().get(11).importeCuota()); // ajuste última
        assertEquals(new BigDecimal("0.00"), c.cuotas().get(11).saldo());
    }

    @Test
    void plazo_de_un_mes() {
        Cronograma c = calc("1000", 1, LocalDate.of(2026, 3, 10));
        assertEquals(1, c.cuotas().size());
        assertEquals(new BigDecimal("1022.10"), c.cuotas().get(0).importeCuota());
    }

    @Test
    void plazo_maximo_60_cuotas() {
        Cronograma c = calc("10000", 60, LocalDate.of(2026, 1, 15));
        assertEquals(60, c.cuotas().size());
        assertEquals(new BigDecimal("302.52"), c.cuotaMensual());
        assertEquals(new BigDecimal("8151.47"), c.totalIntereses());
        assertEquals(0, c.cuotas().get(59).saldo().signum());
    }

    @Test
    void suma_de_cuotas_coincide_con_total_contractual() {
        Cronograma c = calc("3500", 18, LocalDate.of(2026, 5, 20));
        BigDecimal suma = c.cuotas().stream()
                .map(Cronograma.Cuota::importeCuota)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(c.totalContractual(), suma);
    }

    @Test
    void es_determinista() {
        assertEquals(calc("2500", 24, LocalDate.of(2026, 2, 3)),
                     calc("2500", 24, LocalDate.of(2026, 2, 3)));
    }

    @Test
    void primera_cuota_dia_15() {
        assertEquals(LocalDate.of(2026, 7, 15),
                calc("1000", 6, LocalDate.of(2026, 6, 15)).cuotas().get(0).fechaVencimiento());
    }

    @Test
    void desembolso_en_diciembre_cae_en_enero() {
        assertEquals(LocalDate.of(2027, 1, 15),
                calc("1000", 6, LocalDate.of(2026, 12, 15)).cuotas().get(0).fechaVencimiento());
    }

    @Test
    void dia_31_se_ajusta_al_ultimo_dia_sin_arrastrar_el_ajuste() {
        List<Cronograma.Cuota> q = calc("1000", 3, LocalDate.of(2026, 1, 31)).cuotas();
        assertEquals(LocalDate.of(2026, 2, 28), q.get(0).fechaVencimiento());
        assertEquals(LocalDate.of(2026, 3, 31), q.get(1).fechaVencimiento());
    }

    @Test
    void ano_bisiesto_29_de_enero() {
        assertEquals(LocalDate.of(2028, 2, 29),
                calc("1000", 2, LocalDate.of(2028, 1, 29)).cuotas().get(0).fechaVencimiento());
    }

    @Test
    void rechaza_entradas_invalidas() {
        assertThrows(IllegalArgumentException.class, () -> calc("0", 12, LocalDate.now()));
        assertThrows(IllegalArgumentException.class, () -> calc("1000", 0, LocalDate.now()));
    }
}