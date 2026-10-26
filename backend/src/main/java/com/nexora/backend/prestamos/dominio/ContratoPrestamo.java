package com.nexora.backend.prestamos.dominio;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Instantánea del contrato de un préstamo. Lógica pura, sin Spring ni BD.
 *
 * <p>Es el texto JSON que se guarda en {@code contratos_prestamo.datos} y del que se dibuja el PDF: contiene TODO lo que el
 * contrato dice (partes, condiciones, cronograma, versión de plantilla), así que un contrato guardado jamás se recalcula
 * con otras tasas, fechas o datos del cliente. El borrador que se ve antes de confirmar se arma con este mismo método y
 * los mismos datos que se guardarán, por eso no puede diferir del definitivo salvo en estado, código y hora.
 *
 * <p>Solo contiene lo que el sistema sabe. Lo que NO está definido (mora, penalidades, pagos anticipados, garantías,
 * datos del prestamista sin configurar) no se inventa: figura en {@link Datos#noDefinido()} para que el documento lo
 * declare y un abogado lo complete. El sistema no tiene firma electrónica: el documento solo prevé firmas manuscritas.
 */
public final class ContratoPrestamo {

    /** Versión del texto del contrato. Si la redacción cambia, se sube: los contratos viejos siguen con la suya. */
    public static final String PLANTILLA_VERSION = "CONTRATO-MUTUO-1.0";

    public static final String ESTADO_BORRADOR = "BORRADOR";
    public static final String ESTADO_DEFINITIVO = "DEFINITIVO";

    /** Cómo se calculan los intereses: lo que hace CalculadoraCronograma, ni más ni menos. */
    static final String MODALIDAD_TASA = "Tasa efectiva anual (TEA) fija. El interés de cada cuota se calcula sobre el saldo "
            + "de capital con la tasa efectiva mensual equivalente, TEM = (1 + TEA)^(1/12) - 1, en cuotas iguales "
            + "(sistema francés); la última cuota ajusta el redondeo.";

    static final String FRECUENCIA_PAGO = "Mensual: una cuota cada 30 días contados desde el desembolso "
            + "(el día del desembolso cuenta como día 1).";

    /** Importes en notación plana (1000.00, nunca 1E+3). Sin módulos: todas las fechas del contrato ya son texto ISO. */
    private static final ObjectMapper JSON = JsonMapper.builder()
            .configure(JsonGenerator.Feature.WRITE_BIGDECIMAL_AS_PLAIN, true)
            .build();

    private ContratoPrestamo() {
    }

    /** Partes y lugar: datos reales del cliente, la agencia y el asesor, leídos de la BD en el momento del contrato. */
    public record Origen(
            String clienteNombre,
            String clienteTipoDocumento,
            String clienteNumeroDocumento,
            String clienteTelefono,
            String clienteCorreo,
            String clienteDniTitular,
            String clienteDomicilio,
            String representanteNombre,
            String representanteDni,
            String agenciaNombre,
            String departamento,
            String provincia,
            String distrito,
            String direccionAgencia,
            String asesorNombre) { }

    /** Quien presta. Cualquier dato sin configurar queda null: no se inventa (RUC, domicilio, representante). */
    public record Prestamista(String denominacion, String ruc, String domicilio, String representante) { }

    public record Prestatario(
            String nombre,
            String tipoDocumento,
            String numeroDocumento,
            String telefono,
            String correo,
            String dniTitular,
            String domicilio,
            String representanteNombre,
            String representanteDni) { }

    public record Condiciones(
            String moneda,
            BigDecimal capital,
            int plazoMeses,
            BigDecimal tea,
            String modalidadTasa,
            String frecuenciaPago,
            String fechaDesembolso,
            String fechaPrimerVencimiento,
            String fechaUltimoVencimiento,
            BigDecimal cuotaMensual,
            BigDecimal totalIntereses,
            BigDecimal totalContractual,
            String observaciones) { }

    public record Cuota(
            int numero,
            String fechaVencimiento,
            BigDecimal capital,
            BigDecimal interes,
            BigDecimal importeCuota,
            BigDecimal saldo) { }

    public record Datos(
            String plantillaVersion,
            /** BORRADOR (antes de confirmar) o DEFINITIVO (guardado con el préstamo). */
            String estado,
            /** PR-1001. Null en el borrador: el número lo asigna la BD al registrar. */
            String codigo,
            Long numero,
            /** ISO-8601 con la zona de Lima, al segundo. */
            String generadoEn,
            String lugarCelebracion,
            String fechaCelebracion,
            String agencia,
            String asesor,
            Prestamista prestamista,
            Prestatario prestatario,
            Condiciones condiciones,
            List<Cuota> cronograma,
            List<String> noDefinido) { }

    /**
     * @param estado         BORRADOR o DEFINITIVO
     * @param numero         número del préstamo (null mientras es borrador)
     * @param generadoEn     momento en la zona de Lima
     * @param fechaCelebracion  el día en que se registra el préstamo = su fecha de desembolso
     */
    public static Datos construir(String estado, Long numero, ZonedDateTime generadoEn, Origen o, Prestamista prestamista,
                                  BigDecimal capital, int plazoMeses, BigDecimal tea, LocalDate fechaDesembolso,
                                  String observaciones, Cronograma cronograma) {
        List<Cuota> cuotas = cronograma.cuotas().stream()
                .map(q -> new Cuota(q.numero(), q.fechaVencimiento().toString(), q.capital(), q.interes(),
                        q.importeCuota(), q.saldo()))
                .toList();
        Cuota primera = cuotas.get(0);
        Cuota ultima = cuotas.get(cuotas.size() - 1);

        Condiciones condiciones = new Condiciones(ReglasPrestamo.MONEDA, capital, plazoMeses, tea, MODALIDAD_TASA,
                FRECUENCIA_PAGO, fechaDesembolso.toString(), primera.fechaVencimiento(), ultima.fechaVencimiento(),
                cronograma.cuotaMensual(), cronograma.totalIntereses(), cronograma.totalContractual(), observaciones);

        Prestatario prestatario = new Prestatario(o.clienteNombre(), o.clienteTipoDocumento(), o.clienteNumeroDocumento(),
                o.clienteTelefono(), o.clienteCorreo(), o.clienteDniTitular(), o.clienteDomicilio(),
                o.representanteNombre(), o.representanteDni());

        return new Datos(PLANTILLA_VERSION, estado, numero == null ? null : "PR-" + numero, numero,
                generadoEn.toOffsetDateTime().withNano(0).format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME), lugar(o), fechaDesembolso.toString(),
                o.agenciaNombre(), o.asesorNombre(), prestamista, prestatario, condiciones, cuotas,
                noDefinido(prestamista));
    }

    /** "Piura, Piura, Piura" (distrito, provincia, departamento) de la agencia donde se otorga. Sin dato, null. */
    static String lugar(Origen o) {
        List<String> partes = new ArrayList<>();
        for (String p : new String[] { o.distrito(), o.provincia(), o.departamento() }) {
            if (p != null && !p.isBlank()) {
                partes.add(p.trim());
            }
        }
        return partes.isEmpty() ? null : String.join(", ", partes);
    }

    /** Lo que el sistema NO define. El documento lo declara; no se rellena con cláusulas inventadas. */
    static List<String> noDefinido(Prestamista p) {
        List<String> l = new ArrayList<>();
        if (p == null || vacio(p.ruc())) {
            l.add("RUC del prestamista: no está configurado en el sistema.");
        }
        if (p == null || vacio(p.domicilio())) {
            l.add("Domicilio del prestamista: no está configurado en el sistema.");
        }
        if (p == null || vacio(p.representante())) {
            l.add("Representante del prestamista: no está configurado en el sistema.");
        }
        l.add("Intereses moratorios, penalidades y comisiones: no existe una política aprobada en el sistema.");
        l.add("Pagos anticipados y cancelación anticipada: no están definidos en el sistema.");
        l.add("Garantías, fiadores y avales: el sistema no los registra.");
        l.add("Causales de resolución, ley aplicable y jurisdicción: no hay texto contractual aprobado.");
        return List.copyOf(l);
    }

    private static boolean vacio(String s) {
        return s == null || s.isBlank();
    }

    /** JSON compacto y determinista (orden de campos fijo, importes sin notación científica). Es lo que se guarda y se hashea. */
    public static String aJson(Datos datos) {
        try {
            return JSON.writeValueAsString(datos);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("No se pudo serializar el contrato.", e);
        }
    }

    /** SHA-256 en hexadecimal minúscula del texto exacto guardado (UTF-8). La BD comprueba que coincide. */
    public static String huella(String json) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible.", e);
        }
    }
}
