package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class EstadoClienteTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 18);
    private static final BigDecimal CIEN = new BigDecimal("100.00");

    /** Cuota guardada con vencimiento y estado en la BD. */
    private static CuotaGuardada cuota(int numero, LocalDate vence, String estado) {
        return new CuotaGuardada(numero, vence, CIEN, BigDecimal.ZERO.setScale(2), CIEN, CIEN, estado);
    }

    /** Préstamo evaluado hoy con las cuotas indicadas (vencimientos y estados). */
    private static Evaluacion prestamo(String estadoPrestamo, Object... venceYEstado) {
        List<CuotaGuardada> cuotas = new ArrayList<>();
        for (int i = 0; i < venceYEstado.length; i += 2) {
            cuotas.add(cuota(i / 2 + 1, (LocalDate) venceYEstado[i], (String) venceYEstado[i + 1]));
        }
        return EvaluadorCartera.evaluar(estadoPrestamo, cuotas, HOY);
    }

    private static String estado(Evaluacion... prestamos) {
        return EstadoCliente.de(List.of(prestamos), HOY);
    }

    @Test
    void sin_prestamos_es_activo() {
        assertEquals(EstadoCliente.ACTIVO, EstadoCliente.de(List.of(), HOY));
    }

    @Test
    void con_cuotas_futuras_pendientes_es_activo() {
        assertEquals(EstadoCliente.ACTIVO, estado(prestamo("Vigente", HOY.plusMonths(1), "PENDIENTE")));
    }

    @Test
    void la_cuota_que_vence_hoy_aun_no_es_mora() {
        assertEquals(EstadoCliente.ACTIVO, estado(prestamo("Vigente", HOY, "PENDIENTE")));
    }

    @Test
    void con_una_cuota_vencida_ayer_es_moroso() {
        assertEquals(EstadoCliente.MOROSO, estado(prestamo("Vigente", HOY.minusDays(1), "PENDIENTE")));
    }

    @Test
    void la_vencida_se_deriva_de_la_fecha_aunque_la_bd_diga_pendiente_y_pagada_no_cuenta() {
        assertEquals(EstadoCliente.ACTIVO, estado(prestamo("Vigente", HOY.minusMonths(3), "PAGADA",
                HOY.plusMonths(1), "PENDIENTE")));
    }

    @Test
    void una_deuda_vencida_no_se_ignora_por_tener_otros_prestamos_al_dia() {
        assertEquals(EstadoCliente.MOROSO, estado(
                prestamo("Vigente", HOY.plusMonths(1), "PENDIENTE"),
                prestamo("Vigente", HOY.minusDays(10), "PENDIENTE")));
    }

    @Test
    void un_prestamo_cancelado_no_genera_mora() {
        assertEquals(EstadoCliente.ACTIVO, estado(prestamo("Cancelado", HOY.minusYears(2), "PENDIENTE")));
    }

    @Test
    void justo_al_cumplir_un_anio_desde_la_primera_impaga_es_extrajudicial() {
        assertEquals(EstadoCliente.EXTRAJUDICIAL, estado(prestamo("Vigente", HOY.minusYears(1), "VENCIDA")));
    }

    @Test
    void un_dia_antes_del_anio_sigue_moroso() {
        assertEquals(EstadoCliente.MOROSO, estado(prestamo("Vigente", HOY.minusYears(1).plusDays(1), "VENCIDA")));
    }

    @Test
    void se_mide_desde_la_primera_cuota_impaga_de_todos_sus_prestamos() {
        assertEquals(EstadoCliente.EXTRAJUDICIAL, estado(
                prestamo("Vigente", HOY.minusDays(5), "PENDIENTE"),
                prestamo("En mora", HOY.minusMonths(14), "PENDIENTE", HOY.minusMonths(13), "PENDIENTE")));
    }

    @Test
    void si_se_paga_la_cuota_mas_antigua_pero_quedan_vencidas_baja_a_moroso() {
        // Antes: primera impaga hace 14 meses (EXTRAJUDICIAL). Al figurar PAGADA, la primera impaga es la de hace 2.
        assertEquals(EstadoCliente.MOROSO, estado(prestamo("En mora",
                HOY.minusMonths(14), "PAGADA", HOY.minusMonths(2), "PENDIENTE")));
    }

    @Test
    void si_ya_no_quedan_vencidas_impagas_vuelve_a_activo() {
        assertEquals(EstadoCliente.ACTIVO, estado(prestamo("En mora",
                HOY.minusMonths(14), "PAGADA", HOY.minusMonths(13), "PAGADA", HOY.plusMonths(1), "PENDIENTE")));
    }

    @Test
    void anio_bisiesto_29_de_febrero_cumple_el_anio_el_28_de_febrero() {
        LocalDate vence = LocalDate.of(2024, 2, 29);
        List<Evaluacion> p = List.of(EvaluadorCartera.evaluar("Vigente", List.of(cuota(1, vence, "PENDIENTE")),
                LocalDate.of(2025, 2, 28)));
        assertEquals(EstadoCliente.EXTRAJUDICIAL, EstadoCliente.de(p, LocalDate.of(2025, 2, 28)));
        List<Evaluacion> antes = List.of(EvaluadorCartera.evaluar("Vigente", List.of(cuota(1, vence, "PENDIENTE")),
                LocalDate.of(2025, 2, 27)));
        assertEquals(EstadoCliente.MOROSO, EstadoCliente.de(antes, LocalDate.of(2025, 2, 27)));
    }

    @Test
    void solo_activo_permite_un_prestamo_nuevo() {
        assertTrue(EstadoCliente.permiteNuevoPrestamo(EstadoCliente.ACTIVO));
        assertFalse(EstadoCliente.permiteNuevoPrestamo(EstadoCliente.MOROSO));
        assertFalse(EstadoCliente.permiteNuevoPrestamo(EstadoCliente.EXTRAJUDICIAL));
        assertFalse(EstadoCliente.permiteNuevoPrestamo(null));
    }
}
