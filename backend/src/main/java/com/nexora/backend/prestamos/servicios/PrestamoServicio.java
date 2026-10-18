package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.cuotas.entidades.Cuota;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dominio.CalculadoraCronograma;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dominio.ReglasPrestamo;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.entidades.ClienteResumen;
import com.nexora.backend.prestamos.entidades.Prestamo;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.excepciones.PrestamoException.Codigo;
import com.nexora.backend.prestamos.repositorios.ClienteResumenRepositorio;
import com.nexora.backend.prestamos.repositorios.PrestamoRepositorio;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** US-04 (registro), US-05 (límite acumulado) y US-06 (cronograma), en una sola transacción atómica. */
@Service
public class PrestamoServicio {

    private static final int MAX_OBSERVACIONES = 500;

    private final PrestamoRepositorio prestamos;
    private final CuotaRepositorio cuotas;
    private final ClienteResumenRepositorio clientes;
    private final Clock reloj;

    public PrestamoServicio(PrestamoRepositorio prestamos, CuotaRepositorio cuotas,
                            ClienteResumenRepositorio clientes, Clock reloj) {
        this.prestamos = prestamos;
        this.cuotas = cuotas;
        this.clientes = clientes;
        this.reloj = reloj;
    }

    /**
     * Si cualquier paso lanza una excepción, la transacción se revierte: no queda ni el préstamo
     * ni sus cuotas (BR-PRE-08).
     */
    @Transactional
    public PrestamoRespuesta registrar(Perfil asesor, SolicitudPrestamo solicitud) {
        if (asesor == null || !"asesor".equals(asesor.getRol()) || asesor.getAgencia() == null) {
            throw new PrestamoException(Codigo.SIN_PERMISO,
                    "Solo un asesor con agencia asignada puede registrar préstamos.");
        }
        if (solicitud == null || solicitud.clienteId() == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "Indica el cliente del préstamo.");
        }

        BigDecimal capital = validarCapital(solicitud.capital());
        int plazo = validarPlazo(solicitud.plazoMeses());
        validarMoneda(solicitud.moneda());
        String observaciones = normalizarObservaciones(solicitud.observaciones());

        // Bloquea al cliente hasta el final de la transacción (concurrencia del límite).
        ClienteResumen cliente = clientes.buscarBloqueando(solicitud.clienteId())
                .orElseThrow(() -> new PrestamoException(Codigo.CLIENTE_NO_ENCONTRADO,
                        "El cliente indicado no existe."));
        validarClienteApto(cliente);
        verificarLimite(cliente.getId(), capital);

        // Fecha del día en Perú: el préstamo se registra cuando el cliente está en agencia.
        LocalDate hoy = LocalDate.now(reloj);
        Cronograma cronograma = CalculadoraCronograma.calcular(capital, plazo, ReglasPrestamo.TEA, hoy);

        Prestamo prestamo = prestamos.save(new Prestamo(
                cliente.getId(), asesor.getAgencia().getId(), asesor.getId(),
                capital, plazo, ReglasPrestamo.TEA, hoy, observaciones));

        UUID prestamoId = prestamo.getId();
        cuotas.saveAll(cronograma.cuotas().stream()
                .map(c -> Cuota.desde(prestamoId, c))
                .toList());

