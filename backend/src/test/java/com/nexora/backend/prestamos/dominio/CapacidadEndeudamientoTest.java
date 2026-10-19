package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CapacidadEndeudamientoTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 18);

    /** Cuota sencilla: 1,000 de capital y 100 de interés. */
    private static CuotaGuardada cuota(int numero, LocalDate vence, String estado) {
        return new CuotaGuardada(numero, vence, new BigDecimal("1000.00"), new BigDecimal("100.00"),
                new BigDecimal("1100.00"), BigDecimal.ZERO, estado);
    }

    /** Préstamo de 3 cuotas: una vencida, una que vence en el futuro y una que figura con el estado indicado. */
    private static Evaluacion prestamo(String estadoPrestamo, String estadoTercera) {
        return EvaluadorCartera.evaluar(estadoPrestamo, List.of(
                cuota(1, HOY.minusMonths(1), "VENCIDA"),
                cuota(2, HOY.plusMonths(1), "PENDIENTE"),
                cuota(3, HOY.plusMonths(2), estadoTercera)), HOY);
    }

    private static BigDecimal soles(String v) {
        return new BigDecimal(v);
    }

    @Test
    void sinPrestamosDisponeDeTodoElLimite() {
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of());
        assertEquals(soles("10000.00"), c.limite());
        assertEquals(soles("0.00"), c.capitalPendiente());
        assertEquals(soles("10000.00"), c.disponible());
    }

    @Test
    void prestamoCanceladoNoSumaAunqueSusCuotasSigamGuardadas() {
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(prestamo("Cancelado", "PENDIENTE")));
        assertEquals(soles("0.00"), c.capitalPendiente());
        assertEquals(soles("10000.00"), c.disponible());
    }

    @Test
    void vigenteYEnMoraCuentanPendientesYVencidasPeroNoPagadas() {
        // Cada préstamo: vencida (1,000) + pendiente (1,000) + pagada (0) = 2,000 de capital.
        for (String estado : List.of("Vigente", "En mora")) {
            CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(prestamo(estado, "PAGADA")));
            assertEquals(soles("2000.00"), c.capitalPendiente(), estado);
            assertEquals(soles("8000.00"), c.disponible(), estado);
        }
    }

    @Test
    void sumaLosPrestamosSinDuplicarCuotas() {
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(
                prestamo("Vigente", "PENDIENTE"),   // 3,000
                prestamo("En mora", "PAGADA"),      // 2,000
                prestamo("Cancelado", "PENDIENTE"))); // 0
        assertEquals(soles("5000.00"), c.capitalPendiente());
        assertEquals(soles("5500.00"), c.importePendiente());
        assertEquals(soles("5000.00"), c.disponible());
    }

    @Test
    void capitalPendienteEImporteContractualSonIndicadoresDistintos() {
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(prestamo("Vigente", "PENDIENTE")));
        assertEquals(soles("3000.00"), c.capitalPendiente());
        assertEquals(soles("3300.00"), c.importePendiente()); // incluye intereses
        assertNotEquals(c.capitalPendiente(), c.importePendiente());
        assertEquals(soles("7000.00"), c.disponible()); // el límite solo mira el capital
    }

    @Test
    void estadosDesconocidosCuentanComoDeudaNuncaComoPagado() {
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(prestamo("Refinanciado", "ANULADA")));
        assertEquals(soles("3000.00"), c.capitalPendiente());
    }

    @Test
    void activoConTodasSusCuotasPagadasNoInventaDeuda() {
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", List.of(
                cuota(1, HOY.minusMonths(1), "PAGADA"), cuota(2, HOY.plusMonths(1), "PAGADA")), HOY);
        assertEquals(soles("0.00"), CapacidadEndeudamiento.de(List.of(e)).capitalPendiente());
    }

    @Test
    void ejemploDelPerfil6261_71() {
        BigDecimal pendiente = soles("3738.29");
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(
                new Evaluacion("Vigente", pendiente, pendiente, soles("5658.04"), null, 0, List.of())));
        assertEquals(soles("6261.71"), c.disponible());
        assertTrue(c.permite(soles("6261.71")));
        assertFalse(c.permite(soles("6261.72")));
        assertTrue(c.alcanzaElMinimo());
    }

    @Test
    void elDisponibleNuncaEsNegativoYSinMinimoNoAlcanza() {
        BigDecimal excedido = soles("10500.00");
        CapacidadEndeudamiento c = CapacidadEndeudamiento.de(List.of(
                new Evaluacion("Vigente", excedido, excedido, excedido, null, 0, List.of())));
        assertEquals(soles("0.00"), c.disponible());
        assertFalse(c.permite(soles("1000.00")));
        assertFalse(c.alcanzaElMinimo());
    }
}
