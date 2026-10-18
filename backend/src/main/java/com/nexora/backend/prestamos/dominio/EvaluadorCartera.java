package com.nexora.backend.prestamos.dominio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * ÚNICA fuente de los estados de cuota y de préstamo y de los saldos pendientes.
 * Lógica pura (sin Spring ni BD): el listado, el detalle y el resumen por cliente la usan, así que no pueden discrepar.
 *
 * <p>Esquema real: {@code cuotas.estado} ∈ {PENDIENTE, PAGADA, VENCIDA} y {@code prestamos.estado} ∈ {Vigente, En mora, Cancelado}.
 * No existe tabla de pagos: lo único que dice que una cuota está cubierta es {@code cuotas.estado = 'PAGADA'}.
 *
 * <ul>
 *   <li>Cuota PAGADA: así figura en la BD. Nunca se deduce del calendario.</li>
 *   <li>Cuota VENCIDA: no pagada y con vencimiento anterior a la fecha de negocio (America/Lima).</li>
 *   <li>Cuota PENDIENTE: no pagada y con vencimiento hoy o futuro.</li>
 *   <li>Préstamo Cancelado: figura así en la BD o todas sus cuotas están PAGADA.</li>
 *   <li>Préstamo En mora: no cancelado y con al menos una cuota VENCIDA. En otro caso, Vigente.</li>
 * </ul>
 * El estado se DERIVA al leer; consultar una pantalla no escribe nada en la base.
 */
public final class EvaluadorCartera {

    public static final String CUOTA_PENDIENTE = "PENDIENTE";
    public static final String CUOTA_PAGADA = "PAGADA";
    public static final String CUOTA_VENCIDA = "VENCIDA";

    public static final String PRESTAMO_VIGENTE = "Vigente";
    public static final String PRESTAMO_EN_MORA = "En mora";
    public static final String PRESTAMO_CANCELADO = "Cancelado";

    private static final BigDecimal CERO = new BigDecimal("0.00");

    private EvaluadorCartera() {
    }

    /** Cuota tal como está guardada. */
    public record CuotaGuardada(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo,
            String estadoGuardado) { }

    /** Cuota con su estado efectivo y lo que queda por pagar de ella. */
    public record CuotaEvaluada(
            int numero,
            LocalDate fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo,
            String estado,
            BigDecimal importePendiente,
            long diasAtraso) { }

    public record Evaluacion(
            String estado,
            BigDecimal totalContractual,
            BigDecimal capitalPendiente,
            BigDecimal totalPendiente,
            LocalDate proximoVencimiento,
            int cuotasVencidas,
            List<CuotaEvaluada> cuotas) { }

    public static String estadoCuota(String estadoGuardado, LocalDate vencimiento, LocalDate hoy) {
        if (CUOTA_PAGADA.equals(estadoGuardado)) {
            return CUOTA_PAGADA;
        }
        return vencimiento.isBefore(hoy) ? CUOTA_VENCIDA : CUOTA_PENDIENTE;
    }

    public static Evaluacion evaluar(String estadoPrestamoGuardado, List<CuotaGuardada> guardadas, LocalDate hoy) {
        List<CuotaEvaluada> cuotas = new ArrayList<>(guardadas.size());
        BigDecimal total = CERO;
        BigDecimal capitalAbierto = CERO;
        BigDecimal importeAbierto = CERO;
        LocalDate proximo = null;
        int vencidas = 0;
        int pagadas = 0;

        for (CuotaGuardada g : guardadas) {
            String estado = estadoCuota(g.estadoGuardado(), g.fechaVencimiento(), hoy);
            boolean pagada = CUOTA_PAGADA.equals(estado);
            boolean vencida = CUOTA_VENCIDA.equals(estado);
            long atraso = vencida ? ChronoUnit.DAYS.between(g.fechaVencimiento(), hoy) : 0L;
            cuotas.add(new CuotaEvaluada(g.numero(), g.fechaVencimiento(), g.capital(), g.interes(),
                    g.importeCuota(), g.saldo(), estado, pagada ? CERO : g.importeCuota(), atraso));

            total = total.add(g.importeCuota());
            if (pagada) {
                pagadas++;
            } else {
                capitalAbierto = capitalAbierto.add(g.capital());
                importeAbierto = importeAbierto.add(g.importeCuota());
                if (proximo == null) {
                    proximo = g.fechaVencimiento();
                }
                if (vencida) {
                    vencidas++;
                }
            }
        }

        boolean cancelado = PRESTAMO_CANCELADO.equals(estadoPrestamoGuardado)
                || (!guardadas.isEmpty() && pagadas == guardadas.size());
        if (cancelado) {
            return new Evaluacion(PRESTAMO_CANCELADO, total, CERO, CERO, null, 0, List.copyOf(cuotas));
        }
        String estado = vencidas > 0 ? PRESTAMO_EN_MORA : PRESTAMO_VIGENTE;
        return new Evaluacion(estado, total, capitalAbierto, importeAbierto, proximo, vencidas, List.copyOf(cuotas));
    }
}