        Long numero = prestamos.obtenerNumero(prestamoId);
        return PrestamoRespuesta.de(prestamo, numero, cronograma);
    }
    
    /**
     * Consulta de un préstamo con su cronograma guardado. Devuelve el mismo formato que el registro,
     * reconstruido solo con lo que hay en la BD (nada se recalcula, para que los importes sean idénticos).
     */
    @Transactional(readOnly = true)
    public PrestamoRespuesta consultar(UUID id) {
        Prestamo prestamo = prestamos.findById(id)
                .orElseThrow(() -> new PrestamoException(Codigo.PRESTAMO_NO_ENCONTRADO,
                        "El préstamo indicado no existe."));

        List<Cronograma.Cuota> filas = cuotas.findByIdPrestamoIdOrderByIdNumeroAsc(id).stream()
                .map(q -> new Cronograma.Cuota(q.getId().getNumero(), q.getFechaVencimiento(),
                        q.getCapital(), q.getInteres(), q.getImporteCuota(), q.getSaldo()))
                .toList();
        if (filas.isEmpty()) {
            throw new IllegalStateException("El préstamo no tiene cronograma guardado.");
        }

        BigDecimal totalIntereses = filas.stream().map(Cronograma.Cuota::interes)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalContractual = filas.stream().map(Cronograma.Cuota::importeCuota)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Todas las cuotas valen lo mismo salvo la última, que absorbe el redondeo: la primera es la cuota fija.
        Cronograma cronograma = new Cronograma(filas, filas.get(0).importeCuota(), totalIntereses, totalContractual);

        return PrestamoRespuesta.de(prestamo, prestamo.getNumero(), cronograma);
    }

    // ---------------------------------------------------------------- validaciones

    private static BigDecimal validarCapital(BigDecimal capital) {
        if (capital == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "El capital es obligatorio.");
        }
        if (capital.stripTrailingZeros().scale() > 2) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS,
                    "El capital admite como máximo 2 decimales.");
        }
        BigDecimal normalizado = capital.setScale(2, RoundingMode.UNNECESSARY);
        if (normalizado.compareTo(ReglasPrestamo.CAPITAL_MINIMO) < 0) {
            throw new PrestamoException(Codigo.CAPITAL_BAJO_MINIMO,
                    "El capital mínimo del préstamo es " + soles(ReglasPrestamo.CAPITAL_MINIMO) + ".");
        }
        return normalizado;
    }

    private static int validarPlazo(Integer plazo) {
        if (plazo == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "El plazo es obligatorio.");
        }
        if (plazo < ReglasPrestamo.PLAZO_MINIMO_MESES || plazo > ReglasPrestamo.PLAZO_MAXIMO_MESES) {
            throw new PrestamoException(Codigo.PLAZO_FUERA_DE_RANGO,
                    "El plazo debe estar entre " + ReglasPrestamo.PLAZO_MINIMO_MESES + " y "
                            + ReglasPrestamo.PLAZO_MAXIMO_MESES + " meses.");
        }
        return plazo;
    }

    private static void validarMoneda(String moneda) {
        if (moneda != null && !moneda.isBlank()
                && !ReglasPrestamo.MONEDA.equalsIgnoreCase(moneda.trim())) {
            throw new PrestamoException(Codigo.MONEDA_NO_PERMITIDA,
                    "Solo se permiten préstamos en soles (PEN).");
        }
    }

    private static String normalizarObservaciones(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String limpio = texto.trim();
        if (limpio.length() > MAX_OBSERVACIONES) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS,
                    "Las observaciones no pueden superar " + MAX_OBSERVACIONES + " caracteres.");
        }
        return limpio;
    }

    /**
     * PENDIENTE de definir con el equipo (PQ-09): hoy ya no existe estado_validacion en clientes.
     * Por ahora basta con que el cliente exista. Si se decide exigir estado/condición SUNAT
     * favorable para RUC, este es el único lugar a cambiar.
     */
    private static void validarClienteApto(ClienteResumen cliente) {
        // sin restricciones adicionales por ahora
    }

    /** US-05: acumulado del cliente en toda la empresa + nuevo capital no puede superar S/ 10,000. */
    private void verificarLimite(UUID clienteId, BigDecimal nuevoCapital) {
        BigDecimal acumulado = prestamos.sumarCapitalActivo(clienteId)
                .orElse(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = acumulado.add(nuevoCapital);
        BigDecimal limite = ReglasPrestamo.LIMITE_ENDEUDAMIENTO;

        if (total.compareTo(limite) > 0) {
            BigDecimal excedente = total.subtract(limite);
            throw new PrestamoException(Codigo.LIMITE_EXCEDIDO,
                    "El cliente superaría el límite de " + soles(limite) + ". Acumulado actual: "
                            + soles(acumulado) + "; excedente: " + soles(excedente) + ".",
                    Map.of("acumulado", acumulado, "limite", limite, "excedente", excedente));
        }
    }

    private static String soles(BigDecimal importe) {
        return String.format(Locale.US, "S/ %,.2f", importe);
    }
}