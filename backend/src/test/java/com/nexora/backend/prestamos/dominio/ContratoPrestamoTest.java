package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Datos;
import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Origen;
import com.nexora.backend.prestamos.dominio.ContratoPrestamo.Prestamista;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;

class ContratoPrestamoTest {

    private static final ZonedDateTime AHORA = ZonedDateTime.of(2026, 10, 17, 22, 0, 5, 0, ZoneId.of("America/Lima"));
    private static final LocalDate DESEMBOLSO = LocalDate.of(2026, 10, 17);
    private final Cronograma cronograma = CalculadoraCronograma.calcular(new BigDecimal("1000.00"), 12, ReglasPrestamo.TEA, DESEMBOLSO);
    private final Origen origen = new Origen("Ana Pérez", "DNI", "12345678", "987654321", null, null, null, null, null,
            "Agencia Piura", "Piura", "Piura", "Castilla", "Av. X 1", "Camila Ortiz");

    private Datos construir(String estado, Long numero, Prestamista pr) {
        return ContratoPrestamo.construir(estado, numero, AHORA, origen, pr, new BigDecimal("1000.00"), 12,
                ReglasPrestamo.TEA, DESEMBOLSO, null, cronograma);
    }

    @Test
    void elBorradorEsElDefinitivoSalvoEstadoYCodigo() {
        Prestamista pr = new Prestamista("Préstamos Castillo", null, null, null);
        Datos b = construir("BORRADOR", null, pr);
        Datos f = construir("DEFINITIVO", 1001L, pr);
        assertNull(b.codigo());
        assertEquals("PR-1001", f.codigo());
        assertEquals(f.condiciones(), b.condiciones());
        assertEquals(f.cronograma(), b.cronograma());
        assertEquals(f.prestatario(), b.prestatario());
    }

    @Test
    void usaLosImportesYFechasDelCronogramaSinRecalcular() {
        Datos d = construir("DEFINITIVO", 1001L, new Prestamista("X", null, null, null));
        assertEquals(cronograma.totalContractual(), d.condiciones().totalContractual());
        assertEquals(new BigDecimal("1149.43"), d.condiciones().totalContractual());
        assertEquals("2026-11-15", d.condiciones().fechaPrimerVencimiento());
        assertEquals(12, d.cronograma().size());
        assertEquals("Castilla, Piura, Piura", d.lugarCelebracion());
        assertEquals("2026-10-17T22:00:05-05:00", d.generadoEn());
    }

    @Test
    void jsonDeterministaConImportesPlanosYHuellaEstable() {
        Datos d = construir("DEFINITIVO", 1001L, new Prestamista("X", null, null, null));
        String json = ContratoPrestamo.aJson(d);
        assertEquals(json, ContratoPrestamo.aJson(d));
        assertTrue(json.contains("\"capital\":1000.00"));
        assertFalse(json.contains("E+"));
        String h = ContratoPrestamo.huella(json);
        assertEquals(64, h.length());
        assertEquals(h, ContratoPrestamo.huella(json));
        assertFalse(h.equals(ContratoPrestamo.huella(json + " ")));
    }

    @Test
    void declaraLoQueNoEstaDefinidoEnVezDeInventarlo() {
        Datos sin = construir("DEFINITIVO", 1L, new Prestamista("X", null, null, null));
        assertTrue(sin.noDefinido().stream().anyMatch(s -> s.startsWith("RUC del prestamista")));
        assertTrue(sin.noDefinido().stream().anyMatch(s -> s.startsWith("Intereses moratorios")));
        assertTrue(sin.noDefinido().stream().anyMatch(s -> s.startsWith("Pagos anticipados")));
        Datos con = construir("DEFINITIVO", 1L, new Prestamista("X", "20123456789", "Av. Grau 1", "Rep"));
        assertFalse(con.noDefinido().stream().anyMatch(s -> s.startsWith("RUC del prestamista")));
        assertTrue(con.noDefinido().stream().anyMatch(s -> s.startsWith("Garantías")));
    }
}
