package com.nexora.backend.caja.hermes;

/**
 * Puerto de integración con Hermes. En este proyecto NO existe Hermes (ni código, ni documentación, ni columnas): este
 * contrato es la costura donde se conectará el mecanismo oficial. Mientras no haya un bean que lo implemente, se usa
 * {@link HermesNoConfigurado}, que rechaza toda verificación: ninguna aprobación se acepta "por parecer válida".
 *
 * <p>Quien lo implemente debe comprobar con el servicio oficial que el código corresponde a la reposición, al importe
 * autorizado, a la identidad del autorizador y a una vigencia aún no vencida, y que es de un solo uso.
 */
public interface HermesVerificador {

    ResultadoHermes verificar(SolicitudHermes solicitud);
}
