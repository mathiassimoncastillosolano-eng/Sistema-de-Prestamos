package com.nexora.backend.caja.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.dominio.CapacidadCaja;
import com.nexora.backend.caja.dominio.CodigoHermes;
import com.nexora.backend.caja.dominio.EstadoReposicion;
import com.nexora.backend.caja.dominio.MotivoReposicion;
import com.nexora.backend.caja.dominio.ReglasCaja;
import com.nexora.backend.caja.dto.CajaDtos.AprobarReposicion;
import com.nexora.backend.caja.dto.CajaDtos.CajaContexto;
import com.nexora.backend.caja.dto.CajaDtos.DecisionTexto;
import com.nexora.backend.caja.dto.CajaDtos.Despacho;
import com.nexora.backend.caja.dto.CajaDtos.EventoLinea;
import com.nexora.backend.caja.dto.CajaDtos.NuevaIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.Recepcion;
import com.nexora.backend.caja.dto.CajaDtos.ReposicionDetalle;
import com.nexora.backend.caja.dto.CajaDtos.ResolverIncidencia;
import com.nexora.backend.caja.dto.CajaDtos.SolicitudReposicion;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import com.nexora.backend.caja.hermes.HermesNoConfigurado;
import com.nexora.backend.caja.hermes.HermesVerificador;
import com.nexora.backend.caja.hermes.ResultadoHermes;
import com.nexora.backend.caja.hermes.SolicitudHermes;
import com.nexora.backend.caja.repositorios.CajaRepositorio;
import com.nexora.backend.caja.repositorios.CajaRepositorio.CajaFila;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio.Registro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Ciclo de vida de una reposición: solicitud → (aclaración) → aprobación con Hermes → envío → recepciones → conciliación.
 *
 * <p>Reglas que NO se delegan al navegador: capacidad de caja, estados permitidos, montos, identidad y rol (siempre del
 * perfil de la sesión), idempotencia y concurrencia. Orden de bloqueos: caja → reposición.
 */
@Service
public class ReposicionServicio {

    static final Map<String, String> ETIQUETAS = Map.ofEntries(
            Map.entry("SOLICITUD_CREADA", "Solicitud creada"),
            Map.entry("OBSERVACION", "Gerencia pidió una aclaración"),
            Map.entry("RESPUESTA", "El asesor respondió la aclaración"),
            Map.entry("RECHAZO", "Solicitud rechazada"),
            Map.entry("APROBACION", "Autorización emitida"),
            Map.entry("HERMES_VERIFICADO", "Verificación Hermes aceptada"),
            Map.entry("HERMES_RECHAZADO", "Intento de verificación Hermes rechazado"),
            Map.entry("ENVIO_REGISTRADO", "Envío registrado"),
            Map.entry("RECEPCION_REGISTRADA", "Recepción registrada"),
            Map.entry("INCIDENCIA_REPORTADA", "Incidencia reportada"),
            Map.entry("INCIDENCIA_RESUELTA", "Incidencia resuelta"),
            Map.entry("REMANENTE_CERRADO", "Saldo restante cerrado"),
            Map.entry("CONCILIACION", "Conciliación finalizada"),
            Map.entry("CANCELACION", "Solicitud cancelada"));

    private static final Set<String> TIPOS_INCIDENCIA_MANUAL = Set.of("EXCEDENTE", "FALTANTE", "OTRO");
    private static final Duration TOLERANCIA_RELOJ = Duration.ofMinutes(2);

    private final ReposicionRepositorio reposiciones;
    private final CajaRepositorio cajas;
    private final CajaServicio cajasServicio;
    private final ObjectProvider<HermesVerificador> hermes;
    private final TransactionTemplate tx;
    private final Clock reloj;
    private final String secretoHuella;

    public ReposicionServicio(ReposicionRepositorio reposiciones, CajaRepositorio cajas, CajaServicio cajasServicio,
                              ObjectProvider<HermesVerificador> hermes, PlatformTransactionManager administrador,
                              Clock reloj, @Value("${nexora.caja.hermes.huella-secreto:}") String secretoHuella) {
        this.reposiciones = reposiciones;
        this.cajas = cajas;
        this.cajasServicio = cajasServicio;
        this.hermes = hermes;
        this.tx = new TransactionTemplate(administrador);
        this.reloj = reloj;
        this.secretoHuella = secretoHuella;
    }

