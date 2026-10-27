package com.nexora.backend.caja.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CodigoHermesTest {

    @Test
    void exige_exactamente_ocho_digitos() {
        assertTrue(CodigoHermes.formatoValido("12345678"));
        assertTrue(CodigoHermes.formatoValido("00000000"));
        assertFalse(CodigoHermes.formatoValido("1234567"));
        assertFalse(CodigoHermes.formatoValido("123456789"));
        assertFalse(CodigoHermes.formatoValido("1234567a"));
        assertFalse(CodigoHermes.formatoValido("1234 678"));
        assertFalse(CodigoHermes.formatoValido(" 2345678"));
        assertFalse(CodigoHermes.formatoValido("1234567\n"));
        assertFalse(CodigoHermes.formatoValido(""));
        assertFalse(CodigoHermes.formatoValido(null));
    }

    @Test
    void rechaza_digitos_que_no_son_ascii() {
        assertFalse(CodigoHermes.formatoValido("١٢٣٤٥٦٧٨")); // dígitos arábigos orientales
        assertFalse(CodigoHermes.formatoValido("１２３４５６７８")); // dígitos de ancho completo
    }

    @Test
    void la_huella_es_estable_hexadecimal_y_no_contiene_el_codigo() {
        String h = CodigoHermes.huella("12345678", "secreto-de-prueba");
        assertEquals(64, h.length());
        assertTrue(h.matches("[0-9a-f]{64}"));
        assertFalse(h.contains("12345678"));
        assertEquals(h, CodigoHermes.huella("12345678", "secreto-de-prueba"));
    }

    @Test
    void la_huella_depende_del_codigo_y_del_secreto() {
        assertNotEquals(CodigoHermes.huella("12345678", "a"), CodigoHermes.huella("12345679", "a"));
        assertNotEquals(CodigoHermes.huella("12345678", "a"), CodigoHermes.huella("12345678", "b"));
    }

    @Test
    void sin_secreto_no_se_calcula_huella() {
        assertThrows(IllegalStateException.class, () -> CodigoHermes.huella("12345678", ""));
        assertThrows(IllegalStateException.class, () -> CodigoHermes.huella("12345678", null));
    }
}
