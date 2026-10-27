package com.nexora.backend.caja.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CapacidadCajaTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    private static void igual(String esperado, BigDecimal real) {
        assertEquals(0, d(esperado).compareTo(real), "esperado " + esperado + " y fue " + real);
    }

    @Test
    void caja_llena_no_admite_reposicion() {
        CapacidadCaja c = CapacidadCaja.de(d("50000"), d("50000"), null);
        igual("0", c.libre());
        assertFalse(c.permite(d("0.01")));
    }

    @Test
    void caja_vacia_admite_hasta_el_limite_exacto() {
        CapacidadCaja c = CapacidadCaja.de(d("50000"), d("0"), d("0"));
        igual("50000", c.libre());
        assertTrue(c.permite(d("50000")));
        assertFalse(c.permite(d("50000.01")));
    }

    @Test
    void lo_autorizado_pendiente_reserva_capacidad_pero_no_es_efectivo() {
        CapacidadCaja c = CapacidadCaja.de(d("50000"), d("20000"), d("10000"));
        igual("30000", c.capacidadHastaLimite());
        igual("20000", c.libre());
        igual("20000", c.saldo());              // el saldo físico no se mezcla con lo autorizado
        igual("30000", c.saldoProyectado());
        assertTrue(c.permite(d("20000")));
        assertFalse(c.permite(d("20000.01")));
    }

    @Test
    void nunca_hay_capacidad_negativa() {
        CapacidadCaja c = CapacidadCaja.de(d("50000"), d("45000"), d("9000"));
        igual("0", c.libre());
        assertFalse(c.permite(d("1")));
    }

    @Test
    void montos_cero_o_negativos_no_se_permiten() {
        CapacidadCaja c = CapacidadCaja.de(d("50000"), d("0"), d("0"));
        assertFalse(c.permite(d("0")));
        assertFalse(c.permite(d("-1")));
    }
}
