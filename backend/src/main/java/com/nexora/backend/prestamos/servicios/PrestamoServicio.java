package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.cuotas.entidades.Cuota;
import com.nexora.backend.cuotas.repositorios.CuotaRepositorio;
import com.nexora.backend.prestamos.dominio.CalculadoraCronograma;
import com.nexora.backend.prestamos.dominio.CapacidadEndeudamiento;
import com.nexora.backend.prestamos.dominio.Cronograma;
import com.nexora.backend.prestamos.dominio.EstadoCliente;
import com.nexora.backend.prestamos.dominio.ReglasPrestamo;
import com.nexora.backend.prestamos.dto.PrestamoRespuesta;
import com.nexora.backend.prestamos.dto.CondicionesRespuesta;
import com.nexora.backend.prestamos.dto.SimulacionRespuesta;
import com.nexora.backend.prestamos.dto.SolicitudPrestamo;
import com.nexora.backend.prestamos.dto.SolicitudSimulacion;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-04 (registro), US-05 (límite acumulado) y simulación del cronograma. Las consultas (listado, detalle) viven en
 * PrestamoConsultaServicio. Simulación y registro usan la MISMA calculadora, la misma TEA y la misma fecha de Lima.
 */
@Service
public class PrestamoServicio {

    private static final int MAX_OBSERVACIONES = 500;

    private final PrestamoRepositorio prestamos;
    private final CuotaRepositorio cuotas;
    private final ClienteResumenRepositorio clientes;
    private final PrestamoConsultaServicio consultas;
    private final EstadoClienteServicio estados;
    private final Clock reloj;

