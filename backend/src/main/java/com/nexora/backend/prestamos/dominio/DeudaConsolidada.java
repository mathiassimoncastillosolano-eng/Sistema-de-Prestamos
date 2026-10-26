package com.nexora.backend.prestamos.dominio;

import com.nexora.backend.prestamos.dominio.EvaluadorCartera.Evaluacion;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * Consolidación del endeudamiento entre una persona natural (DNI) y sus negocios (RUC 10). Lógica pura, sin Spring ni BD.
 *
 * <p>QUIÉNES forman el grupo lo decide la BD (ver GrupoCrediticioSql); aquí solo se SUMA. La suma usa la misma fórmula de
 * siempre ({@link CapacidadEndeudamiento}): un préstamo Cancelado aporta 0 y de los demás solo cuentan las cuotas no
 * PAGADA. Para el límite cuenta el capital; los intereses solo se informan.
 *
 * <p>Sin duplicados por construcción: cada integrante cuenta una vez (por id de cliente) y cada préstamo cuenta una vez
 * (por id de préstamo), aunque las listas de entrada repitan filas. Una cuota solo pertenece a un préstamo y un
 * préstamo solo a un cliente, así que no hay otra vía de doble conteo.
 */
public final class DeudaConsolidada {

    /** Persona natural (DNI): titular de sus negocios. */
    public static final String RELACION_TITULAR = "TITULAR";
    /** RUC 10 cuyo dni_titular es el DNI del grupo. */
    public static final String RELACION_NEGOCIO = "NEGOCIO_DEL_TITULAR";
    /** RUC 20: no se vincula con nadie (el representante legal no es necesariamente propietario). */
    public static final String RELACION_SIN_VINCULO = "SIN_VINCULO";

    private static final BigDecimal CERO = new BigDecimal("0.00");

    private DeudaConsolidada() {
    }

    public record Integrante(UUID clienteId, String nombre, String tipoDocumento, String numeroDocumento, UUID agenciaId) { }

    /** Un préstamo ya evaluado por EvaluadorCartera, con el cliente al que pertenece. */
    public record PrestamoEvaluado(UUID prestamoId, UUID clienteId, Evaluacion evaluacion) { }

    /**
     * Lo que aporta un integrante. Si el usuario no puede ver su detalle, los contadores de cuotas son null: el capital
     * pendiente sí se informa porque explica el límite del cliente consultado.
     */
    public record Aporte(
            Integrante integrante,
            String relacion,
            boolean consultado,
            boolean detalleVisible,
            BigDecimal capitalPendiente,
            BigDecimal importePendiente,
            int prestamosConSaldo,
            Integer cuotasPendientes,
            Integer cuotasVencidas,
            Integer cuotasPagadas) { }

    public record Resultado(
            CapacidadEndeudamiento capacidad,
            BigDecimal deudaPropia,
            BigDecimal deudaVinculada,
            int cuotasPendientes,
            int cuotasVencidas,
            int cuotasPagadas,
            List<Aporte> aportes) { }

    public static String relacionDe(String tipoDocumento) {
        if ("DNI".equals(tipoDocumento)) {
            return RELACION_TITULAR;
        }
        if ("RUC 10".equals(tipoDocumento)) {
            return RELACION_NEGOCIO;
        }
        return RELACION_SIN_VINCULO;
    }

    /**
     * @param consultadoId     cliente cuyo perfil o solicitud se evalúa
     * @param integrantes      su grupo crediticio (incluye al consultado)
     * @param prestamos        préstamos de TODOS los integrantes
     * @param puedeVerDetalle  si el usuario puede ver el detalle de cuotas de ese integrante (el consultado siempre)
     */
    public static Resultado consolidar(UUID consultadoId, List<Integrante> integrantes, List<PrestamoEvaluado> prestamos,
                                       Predicate<Integrante> puedeVerDetalle) {
        Map<UUID, Integrante> grupo = new LinkedHashMap<>();
        for (Integrante i : integrantes) {
            grupo.putIfAbsent(i.clienteId(), i);
        }

        // Cada préstamo cuenta una sola vez. Sin id (solo en pruebas) no se puede deduplicar y se cuenta tal cual.
        Map<Object, PrestamoEvaluado> unicos = new LinkedHashMap<>();
        int sinId = 0;
        for (PrestamoEvaluado p : prestamos) {
            unicos.putIfAbsent(p.prestamoId() != null ? p.prestamoId() : ("sin-id-" + sinId++), p);
        }

        List<Evaluacion> evaluaciones = new ArrayList<>(unicos.size());
        BigDecimal propia = CERO;
        for (PrestamoEvaluado p : unicos.values()) {
            evaluaciones.add(p.evaluacion());
            if (consultadoId != null && consultadoId.equals(p.clienteId())) {
                propia = propia.add(p.evaluacion().capitalPendiente());
            }
        }
        CapacidadEndeudamiento capacidad = CapacidadEndeudamiento.de(evaluaciones, grupo.size());
        BigDecimal vinculada = capacidad.capitalPendiente().subtract(propia);

        List<Aporte> aportes = new ArrayList<>(grupo.size());
        int pendientes = 0;
        int vencidas = 0;
        int pagadas = 0;
        for (Integrante i : grupo.values()) {
            BigDecimal capital = CERO;
            BigDecimal importe = CERO;
            int conSaldo = 0;
            int cPend = 0;
            int cVenc = 0;
            int cPag = 0;
            for (PrestamoEvaluado p : unicos.values()) {
                if (!i.clienteId().equals(p.clienteId())) {
                    continue;
                }
                Evaluacion e = p.evaluacion();
                capital = capital.add(e.capitalPendiente());
                importe = importe.add(e.totalPendiente());
                if (e.capitalPendiente().signum() > 0) {
                    conSaldo++;
                }
                if (EvaluadorCartera.PRESTAMO_CANCELADO.equals(e.estado())) {
                    // Préstamo cancelado: todas sus cuotas están cubiertas, aunque alguna figure aún sin marcar.
                    cPag += e.cuotas().size();
                    continue;
                }
                for (EvaluadorCartera.CuotaEvaluada q : e.cuotas()) {
                    switch (q.estado()) {
                        case EvaluadorCartera.CUOTA_PAGADA -> cPag++;
                        case EvaluadorCartera.CUOTA_VENCIDA -> cVenc++;
                        default -> cPend++;
                    }
                }
            }
            boolean consultado = i.clienteId().equals(consultadoId);
            boolean visible = consultado || (puedeVerDetalle != null && puedeVerDetalle.test(i));
            if (visible) {
                pendientes += cPend;
                vencidas += cVenc;
                pagadas += cPag;
            }
            aportes.add(new Aporte(i, relacionDe(i.tipoDocumento()), consultado, visible, capital, importe, conSaldo,
                    visible ? cPend : null, visible ? cVenc : null, visible ? cPag : null));
        }
        // El consultado primero; luego el titular (DNI) y sus negocios por nombre. Orden estable y legible.
        aportes.sort(Comparator
                .comparing((Aporte a) -> !a.consultado())
                .thenComparing(a -> !RELACION_TITULAR.equals(a.relacion()))
                .thenComparing(a -> a.integrante().nombre() == null ? "" : a.integrante().nombre(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(a -> String.valueOf(a.integrante().clienteId())));

        return new Resultado(capacidad, propia, vinculada, pendientes, vencidas, pagadas, List.copyOf(aportes));
    }
}