    // ============================================================================================ 1. solicitud
    @Transactional
    public ReposicionDetalle solicitar(Perfil asesor, SolicitudReposicion cuerpo) {
        Validaciones.exigirAsesor(asesor);
        if (cuerpo == null) throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica el monto, el motivo y los comentarios.");
        String clave = Validaciones.clave(cuerpo.claveIdempotencia());
        BigDecimal monto = Validaciones.importePositivo(cuerpo.monto(), "el monto solicitado");
        MotivoReposicion motivo = MotivoReposicion.de(cuerpo.motivo())
                .orElseThrow(() -> new CajaException(Codigo.DATOS_INVALIDOS, "Elige un motivo válido."));
        String comentarios = Validaciones.textoObligatorio(cuerpo.comentarios(), "los comentarios (explica para qué necesitas el dinero)",
                ReglasCaja.COMENTARIO_MIN, ReglasCaja.COMENTARIO_MAX);

        CajaFila caja = cajasServicio.bloquearCaja(asesor);   // bloquea la caja: serializa solicitudes y movimientos

        // Idempotencia: el mismo envío del formulario repetido devuelve la solicitud ya creada, sin duplicar.
        var repetida = reposiciones.porClave(asesor.getId(), clave);
        if (repetida.isPresent()) return construir(asesor, repetida.get());

        if (!"ABIERTA".equals(caja.estado())) {
            throw new CajaException(Codigo.CAJA_CERRADA, "Tu caja está cerrada: no se pueden solicitar reposiciones.");
        }
        var abierta = reposiciones.abiertaDeCaja(caja.id());
        if (abierta.isPresent()) {
            Registro a = abierta.get();
            throw new CajaException(Codigo.REPOSICION_EN_TRAMITE,
                    "Ya tienes la reposición REP-" + a.numero() + " en trámite (" + a.estado().etiqueta()
                            + "). Espera a que se resuelva antes de pedir otra.",
                    Map.of("numero", a.numero(), "estado", a.estado().name(), "id", a.id()));
        }

        CapacidadCaja cap = CapacidadCaja.de(caja.limite(), caja.saldo(), cajas.autorizadoPendiente(caja.id(), null));
        if (!cap.permite(monto)) {
            throw excedeCapacidad(cap, monto, "solicitar");
        }
        UUID id;
        try {
            id = reposiciones.insertar(caja.id(), asesor.getId(), caja.agenciaId(), monto, motivo.name(), comentarios,
                    caja.saldo(), cap.libre(), clave);
        } catch (DataIntegrityViolationException e) {
            throw new CajaException(Codigo.CONFLICTO_CONCURRENCIA,
                    "No se pudo registrar la solicitud porque otra operación se interpuso. Revisa tu caja e inténtalo de nuevo.");
        }
        reposiciones.auditar(caja.id(), id, asesor.getId(), "SOLICITUD_CREADA", monto,
                motivo.etiqueta() + ". " + comentarios, UUID.randomUUID());
        return construir(asesor, reposiciones.porId(id).orElseThrow());
    }

    private static CajaException excedeCapacidad(CapacidadCaja cap, BigDecimal monto, String verbo) {
        BigDecimal libre = cap.libre();
        String causa = "Límite de caja " + Validaciones.soles(cap.limite()) + " − efectivo actual "
                + Validaciones.soles(cap.saldo())
                + (cap.autorizadoPendiente().signum() > 0
                ? " − reposiciones ya autorizadas pendientes de recibir " + Validaciones.soles(cap.autorizadoPendiente()) : "")
                + " = " + Validaciones.soles(libre) + ".";
        String mensaje = libre.signum() == 0
                ? "No puedes " + verbo + " dinero ahora: la caja ya está en su límite. " + causa
                : "El monto " + Validaciones.soles(monto) + " supera lo que puedes " + verbo + " ahora ("
                + Validaciones.soles(libre) + "). " + causa;
        return new CajaException(Codigo.MONTO_EXCEDE_CAPACIDAD, mensaje,
                Map.of("maximo", libre, "limite", cap.limite(), "saldo", cap.saldo(),
                        "autorizadoPendiente", cap.autorizadoPendiente(), "solicitado", monto));
    }

