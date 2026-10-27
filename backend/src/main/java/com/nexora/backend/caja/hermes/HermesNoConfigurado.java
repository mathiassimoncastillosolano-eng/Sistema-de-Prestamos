package com.nexora.backend.caja.hermes;

/** Verificador por defecto mientras Hermes no esté conectado: rechaza siempre (no aprueba nada, no inventa una API). */
public class HermesNoConfigurado implements HermesVerificador {

    @Override
    public ResultadoHermes verificar(SolicitudHermes solicitud) {
        return ResultadoHermes.de(ResultadoHermes.Estado.NO_CONFIGURADO);
    }
}
