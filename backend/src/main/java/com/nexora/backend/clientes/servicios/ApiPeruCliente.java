
package com.nexora.backend.clientes.servicios;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class ApiPeruCliente {

    private final RestClient restClient;

    public ApiPeruCliente(
            @Value("${apiperu.base-url}") String baseUrl,
            @Value("${apiperu.token}") String token
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(
                        HttpHeaders.AUTHORIZATION,
                        "Bearer " + token
                )
                .defaultHeader(
                        HttpHeaders.CONTENT_TYPE,
                        MediaType.APPLICATION_JSON_VALUE
                )
                .defaultHeader(
                        HttpHeaders.ACCEPT,
                        MediaType.APPLICATION_JSON_VALUE
                )
                .build();
    }

    // Consulta los datos de una persona mediante su DNI.
    public JsonNode consultarDni(String dni) {
        return consultar("/dni", "dni", dni);
    }

    // Consulta los datos del RUC.
    public JsonNode consultarRuc(String ruc) {
        return consultar("/ruc", "ruc", ruc);
    }

    // Obtiene el RUC asociado a un DNI.
    // Para verificar el RUC 10.
    public JsonNode consultarRucPorDni(String dni) {
        return consultar("/dni-ruc", "dni", dni);
    }

    // Consulta los representantes registrados para un RUC
    public JsonNode consultarRepresentantes(String ruc) {
        return consultar("/ruc-representantes", "ruc", ruc);
    }

    private JsonNode consultar(
            String endpoint,
            String campo,
            String valor
    ) {
        return restClient.post()
                .uri(endpoint)
                .body(Map.of(campo, valor))
                .retrieve()
                .body(JsonNode.class);
    }
}