    // ============================================================================================ 2. gerencia: aclarar / rechazar
    @Transactional
    public ReposicionDetalle observar(Perfil gerente, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirGerencia(gerente);
        String texto = Validaciones.textoObligatorio(cuerpo == null ? null : cuerpo.texto(), "la aclaración que necesitas",
                ReglasCaja.JUSTIFICACION_MIN, ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirVersion(r, cuerpo == null ? null : cuerpo.version());
        exigirEstado(r, EstadoReposicion.PENDIENTE_APROBACION);
        transicionar(r, EstadoReposicion.PENDIENTE_APROBACION, EstadoReposicion.OBSERVADA);
        reposiciones.auditar(r.cajaId(), r.id(), gerente.getId(), "OBSERVACION", null, texto, UUID.randomUUID());
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    @Transactional
    public ReposicionDetalle rechazar(Perfil gerente, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirGerencia(gerente);
        String motivo = Validaciones.textoObligatorio(cuerpo == null ? null : cuerpo.texto(), "la justificación del rechazo",
                ReglasCaja.JUSTIFICACION_MIN, ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirVersion(r, cuerpo == null ? null : cuerpo.version());
        if (r.estado() != EstadoReposicion.PENDIENTE_APROBACION && r.estado() != EstadoReposicion.OBSERVADA) {
            throw estadoInvalido(r, "rechazarla");
        }
        EstadoReposicion desde = r.estado();
        exigirTransicion(desde, EstadoReposicion.RECHAZADA);
        if (reposiciones.rechazar(id, desde, gerente.getId(), motivo) != 1) throw conflicto();
        reposiciones.auditar(r.cajaId(), id, gerente.getId(), "RECHAZO", r.montoSolicitado(), motivo, UUID.randomUUID());
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    // ============================================================================================ asesor: responder / cancelar
    @Transactional
    public ReposicionDetalle responder(Perfil asesor, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirAsesor(asesor);
        String texto = Validaciones.textoObligatorio(cuerpo == null ? null : cuerpo.texto(), "tu respuesta",
                ReglasCaja.JUSTIFICACION_MIN, ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirPropietario(asesor, r);
        exigirEstado(r, EstadoReposicion.OBSERVADA);
        transicionar(r, EstadoReposicion.OBSERVADA, EstadoReposicion.PENDIENTE_APROBACION);
        reposiciones.auditar(r.cajaId(), id, asesor.getId(), "RESPUESTA", null, texto, UUID.randomUUID());
        return construir(asesor, reposiciones.porId(id).orElseThrow());
    }

    @Transactional
    public ReposicionDetalle cancelar(Perfil asesor, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirAsesor(asesor);
        String texto = Validaciones.textoOpcional(cuerpo == null ? null : cuerpo.texto(), "el motivo", ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirPropietario(asesor, r);
        if (r.estado() != EstadoReposicion.PENDIENTE_APROBACION && r.estado() != EstadoReposicion.OBSERVADA) {
            throw estadoInvalido(r, "cancelarla (una reposición ya autorizada solo la cierra gerencia)");
        }
        transicionar(r, r.estado(), EstadoReposicion.CANCELADA);
        reposiciones.auditar(r.cajaId(), id, asesor.getId(), "CANCELACION", r.montoSolicitado(),
                texto == null ? "Cancelada por el asesor" : texto, UUID.randomUUID());
        return construir(asesor, reposiciones.porId(id).orElseThrow());
    }

    // ============================================================================================ 3. aprobación con Hermes
    /**
     * Aprueba la solicitud. NO es una sola transacción a propósito: (A) validaciones sin bloqueos y verificación de Hermes
     * —su intento queda registrado aunque falle— y (B) una transacción corta que revalida TODO con la caja y la reposición
     * bloqueadas y aplica la aprobación. Si (B) falla no queda aprobación parcial alguna.
     */
    public ReposicionDetalle aprobar(Perfil gerente, UUID id, AprobarReposicion cuerpo) {
        Validaciones.exigirGerencia(gerente);
        if (cuerpo == null) throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica el monto a autorizar y el código Hermes.");
        UUID correlacion = UUID.randomUUID();

        // ---- A. validaciones previas
        Registro previo = reposiciones.porId(id).orElseThrow(noEncontradaSupplier());
        exigirDistintoDelAsesor(gerente, previo);
        exigirEstado(previo, EstadoReposicion.PENDIENTE_APROBACION);
        exigirVersion(previo, cuerpo.version());
        BigDecimal monto = Validaciones.importePositivo(cuerpo.montoAutorizado(), "el monto a autorizar");
        if (monto.compareTo(previo.montoSolicitado()) > 0) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "No puedes autorizar más de lo solicitado ("
                    + Validaciones.soles(previo.montoSolicitado()) + ").");
        }
        String justificacion = monto.compareTo(previo.montoSolicitado()) < 0
                ? Validaciones.textoObligatorio(cuerpo.justificacion(), "la justificación de autorizar menos de lo solicitado",
                ReglasCaja.JUSTIFICACION_MIN, ReglasCaja.TEXTO_MAX)
                : Validaciones.textoOpcional(cuerpo.justificacion(), "la justificación", ReglasCaja.TEXTO_MAX);
        if (!CodigoHermes.formatoValido(cuerpo.codigoHermes())) {
            throw new CajaException(Codigo.CODIGO_HERMES_FORMATO, "El código Hermes debe tener exactamente 8 dígitos numéricos.");
        }
        // Capacidad con lectura previa: si ya no cabe, ni se consulta a Hermes (se revalida bloqueando en B).
        CajaFila cajaPrevia = cajas.porId(previo.cajaId()).orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No existe la caja."));
        CapacidadCaja capPrevia = CapacidadCaja.de(cajaPrevia.limite(), cajaPrevia.saldo(), cajas.autorizadoPendiente(cajaPrevia.id(), id));
        if (!capPrevia.permite(monto)) throw excedeCapacidad(capPrevia, monto, "autorizar");

        // ---- Hermes
        if (reposiciones.hermesFallidosRecientes(id, gerente.getId(), ReglasCaja.HERMES_VENTANA_MINUTOS)
                >= ReglasCaja.HERMES_MAX_INTENTOS_FALLIDOS) {
            throw new CajaException(Codigo.HERMES_BLOQUEADO, "Demasiados intentos fallidos con el código Hermes. Espera "
                    + ReglasCaja.HERMES_VENTANA_MINUTOS + " minutos antes de volver a intentarlo.");
        }
        UUID verificacionId = verificarHermes(gerente, previo, monto, cuerpo.codigoHermes(), correlacion);

        // ---- B. aplicación atómica
        final String just = justificacion;
        tx.executeWithoutResult(status -> {
            CajaFila caja = cajas.bloquearPorId(previo.cajaId())
                    .orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No existe la caja."));
            Registro r = reposiciones.porIdBloqueando(id).orElseThrow(noEncontradaSupplier());
            exigirEstado(r, EstadoReposicion.PENDIENTE_APROBACION);
            if (r.version() != previo.version()) {
                throw new CajaException(Codigo.VERSION_DESACTUALIZADA,
                        "La solicitud cambió mientras se verificaba el código. Revísala y vuelve a intentar con un código nuevo.");
            }
            if (!"ABIERTA".equals(caja.estado())) throw new CajaException(Codigo.CAJA_CERRADA, "La caja del asesor está cerrada.");
            CapacidadCaja cap = CapacidadCaja.de(caja.limite(), caja.saldo(), cajas.autorizadoPendiente(caja.id(), id));
            if (!cap.permite(monto)) throw excedeCapacidad(cap, monto, "autorizar");
            exigirTransicion(r.estado(), EstadoReposicion.APROBADA);
            if (reposiciones.aprobar(id, gerente.getId(), monto, just, verificacionId) != 1) throw conflicto();
            reposiciones.consumirHermes(verificacionId);
            reposiciones.auditar(caja.id(), id, gerente.getId(), "APROBACION", monto,
                    "Autorizado " + Validaciones.soles(monto) + " de " + Validaciones.soles(r.montoSolicitado())
                            + (just == null ? "" : ". " + just), correlacion);
            reposiciones.auditar(caja.id(), id, gerente.getId(), "HERMES_VERIFICADO", monto, "Verificación Hermes aceptada",
                    correlacion);
        });
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    /** Verifica con Hermes y deja constancia del intento (nunca del código). Devuelve el id de la verificación válida. */
    private UUID verificarHermes(Perfil gerente, Registro r, BigDecimal monto, String codigo, UUID correlacion) {
        HermesVerificador verificador = hermes.getIfAvailable(HermesNoConfigurado::new);
        ResultadoHermes resultado;
        try {
            resultado = verificador.verificar(new SolicitudHermes(codigo, r.id(), r.numero(), monto, gerente.getId(), correlacion));
        } catch (RuntimeException e) {
            resultado = ResultadoHermes.de(ResultadoHermes.Estado.NO_DISPONIBLE);
        }
        switch (resultado.estado()) {
            case NO_CONFIGURADO -> {
                registrarIntento(r, gerente, monto, "NO_CONFIGURADO", null, null, correlacion);
                throw new CajaException(Codigo.HERMES_NO_CONFIGURADO,
                        "Hermes aún no está conectado a este sistema: no se puede aprobar. Pide a TI que configure la integración.");
            }
            case NO_DISPONIBLE -> {
                registrarIntento(r, gerente, monto, "NO_DISPONIBLE", null, null, correlacion);
                throw new CajaException(Codigo.HERMES_NO_DISPONIBLE,
                        "No se pudo contactar a Hermes. No se aprobó nada; inténtalo de nuevo en unos minutos.");
            }
            case INVALIDO, EXPIRADO -> {
                registrarIntento(r, gerente, monto, resultado.estado().name(), null, resultado.referencia(), correlacion);
                reposiciones.auditar(r.cajaId(), r.id(), gerente.getId(), "HERMES_RECHAZADO", monto,
                        "Código " + (resultado.estado() == ResultadoHermes.Estado.EXPIRADO ? "vencido" : "incorrecto"), correlacion);
                throw new CajaException(Codigo.CODIGO_HERMES_INVALIDO, resultado.estado() == ResultadoHermes.Estado.EXPIRADO
                        ? "El código Hermes está vencido. Genera uno nuevo e inténtalo otra vez."
                        : "El código Hermes no es válido para esta autorización.");
            }
            case VALIDO -> {
                if (secretoHuella == null || secretoHuella.isBlank()) {
                    throw new CajaException(Codigo.HERMES_NO_CONFIGURADO,
                            "Falta configurar el secreto de la huella Hermes (nexora.caja.hermes.huella-secreto).");
                }
                String huella = CodigoHermes.huella(codigo, secretoHuella);
                try {
                    return reposiciones.registrarIntentoHermes(r.id(), gerente.getId(), monto, "VALIDO", huella,
                            resultado.referencia(), correlacion);
                } catch (DuplicateKeyException e) {
                    registrarIntento(r, gerente, monto, "INVALIDO", null, null, correlacion);
                    reposiciones.auditar(r.cajaId(), r.id(), gerente.getId(), "HERMES_RECHAZADO", monto,
                            "Código ya utilizado", correlacion);
                    throw new CajaException(Codigo.CODIGO_HERMES_REUTILIZADO,
                            "Ese código Hermes ya se usó. Cada autorización necesita un código nuevo.");
                }
            }
        }
        throw new IllegalStateException("Resultado de Hermes no contemplado: " + resultado.estado());
    }

    private void registrarIntento(Registro r, Perfil gerente, BigDecimal monto, String resultado, String huella,
                                  String referencia, UUID correlacion) {
        reposiciones.registrarIntentoHermes(r.id(), gerente.getId(), monto, resultado, huella, referencia, correlacion);
    }

    // ============================================================================================ 4. envío
    @Transactional
    public ReposicionDetalle despachar(Perfil gerente, UUID id, Despacho cuerpo) {
        Validaciones.exigirGerencia(gerente);
        if (cuerpo == null) throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica el importe enviado.");
        BigDecimal enviado = Validaciones.importePositivo(cuerpo.montoEnviado(), "el importe enviado");
        String referencia = Validaciones.textoOpcional(cuerpo.referencia(), "la referencia", ReglasCaja.REFERENCIA_MAX);
        String comentarios = Validaciones.textoOpcional(cuerpo.comentarios(), "las observaciones", ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirVersion(r, cuerpo.version());
        exigirEstado(r, EstadoReposicion.APROBADA);
        if (enviado.compareTo(r.montoAutorizado()) > 0) {
            throw new CajaException(Codigo.EXCEDE_AUTORIZADO, "No puedes enviar más de lo autorizado ("
                    + Validaciones.soles(r.montoAutorizado()) + ").");
        }
        exigirTransicion(r.estado(), EstadoReposicion.EN_TRANSITO);
        if (reposiciones.despachar(id, gerente.getId(), enviado, referencia) != 1) throw conflicto();
        reposiciones.auditar(r.cajaId(), id, gerente.getId(), "ENVIO_REGISTRADO", enviado,
                (referencia == null ? "" : "Ref. " + referencia + ". ") + (comentarios == null ? "" : comentarios), UUID.randomUUID());
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    // ============================================================================================ 5. recepción
    /**
     * El asesor declara cuánto recibió. Solo entonces el dinero entra al saldo físico (movimiento del libro). Idempotente por
     * clave; nunca más de lo autorizado pendiente ni de S/ 50,000 en caja. Un excedente NO se contabiliza: va a incidencia.
     */
    @Transactional
    public ReposicionDetalle registrarRecepcion(Perfil asesor, UUID id, Recepcion cuerpo) {
        Validaciones.exigirAsesor(asesor);
        if (cuerpo == null) throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica el importe recibido.");
        String clave = Validaciones.clave(cuerpo.claveIdempotencia());
        BigDecimal importe = Validaciones.importePositivo(cuerpo.importe(), "el importe recibido");
        String referencia = Validaciones.textoOpcional(cuerpo.referencia(), "la referencia", ReglasCaja.REFERENCIA_MAX);
        String comentarios = Validaciones.textoOpcional(cuerpo.comentarios(), "los comentarios", ReglasCaja.TEXTO_MAX);

        Registro previo = reposiciones.porId(id).orElseThrow(noEncontradaSupplier());
        exigirPropietario(asesor, previo);
        CajaFila caja = cajas.bloquearPorId(previo.cajaId())
                .orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No existe la caja."));
        Registro r = reposiciones.porIdBloqueando(id).orElseThrow(noEncontradaSupplier());

        // Idempotencia: un reintento del mismo envío no vuelve a sumar.
        if (reposiciones.recepcionPorClave(id, clave).isPresent()) return construir(asesor, r);

        if (!r.estado().admiteRecepcion()) throw estadoInvalido(r, "registrar una recepción");
        if (!"ABIERTA".equals(caja.estado())) throw new CajaException(Codigo.CAJA_CERRADA, "Tu caja está cerrada.");
        Instant ahora = Instant.now(reloj);
        if (cuerpo.recibidoEn() != null) {
            if (cuerpo.recibidoEn().isAfter(ahora.plus(TOLERANCIA_RELOJ)) || cuerpo.recibidoEn().isBefore(r.decididoEn())) {
                throw new CajaException(Codigo.FECHA_RECEPCION_INVALIDA,
                        "La fecha de recepción no puede ser futura ni anterior a la autorización.");
            }
        }
        BigDecimal pendiente = r.pendienteRecepcion();
        if (importe.compareTo(pendiente) > 0) {
            throw new CajaException(Codigo.EXCEDE_AUTORIZADO,
                    "Recibiste " + Validaciones.soles(importe) + " pero solo quedan " + Validaciones.soles(pendiente)
                            + " por recibir de lo autorizado. El excedente NO se contabiliza: repórtalo como incidencia "
                            + "(tipo «Excedente») para que gerencia lo investigue.",
                    Map.of("pendiente", pendiente, "recibido", importe));
        }
        BigDecimal nuevoSaldo = caja.saldo().add(importe);
        if (nuevoSaldo.compareTo(caja.limite()) > 0) {
            throw new CajaException(Codigo.EXCEDE_LIMITE_CAJA, "Con ese ingreso la caja pasaría de su límite de "
                    + Validaciones.soles(caja.limite()) + " (efectivo actual " + Validaciones.soles(caja.saldo())
                    + "). No se contabilizó; reporta la diferencia como incidencia.");
        }
        BigDecimal nuevoTotal = r.totalRecibido().add(importe);
        EstadoReposicion nuevoEstado = pendiente.subtract(importe).signum() == 0
                ? EstadoReposicion.RECIBIDA : EstadoReposicion.RECEPCION_PARCIAL;
        exigirTransicion(r.estado(), nuevoEstado);

        UUID correlacion = UUID.randomUUID();
        // La idempotencia ya se resolvió arriba bajo el bloqueo de la caja; un duplicado aquí no puede darse y,
        // si ocurriera, abortaría la transacción: se deja subir y el manejador lo informa como conflicto.
        UUID recepcionId = reposiciones.insertarRecepcion(id, importe, cuerpo.recibidoEn(), asesor.getId(), referencia,
                comentarios, clave);
        cajas.insertarMovimiento(caja.id(), "REPOSICION", "ENTRADA", importe, caja.saldo(), nuevoSaldo, null, id, recepcionId,
                "Reposición REP-" + r.numero(), asesor.getId(), correlacion);
        if (reposiciones.registrarRecibido(id, r.estado(), nuevoTotal, nuevoEstado) != 1) throw conflicto();
        reposiciones.auditar(caja.id(), id, asesor.getId(), "RECEPCION_REGISTRADA", importe,
                (referencia == null ? "" : "Ref. " + referencia + ". ") + "Total recibido " + Validaciones.soles(nuevoTotal)
                        + " de " + Validaciones.soles(r.montoAutorizado()) + (comentarios == null ? "" : ". " + comentarios),
                correlacion);
        if (nuevoEstado == EstadoReposicion.RECIBIDA) {
            abrirIncidenciaSiHayDiferenciaDeEnvio(r.id(), r.cajaId(), r.montoEnviado(), nuevoTotal, correlacion);
        }
        return construir(asesor, reposiciones.porId(id).orElseThrow());
    }

    /** Si lo enviado y lo recibido no coinciden al completarse la recepción, queda una incidencia abierta (la abre el sistema). */
    private void abrirIncidenciaSiHayDiferenciaDeEnvio(UUID reposicionId, UUID cajaId, BigDecimal enviado, BigDecimal recibido,
                                                       UUID correlacion) {
        if (enviado == null || enviado.compareTo(recibido) == 0) return;
        BigDecimal diferencia = enviado.subtract(recibido).abs();
        reposiciones.insertarIncidencia(reposicionId, "DIFERENCIA_ENVIO_RECEPCION", diferencia,
                "Gerencia registró un envío de " + Validaciones.soles(enviado) + " y el asesor recibió "
                        + Validaciones.soles(recibido) + ".", null);
        reposiciones.auditar(cajaId, reposicionId, null, "INCIDENCIA_REPORTADA", diferencia,
                "Diferencia entre lo enviado y lo recibido", correlacion);
    }

    // ============================================================================================ 6. remanente y conciliación
    /**
     * Gerencia cierra lo autorizado que no se recibió, con justificación (la autorización original queda intacta en el
     * historial). Sin nada recibido la reposición se cancela; con recepciones queda recibida, lista para conciliar.
     */
    @Transactional
    public ReposicionDetalle cerrarRemanente(Perfil gerente, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirGerencia(gerente);
        String motivo = Validaciones.textoObligatorio(cuerpo == null ? null : cuerpo.texto(), "la justificación del cierre",
                ReglasCaja.JUSTIFICACION_MIN, ReglasCaja.TEXTO_MAX);
        Registro previo = reposiciones.porId(id).orElseThrow(noEncontradaSupplier());
        cajas.bloquearPorId(previo.cajaId()).orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No existe la caja."));
        Registro r = reposiciones.porIdBloqueando(id).orElseThrow(noEncontradaSupplier());
        exigirVersion(r, cuerpo == null ? null : cuerpo.version());
        if (!r.estado().admiteRecepcion()) throw estadoInvalido(r, "cerrar el saldo restante");
        BigDecimal pendiente = r.pendienteRecepcion();
        if (pendiente.signum() <= 0) throw new CajaException(Codigo.NADA_PENDIENTE, "No hay saldo pendiente por cerrar.");
        EstadoReposicion destino = r.totalRecibido().signum() == 0 ? EstadoReposicion.CANCELADA : EstadoReposicion.RECIBIDA;
        exigirTransicion(r.estado(), destino);
        UUID correlacion = UUID.randomUUID();
        if (reposiciones.cerrarRemanente(id, r.estado(), r.cierreRemanenteImporte().add(pendiente), gerente.getId(), motivo, destino) != 1) {
            throw conflicto();
        }
        reposiciones.auditar(r.cajaId(), id, gerente.getId(), "REMANENTE_CERRADO", pendiente,
                "Se cerraron " + Validaciones.soles(pendiente) + " sin recibir. " + motivo, correlacion);
        if (destino == EstadoReposicion.RECIBIDA) {
            abrirIncidenciaSiHayDiferenciaDeEnvio(id, r.cajaId(), r.montoEnviado(), r.totalRecibido(), correlacion);
        }
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    /** Conciliación final (segunda validación de gerencia): exige todo recibido o cerrado y cero incidencias abiertas. */
    @Transactional
    public ReposicionDetalle conciliar(Perfil gerente, UUID id, DecisionTexto cuerpo) {
        Validaciones.exigirGerencia(gerente);
        String nota = Validaciones.textoOpcional(cuerpo == null ? null : cuerpo.texto(), "la nota de conciliación", ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        exigirVersion(r, cuerpo == null ? null : cuerpo.version());
        exigirEstado(r, EstadoReposicion.RECIBIDA);
        int abiertas = reposiciones.incidenciasAbiertas(id);
        if (abiertas > 0) {
            throw new CajaException(Codigo.INCIDENCIAS_ABIERTAS, "No se puede conciliar: hay " + abiertas
                    + " incidencia(s) sin resolver. Resuélvelas primero.", Map.of("incidencias", abiertas));
        }
        BigDecimal sumaRecepciones = reposiciones.recepciones(id).stream().map(rc -> rc.importe())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sumaRecepciones.compareTo(r.totalRecibido()) != 0
                || r.totalRecibido().add(r.cierreRemanenteImporte()).compareTo(r.montoAutorizado()) != 0) {
            throw new CajaException(Codigo.INCONSISTENCIA_DATOS,
                    "Los importes de la reposición no cuadran con sus recepciones. No se concilia hasta revisarlo.");
        }
        exigirTransicion(r.estado(), EstadoReposicion.COMPLETADA);
        if (reposiciones.conciliar(id, gerente.getId(), nota) != 1) throw conflicto();
        reposiciones.auditar(r.cajaId(), id, gerente.getId(), "CONCILIACION", r.totalRecibido(),
                "Autorizado " + Validaciones.soles(r.montoAutorizado()) + ", recibido " + Validaciones.soles(r.totalRecibido())
                        + (r.cierreRemanenteImporte().signum() > 0 ? ", cerrado sin recibir " + Validaciones.soles(r.cierreRemanenteImporte()) : "")
                        + (nota == null ? "" : ". " + nota), UUID.randomUUID());
        return construir(gerente, reposiciones.porId(id).orElseThrow());
    }

    // ============================================================================================ 7. incidencias
    @Transactional
    public ReposicionDetalle reportarIncidencia(Perfil quien, UUID id, NuevaIncidencia cuerpo) {
        if (cuerpo == null) throw new CajaException(Codigo.DATOS_INVALIDOS, "Describe la incidencia.");
        if (cuerpo.tipo() == null || !TIPOS_INCIDENCIA_MANUAL.contains(cuerpo.tipo())) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "Elige un tipo de incidencia válido (excedente, faltante u otro).");
        }
        BigDecimal importe = Validaciones.importeNoNegativo(cuerpo.importe() == null ? BigDecimal.ZERO : cuerpo.importe(),
                "el importe de la incidencia");
        String descripcion = Validaciones.textoObligatorio(cuerpo.descripcion(), "la descripción de la incidencia", 5, ReglasCaja.TEXTO_MAX);
        Registro r = bloqueada(id);
        if (!esGerencia(quien) && !propietario(quien, r)) throw noEncontrada();
        if (!(r.estado().admiteRecepcion() || r.estado() == EstadoReposicion.RECIBIDA)) {
            throw estadoInvalido(r, "reportar una incidencia");
        }
        reposiciones.insertarIncidencia(id, cuerpo.tipo(), importe, descripcion, quien.getId());
        reposiciones.auditar(r.cajaId(), id, quien.getId(), "INCIDENCIA_REPORTADA", importe, descripcion, UUID.randomUUID());
        return construir(quien, reposiciones.porId(id).orElseThrow());
    }

    @Transactional
    public ReposicionDetalle resolverIncidencia(Perfil gerente, UUID incidenciaId, ResolverIncidencia cuerpo) {
        Validaciones.exigirGerencia(gerente);
        String resolucion = Validaciones.textoObligatorio(cuerpo == null ? null : cuerpo.resolucion(), "la resolución", 5,
                ReglasCaja.TEXTO_MAX);
        var inc = reposiciones.incidenciaBloqueando(incidenciaId)
                .orElseThrow(() -> new CajaException(Codigo.INCIDENCIA_NO_ENCONTRADA, "No existe la incidencia."));
        if (!"ABIERTA".equals(inc.estado())) {
            throw new CajaException(Codigo.ESTADO_INVALIDO, "La incidencia ya estaba resuelta.");
        }
        Registro r = reposiciones.porId(inc.reposicionId()).orElseThrow(noEncontradaSupplier());
        if (reposiciones.resolverIncidencia(incidenciaId, gerente.getId(), resolucion) != 1) throw conflicto();
        reposiciones.auditar(r.cajaId(), r.id(), gerente.getId(), "INCIDENCIA_RESUELTA", inc.importe(), resolucion, UUID.randomUUID());
        return construir(gerente, r);
    }

    // ============================================================================================ lectura
    @Transactional(readOnly = true)
    public ReposicionDetalle detalle(Perfil quien, UUID id) {
        Registro r = reposiciones.porId(id).orElseThrow(noEncontradaSupplier());
        if (!esGerencia(quien) && !propietario(quien, r)) throw noEncontrada();
        return construir(quien, r);
    }

    // ============================================================================================ construcción del detalle
    ReposicionDetalle construir(Perfil quien, Registro r) {
        var fila = reposiciones.filaPorId(r.id()).orElseThrow(noEncontradaSupplier());
        CajaFila caja = cajas.porId(r.cajaId()).orElseThrow(() -> new CajaException(Codigo.CAJA_NO_ENCONTRADA, "No existe la caja."));
        BigDecimal otras = cajas.autorizadoPendiente(caja.id(), r.id());
        CapacidadCaja cap = CapacidadCaja.de(caja.limite(), caja.saldo(), otras);
        CajaContexto contexto = new CajaContexto(caja.saldo(), caja.limite(), otras, cap.libre(), cap.capacidadHastaLimite());
        List<EventoLinea> linea = new ArrayList<>(reposiciones.linea(r.id(), ETIQUETAS));
        if (!esGerencia(quien)) linea.removeIf(e -> "HERMES_RECHAZADO".equals(e.accion()));
        var incidencias = reposiciones.incidencias(r.id());
        int abiertas = (int) incidencias.stream().filter(i -> "ABIERTA".equals(i.estado())).count();
        var extra = reposiciones.extraDetalle(r.id());
        return new ReposicionDetalle(fila, MotivoReposicion.de(r.motivo()).map(MotivoReposicion::etiqueta).orElse(r.motivo()),
                r.comentarios(), r.justificacionDecision(), extra.decididoPor(), r.decididoEn(), extra.enviadoPor(),
                r.enviadoEn(), r.referenciaEnvio(), extra.cierreMotivo(), extra.cierrePor(), extra.cierreEn(),
                extra.conciliadoPor(), extra.conciliadoEn(), extra.conciliacionNota(), r.version(),
                r.hermesVerificacionId() != null, contexto, reposiciones.recepciones(r.id()), incidencias, linea,
                acciones(quien, r, abiertas), Instant.now(reloj));
    }

    /** Acciones que el usuario puede ejecutar ahora (la interfaz solo las muestra; el servidor las vuelve a validar). */
    static List<String> acciones(Perfil quien, Registro r, int incidenciasAbiertas) {
        List<String> a = new ArrayList<>();
        EstadoReposicion e = r.estado();
        if (esGerencia(quien)) {
            switch (e) {
                case PENDIENTE_APROBACION -> { a.add("APROBAR"); a.add("OBSERVAR"); a.add("RECHAZAR"); }
                case OBSERVADA -> a.add("RECHAZAR");
                case APROBADA -> { a.add("DESPACHAR"); a.add("CERRAR_REMANENTE"); }
                case EN_TRANSITO, RECEPCION_PARCIAL -> a.add("CERRAR_REMANENTE");
                case RECIBIDA -> { if (incidenciasAbiertas == 0) a.add("CONCILIAR"); }
                default -> { }
            }
            if (incidenciasAbiertas > 0) a.add("RESOLVER_INCIDENCIA");
            if (e.admiteRecepcion() || e == EstadoReposicion.RECIBIDA) a.add("REPORTAR_INCIDENCIA");
        } else if (propietario(quien, r)) {
            switch (e) {
                case PENDIENTE_APROBACION -> a.add("CANCELAR");
                case OBSERVADA -> { a.add("RESPONDER"); a.add("CANCELAR"); }
                case APROBADA, EN_TRANSITO, RECEPCION_PARCIAL -> a.add("REGISTRAR_RECEPCION");
                default -> { }
            }
            if (e.admiteRecepcion() || e == EstadoReposicion.RECIBIDA) a.add("REPORTAR_INCIDENCIA");
        }
        return a;
    }

    // ============================================================================================ utilidades
    private Registro bloqueada(UUID id) {
        return reposiciones.porIdBloqueando(id).orElseThrow(noEncontradaSupplier());
    }

    private static java.util.function.Supplier<CajaException> noEncontradaSupplier() {
        return ReposicionServicio::noEncontrada;
    }

    private static CajaException noEncontrada() {
        return new CajaException(Codigo.REPOSICION_NO_ENCONTRADA, "No existe la reposición indicada.");
    }

    private static CajaException conflicto() {
        return new CajaException(Codigo.CONFLICTO_CONCURRENCIA,
                "La reposición cambió mientras la procesábamos. Actualiza la pantalla e inténtalo de nuevo.");
    }

    private static CajaException estadoInvalido(Registro r, String accion) {
        return new CajaException(Codigo.ESTADO_INVALIDO, "No se puede " + accion + ": la reposición REP-" + r.numero()
                + " está en estado «" + r.estado().etiqueta() + "».", Map.of("estado", r.estado().name()));
    }

    private static void exigirEstado(Registro r, EstadoReposicion esperado) {
        if (r.estado() != esperado) {
            throw new CajaException(Codigo.ESTADO_INVALIDO, "La reposición REP-" + r.numero() + " ya no está en estado «"
                    + esperado.etiqueta() + "» (ahora: «" + r.estado().etiqueta() + "»). Actualiza la pantalla.",
                    Map.of("estado", r.estado().name()));
        }
    }

    private static void exigirTransicion(EstadoReposicion desde, EstadoReposicion hacia) {
        if (!desde.puedePasarA(hacia)) {
            throw new CajaException(Codigo.ESTADO_INVALIDO, "Transición no permitida: " + desde.etiqueta() + " → " + hacia.etiqueta() + ".");
        }
    }

    private void transicionar(Registro r, EstadoReposicion desde, EstadoReposicion hacia) {
        exigirTransicion(desde, hacia);
        if (reposiciones.transicion(r.id(), desde, hacia) != 1) throw conflicto();
    }

    /** Control optimista: si la pantalla traía una versión y ya cambió, se rechaza (no se decide sobre datos viejos). */
    private static void exigirVersion(Registro r, Integer versionEsperada) {
        if (versionEsperada != null && versionEsperada != r.version()) {
            throw new CajaException(Codigo.VERSION_DESACTUALIZADA,
                    "La solicitud cambió desde que la abriste. Actualiza la pantalla y revísala de nuevo.");
        }
    }

    private static boolean esGerencia(Perfil p) {
        return p != null && "gerencia".equals(p.getRol());
    }

    private static boolean propietario(Perfil p, Registro r) {
        return p != null && "asesor".equals(p.getRol()) && p.getId().equals(r.asesorId());
    }

    private static void exigirPropietario(Perfil asesor, Registro r) {
        if (!propietario(asesor, r)) throw noEncontrada(); // 404: no se revela que existe una reposición ajena
    }

    private static void exigirDistintoDelAsesor(Perfil gerente, Registro r) {
        if (gerente.getId().equals(r.asesorId())) {
            throw new CajaException(Codigo.SIN_PERMISO, "No puedes autorizar tu propia solicitud.");
        }
    }
}