    public PrestamoServicio(PrestamoRepositorio prestamos, CuotaRepositorio cuotas,
                            ClienteResumenRepositorio clientes, PrestamoConsultaServicio consultas,
                            EstadoClienteServicio estados, Clock reloj) {
        this.prestamos = prestamos;
        this.cuotas = cuotas;
        this.clientes = clientes;
        this.consultas = consultas;
        this.estados = estados;
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

        // Bloquea al cliente hasta el final de la transacción: si otro asesor registra para el mismo cliente,
        // espera aquí y luego lee la deuda ya actualizada (concurrencia del límite).
        ClienteResumen cliente = clientes.buscarBloqueando(solicitud.clienteId())
                .orElseThrow(() -> new PrestamoException(Codigo.CLIENTE_NO_ENCONTRADO,
                        "El cliente indicado no existe."));
        validarClienteApto(cliente);
        verificarLimite(cliente.getId(), capital);

        // Fecha del día en Perú: el préstamo se registra cuando el cliente está en agencia.
        LocalDate hoy = LocalDate.now(reloj);
        Cronograma cronograma = CalculadoraCronograma.calcular(capital, plazo, ReglasPrestamo.TEA, hoy);
        verificarLoRevisado(solicitud, hoy, cronograma);

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

    /** Condiciones para una solicitud nueva: lo que el formulario muestra antes de que haya monto o plazo. */
    public CondicionesRespuesta condiciones() {
        LocalDate hoy = LocalDate.now(reloj);
        return new CondicionesRespuesta(ReglasPrestamo.MONEDA, ReglasPrestamo.TEA, ReglasPrestamo.CAPITAL_MINIMO,
                ReglasPrestamo.LIMITE_ENDEUDAMIENTO, ReglasPrestamo.PLAZO_MINIMO_MESES,
                ReglasPrestamo.PLAZO_MAXIMO_MESES, reloj.getZone().getId(), hoy, hoy.plusMonths(1));
    }

    /** Calcula el cronograma que se guardaría hoy. No lee ni escribe en la base de datos. */
    public SimulacionRespuesta simular(SolicitudSimulacion solicitud) {
        if (solicitud == null) {
            throw new PrestamoException(Codigo.DATOS_INVALIDOS, "Indica el capital y el plazo.");
        }
        BigDecimal capital = validarCapital(solicitud.capital());
        int plazo = validarPlazo(solicitud.plazoMeses());
        LocalDate hoy = LocalDate.now(reloj);
        Cronograma c = CalculadoraCronograma.calcular(capital, plazo, ReglasPrestamo.TEA, hoy);
        List<PrestamoRespuesta.CuotaRespuesta> filas = c.cuotas().stream()
                .map(q -> new PrestamoRespuesta.CuotaRespuesta(q.numero(), q.fechaVencimiento(), q.capital(),
                        q.interes(), q.importeCuota(), q.saldo()))
                .toList();
        return new SimulacionRespuesta(ReglasPrestamo.MONEDA, capital, plazo, ReglasPrestamo.TEA, hoy,
                filas.get(0).fechaVencimiento(), c.cuotaMensual(), c.totalIntereses(), c.totalContractual(), filas);
    }

    // ---------------------------------------------------------------- validaciones

    /** Si el asesor envió lo que revisó y el servidor calcula otra cosa, no se guarda nada distinto de lo revisado. */
    private static void verificarLoRevisado(SolicitudPrestamo solicitud, LocalDate hoy, Cronograma cronograma) {
        boolean otraFecha = solicitud.fechaDesembolsoEsperada() != null
                && !solicitud.fechaDesembolsoEsperada().equals(hoy);
        boolean otroTotal = solicitud.totalContractualEsperado() != null
                && solicitud.totalContractualEsperado().compareTo(cronograma.totalContractual()) != 0;
        if (otraFecha || otroTotal) {
            throw new PrestamoException(Codigo.CONDICIONES_DESACTUALIZADAS,
                    "Las condiciones cambiaron desde que las revisaste (fecha de desembolso o importes). "
                            + "Revisa el cronograma actualizado y vuelve a confirmar.");
        }
    }

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
     * Solo un cliente ACTIVO recibe préstamos nuevos: MOROSO y EXTRAJUDICIAL se rechazan aunque la petición llegue
     * directo a la API. El estado se recalcula aquí con las cuotas guardadas (nunca se confía en el valor guardado ni en
     * el navegador) y queda guardado. Si es ACTIVO sigue siéndolo tras el registro: las cuotas nuevas vencen a futuro.
     * La regla SUNAT para RUC (PQ-09) sigue pendiente de definir con el equipo.
     */
    private void validarClienteApto(ClienteResumen cliente) {
        String estado = estados.actualizar(cliente.getId());
        if (!EstadoCliente.permiteNuevoPrestamo(estado)) {
            throw new PrestamoException(Codigo.CLIENTE_NO_APTO,
                    "El cliente está en estado " + estado + ": tiene cuotas vencidas sin pagar y no puede solicitar "
                            + "nuevos préstamos.",
                    Map.of("estado", estado));
        }
    }

    /**
     * US-05: el monto no puede superar la capacidad disponible del cliente en toda la empresa. Se calcula aquí, con el
     * cliente bloqueado, con la misma fórmula que muestran el perfil y el formulario; nunca se usa un valor del navegador.
     */
    private void verificarLimite(UUID clienteId, BigDecimal nuevoCapital) {
        CapacidadEndeudamiento capacidad = consultas.capacidad(clienteId);
        if (capacidad.permite(nuevoCapital)) {
            return;
        }
        BigDecimal acumulado = capacidad.capitalPendiente();
        BigDecimal limite = capacidad.limite();
        BigDecimal excedente = acumulado.add(nuevoCapital).subtract(limite);
        String mensaje = capacidad.alcanzaElMinimo()
                ? "El monto supera la capacidad disponible del cliente (" + soles(capacidad.disponible()) + "). "
                        + "Capital pendiente: " + soles(acumulado) + "; excedente: " + soles(excedente) + "."
                : "El cliente no tiene capacidad suficiente para un préstamo nuevo: dispone de "
                        + soles(capacidad.disponible()) + " y el mínimo es " + soles(ReglasPrestamo.CAPITAL_MINIMO) + ".";
        throw new PrestamoException(Codigo.LIMITE_EXCEDIDO, mensaje,
                Map.of("acumulado", acumulado, "limite", limite, "excedente", excedente,
                        "disponible", capacidad.disponible()));
    }

    private static String soles(BigDecimal importe) {
        return String.format(Locale.US, "S/ %,.2f", importe);
    }
}