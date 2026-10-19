package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class EvaluadorCarteraTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 18);

    /** Cronograma real de la calculadora; `pagadas` = números de cuota que la BD marca PAGADA. */
    private static List<CuotaGuardada> cuotas(LocalDate desembolso, int plazo, int... pagadas) {
        Cronograma c = CalculadoraCronograma.calcular(new BigDecimal("6000.00"), plazo, ReglasPrestamo.TEA, desembolso);
        List<CuotaGuardada> r = new ArrayList<>();
        for (Cronograma.Cuota q : c.cuotas()) {
            boolean pagada = false;
            for (int n : pagadas) {
                pagada |= n == q.numero();
            }
            r.add(new CuotaGuardada(q.numero(), q.fechaVencimiento(), q.capital(), q.interes(), q.importeCuota(),
                    q.saldo(), pagada ? "PAGADA" : "PENDIENTE"));
        }
        return r;
    }

    @Test
    void estadoDeCuota() {
        assertEquals("PAGADA", EvaluadorCartera.estadoCuota("PAGADA", LocalDate.of(2026, 1, 1), HOY));
        assertEquals("VENCIDA", EvaluadorCartera.estadoCuota("PENDIENTE", HOY.minusDays(1), HOY));
        assertEquals("PENDIENTE", EvaluadorCartera.estadoCuota("PENDIENTE", HOY, HOY)); // vence hoy: aún no vencida
        assertEquals("PENDIENTE", EvaluadorCartera.estadoCuota("PENDIENTE", HOY.plusDays(1), HOY));
        // una cuota con fecha pasada NO se considera pagada por eso
        assertEquals("VENCIDA", EvaluadorCartera.estadoCuota("VENCIDA", HOY.minusMonths(2), HOY));
    }

    @Test
    void prestamoNuevoEsVigenteConTodoPendiente() {
        List<CuotaGuardada> q = cuotas(HOY, 12);
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", q, HOY);

        assertEquals("Vigente", e.estado());
        assertEquals(0, new BigDecimal("6000.00").compareTo(e.capitalPendiente()));
        assertEquals(0, e.totalContractual().compareTo(e.totalPendiente()));
        assertEquals(LocalDate.of(2026, 11, 16), e.proximoVencimiento());
        assertEquals(0, e.cuotasVencidas());
    }

    @Test
    void cuotaImpagaVencidaPoneElPrestamoEnMora() {
        List<CuotaGuardada> q = cuotas(LocalDate.of(2026, 7, 13), 24, 1); // 1 pagada; 2 y 3 vencidas
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", q, HOY);

        assertEquals("En mora", e.estado());
        assertEquals(2, e.cuotasVencidas());
        assertEquals(LocalDate.of(2026, 9, 10), e.proximoVencimiento());
        assertEquals("PAGADA", e.cuotas().get(0).estado());
        assertEquals("VENCIDA", e.cuotas().get(1).estado());
        assertEquals(38L, e.cuotas().get(1).diasAtraso()); // 10-sep → 18-oct
        assertEquals("PENDIENTE", e.cuotas().get(3).estado());
        assertEquals(0L, e.cuotas().get(3).diasAtraso());
    }

    @Test
    void capitalPendienteEsElCapitalDeLasCuotasNoPagadasYNoElTotalMenosPagos() {
        List<CuotaGuardada> q = cuotas(HOY, 6, 1, 2); // las dos primeras PAGADA (aunque su fecha sea futura)
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", q, HOY);

        BigDecimal capitalAbierto = q.subList(2, 6).stream().map(CuotaGuardada::capital).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal importeAbierto = q.subList(2, 6).stream().map(CuotaGuardada::importeCuota).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, capitalAbierto.compareTo(e.capitalPendiente()));
        assertEquals(0, importeAbierto.compareTo(e.totalPendiente()));
        assertEquals(q.get(2).fechaVencimiento(), e.proximoVencimiento());
        // los intereses siguen dentro del pendiente contractual
        assertEquals(1, e.totalPendiente().compareTo(e.capitalPendiente()));
    }

    @Test
    void todasPagadasEsCancelado() {
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", cuotas(LocalDate.of(2026, 1, 5), 3, 1, 2, 3), HOY);
        assertEquals("Cancelado", e.estado());
        assertEquals(0, BigDecimal.ZERO.compareTo(e.capitalPendiente()));
        assertEquals(0, BigDecimal.ZERO.compareTo(e.totalPendiente()));
        assertNull(e.proximoVencimiento());
    }

    @Test
    void canceladoGuardadoEnLaBaseSeRespeta() {
        Evaluacion e = EvaluadorCartera.evaluar("Cancelado", cuotas(HOY, 3), HOY);
        assertEquals("Cancelado", e.estado());
        assertEquals(0, BigDecimal.ZERO.compareTo(e.totalPendiente()));
    }

    @Test
    void cuotaQueVenceHoyNoPoneEnMora() {
        // desembolso 19-sep (día 1) → la cuota 1 vence 18-oct (hoy)
        Evaluacion e = EvaluadorCartera.evaluar("Vigente", cuotas(LocalDate.of(2026, 9, 19), 6), HOY);
        assertEquals("Vigente", e.estado());
        assertEquals(HOY, e.proximoVencimiento());
    }
}
