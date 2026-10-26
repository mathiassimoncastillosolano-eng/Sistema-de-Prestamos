package com.nexora.backend.prestamos.dominio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nexora.backend.prestamos.dominio.DeudaConsolidada.Aporte;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada.Integrante;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada.PrestamoEvaluado;
import com.nexora.backend.prestamos.dominio.DeudaConsolidada.Resultado;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.CuotaGuardada;
import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeudaConsolidadaTest {

    private static final LocalDate HOY = LocalDate.of(2026, 10, 25);
    private final UUID dni = UUID.randomUUID();
    private final UUID ruc = UUID.randomUUID();
    private final UUID ruc2 = UUID.randomUUID();
    private final UUID agenciaA = UUID.randomUUID();
    private final UUID agenciaB = UUID.randomUUID();
    private final Integrante persona = new Integrante(dni, "Ana", "DNI", "12345678", agenciaA);
    private final Integrante negocio = new Integrante(ruc, "Bodega", "RUC 10", "10123456781", agenciaB);
    private final Integrante taller = new Integrante(ruc2, "Taller", "RUC 10", "10123456782", agenciaA);

    private static BigDecimal d(String v) { return new BigDecimal(v); }

    private static Evaluacion deuda(String v) {
        return new Evaluacion("Vigente", d(v), d(v), d(v), null, 0, List.of());
    }

    private static Evaluacion prestamo(String estado, String capital, int pagadas) {
        Cronograma c = CalculadoraCronograma.calcular(d(capital), 4, ReglasPrestamo.TEA, HOY.minusDays(10));
        List<CuotaGuardada> l = new ArrayList<>();
        for (Cronograma.Cuota q : c.cuotas()) {
            l.add(new CuotaGuardada(q.numero(), q.fechaVencimiento(), q.capital(), q.interes(), q.importeCuota(), q.saldo(),
                    q.numero() <= pagadas ? "PAGADA" : "PENDIENTE"));
        }
        return EvaluadorCartera.evaluar(estado, l, HOY);
    }

    private static PrestamoEvaluado p(UUID cliente, Evaluacion e) { return new PrestamoEvaluado(UUID.randomUUID(), cliente, e); }

    @Test
    void empresaVinculadaConDeuda8000YPersonaSinDeudaDejaCapacidad2000() {
        Resultado r = DeudaConsolidada.consolidar(dni, List.of(persona, negocio), List.of(p(ruc, deuda("8000.00"))), i -> false);
        assertEquals(d("2000.00"), r.capacidad().disponible());
        assertFalse(r.capacidad().permite(d("3000")), "8,000 + 3,000 = 11,000 supera el límite");
        assertTrue(r.capacidad().permite(d("2000")));
        assertEquals(0, r.deudaPropia().signum());
        assertEquals(0, d("8000").compareTo(r.deudaVinculada()));
        assertTrue(r.capacidad().consolidada());
    }

    @Test
    void personaConDeudaPropiaYVariasEmpresasSumaSinDuplicar() {
        PrestamoEvaluado a = p(dni, deuda("1000.00"));
        PrestamoEvaluado b = p(ruc, deuda("4000.00"));
        PrestamoEvaluado c = p(ruc2, deuda("3000.00"));
        // Filas e integrantes repetidos no cuentan dos veces.
        Resultado r = DeudaConsolidada.consolidar(dni, List.of(persona, negocio, taller, persona, negocio),
                List.of(a, b, b, c, a), i -> true);
        assertEquals(d("8000.00"), r.capacidad().capitalPendiente());
        assertEquals(d("2000.00"), r.capacidad().disponible());
        assertEquals(3, r.capacidad().integrantes());
        assertEquals(3, r.aportes().size());
    }

    @Test
    void canceladosYCuotasPagadasNoCuentanComoDeuda() {
        Evaluacion cancelado = prestamo("Cancelado", "5000.00", 0);
        Evaluacion mitad = prestamo("Vigente", "4000.00", 2);
        Resultado r = DeudaConsolidada.consolidar(dni, List.of(persona, negocio),
                List.of(p(dni, cancelado), p(ruc, mitad)), i -> true);
        assertEquals(0, mitad.capitalPendiente().compareTo(r.capacidad().capitalPendiente()));
        assertTrue(mitad.capitalPendiente().compareTo(d("4000")) < 0);
        assertEquals(4 + 2, r.cuotasPagadas(), "cancelado: 4 cuotas cubiertas + 2 pagadas del vigente");
        assertEquals(2, r.cuotasVencidas() + r.cuotasPendientes());
    }

    @Test
    void deudaHistoricaSobreElLimiteMuestraLaDeudaRealYCapacidadCero() {
        Resultado r = DeudaConsolidada.consolidar(dni, List.of(persona, negocio),
                List.of(p(dni, deuda("7000.00")), p(ruc, deuda("6000.00"))), i -> true);
        assertEquals(d("13000.00"), r.capacidad().capitalPendiente());
        assertEquals(0, r.capacidad().disponible().signum());
        assertFalse(r.capacidad().alcanzaElMinimo());
    }

    @Test
    void sinPermisoNoSeVenLosContadoresNiSumanAlTotalPeroElCapitalSiSeInforma() {
        Resultado r = DeudaConsolidada.consolidar(dni, List.of(persona, negocio),
                List.of(p(ruc, prestamo("Vigente", "4000.00", 2))), i -> false);
        Aporte vinculado = r.aportes().stream().filter(a -> !a.consultado()).findFirst().orElseThrow();
        assertFalse(vinculado.detalleVisible());
        assertNull(vinculado.cuotasPendientes());
        assertTrue(vinculado.capitalPendiente().signum() > 0);
        assertEquals(0, r.cuotasPagadas());
        assertTrue(r.aportes().get(0).consultado(), "el consultado va primero");
    }

    @Test
    void rucVeinteNoSeVinculaConNadie() {
        UUID sac = UUID.randomUUID();
        Resultado r = DeudaConsolidada.consolidar(sac, List.of(new Integrante(sac, "SAC", "RUC 20", "20123456789", agenciaA)),
                List.of(), i -> false);
        assertFalse(r.capacidad().consolidada());
        assertEquals(DeudaConsolidada.RELACION_SIN_VINCULO, r.aportes().get(0).relacion());
    }

    @Test
    void relacionesPorTipoDeDocumento() {
        assertEquals(DeudaConsolidada.RELACION_TITULAR, DeudaConsolidada.relacionDe("DNI"));
        assertEquals(DeudaConsolidada.RELACION_NEGOCIO, DeudaConsolidada.relacionDe("RUC 10"));
        assertEquals(DeudaConsolidada.RELACION_SIN_VINCULO, DeudaConsolidada.relacionDe("RUC 20"));
    }
}
