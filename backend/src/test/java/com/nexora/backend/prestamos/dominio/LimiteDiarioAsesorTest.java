package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class LimiteDiarioAsesorTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 19);

    private static LimiteDiarioAsesor con(String colocado) {
        return LimiteDiarioAsesor.de(HOY, new BigDecimal(colocado));
    }

    @ParameterizedTest(name = "colocado {0} → disponible {1}, puede iniciar: {2}")
    @CsvSource({
            "0.00,      50000.00, true",
            "32000.00,  18000.00, true",
            "47500.00,  2500.00,  true",
            "48000.00,  2000.00,  true",
            "49000.00,  1000.00,  true",
            "49500.00,  500.00,   false",
            "49999.99,  0.01,     false",
            "50000.00,  0.00,     false"
    })
    void disponible_y_si_alcanza_para_el_minimo(String colocado, String disponible, boolean puedeIniciar) {
        LimiteDiarioAsesor l = con(colocado);
        assertEquals(new BigDecimal(disponible), l.disponible());
        assertEquals(puedeIniciar, l.alcanzaElMinimo());
    }

    @Test
    void se_puede_llegar_justo_al_limite_pero_no_pasarlo_ni_por_un_centimo() {
        LimiteDiarioAsesor l = con("45000.00");
        assertTrue(l.permite(new BigDecimal("5000.00")));
        assertFalse(l.permite(new BigDecimal("5000.01")));
    }

    @Test
    void sin_prestamos_hoy_el_colocado_es_cero() {
        LimiteDiarioAsesor l = LimiteDiarioAsesor.de(HOY, null);
        assertEquals(new BigDecimal("0.00"), l.colocadoHoy());
        assertEquals(new BigDecimal("50000.00"), l.disponible());
    }

    @Test
    void el_minimo_y_el_limite_salen_de_las_reglas_existentes() {
        LimiteDiarioAsesor l = con("0");
        assertEquals(ReglasPrestamo.CAPITAL_MINIMO, l.capitalMinimo());
        assertEquals(ReglasPrestamo.LIMITE_DIARIO_ASESOR, l.limite());
    }
}
