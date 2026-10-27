package com.nexora.backend.caja.hermes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * SIMULACIÓN de Hermes. NO valida nada contra ningún servicio real: es una decisión del proyecto (Hermes no se conectará).
 * Activa por defecto; se apaga con {@code HERMES_SIMULADO=false}, y entonces toda aprobación se rechaza.
 *
 * <p>Reglas del simulador (el resto de controles —formato de 8 dígitos, un solo uso, límite de intentos, huella,
 * autorizador distinto del solicitante, importes— los aplica el servicio igual que con el Hermes real):
 * <ul>
 *   <li>{@code 00000000} → código inválido (para probar el rechazo)</li>
 *   <li>{@code 99999999} → código vencido</li>
 *   <li>cualquier otro código de 8 dígitos → válido</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(name = "nexora.caja.hermes.simulado", havingValue = "true")
public class HermesSimulado implements HermesVerificador {

    private static final Logger LOG = LoggerFactory.getLogger(HermesSimulado.class);

    public HermesSimulado() {
        LOG.warn("HERMES SIMULADO ACTIVO: los códigos NO se validan contra Hermes. No usar en producción.");
    }

    @Override
    public ResultadoHermes verificar(SolicitudHermes solicitud) {
        String codigo = solicitud.codigo();
        if ("00000000".equals(codigo)) return ResultadoHermes.de(ResultadoHermes.Estado.INVALIDO);
        if ("99999999".equals(codigo)) return ResultadoHermes.de(ResultadoHermes.Estado.EXPIRADO);
        return ResultadoHermes.valido("SIMULADO-" + solicitud.numeroReposicion());
    }
}
