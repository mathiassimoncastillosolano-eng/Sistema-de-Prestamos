package com.nexora.backend.clientes.servicios;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.clientes.excepciones.ClienteException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.InputStream;
import java.time.Duration;
import java.util.Map;

@Component
public class ApiPeruCliente {

    private static final Logger LOG = LoggerFactory.getLogger(ApiPeruCliente.class);

    private final RestClient restClient;
    private final boolean tokenConfigurado;
    private final ObjectMapper json = new ObjectMapper();

    /**
     * Respuesta HTTP sin interpretar: estado y cuerpo JSON (null si no era JSON).
     */
    private record Respuesta(int estado, JsonNode cuerpo) {
    }

    public ApiPeruCliente(
            @Value("${apiperu.base-url}") String baseUrl,
            @Value("${apiperu.token}") String token) {
        this.tokenConfigurado = token != null && !token.isBlank();

        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(Duration.ofSeconds(5));
        fabrica.setReadTimeout(Duration.ofSeconds(15));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(fabrica)
                .defaultHeader(
                        HttpHeaders.AUTHORIZATION,
                        "Bearer " + token)
                .defaultHeader(
                        HttpHeaders.CONTENT_TYPE,
                        MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(
                        HttpHeaders.ACCEPT,
                        MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // Consulta los datos de una persona mediante su DNI
    public JsonNode consultarDni(String dni) {
        return consultar("/dni", "dni", dni);
    }

    // Consulta los datos del RUC (SUNAT): razón social, estado, condición y
    // domicilio fiscal.
    public JsonNode consultarRuc(String ruc) {
        return consultar("/ruc", "ruc", ruc);
    }

    // Obtiene el RUC asociado a un DNI.
    // Para verificar el RUC 10.
    public JsonNode consultarRucPorDni(String dni) {
        return consultar("/dni-ruc", "dni", dni);
    }

    // Consulta los representantes registrados para un RUC (data es una lista).
    public JsonNode consultarRepresentantes(String ruc) {
        return consultar("/ruc-representantes", "ruc", ruc);
    }

    private JsonNode consultar(
            String endpoint,
            String campo,
            String valor) {
        if (!tokenConfigurado) {
            LOG.error("APIPERU_TOKEN no está configurado: no se puede consultar {}", endpoint);
            throw new ClienteException(ClienteException.Codigo.SERVICIO_NO_DISPONIBLE);
        }

        Respuesta r;
        try {
            r = restClient.post()
                    .uri(endpoint)
                    .body(json.writeValueAsString(Map.of(campo, valor)))
                    .exchange((peticion, respuesta) -> new Respuesta(respuesta.getStatusCode().value(),
                            leer(respuesta.getBody())));
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException e) {
            LOG.warn("No se pudo contactar con API PERÚ ({}): {}", endpoint, e.getClass().getName());
            throw new ClienteException(ClienteException.Codigo.SERVICIO_NO_DISPONIBLE);
        }

        JsonNode cuerpo = r.cuerpo();
        String codigo = cuerpo == null ? "" : cuerpo.path("code").asText("");
        boolean exito = cuerpo != null && cuerpo.path("success").asBoolean(false);

        if (r.estado() == 200 && exito && cuerpo.hasNonNull("data")) {
            return cuerpo.get("data");
        }
        if (r.estado() == 404 || "document_not_found".equals(codigo)) {
            return null;
        }
        if (r.estado() == 400 || "invalid_input".equals(codigo)) {
            throw new ClienteException(ClienteException.Codigo.DOCUMENTO_INVALIDO);
        }

        // 401/403 (token), 402/429 (saldo o limite), 5xx (servicio caido) u otra
        // respuesta inesperada.
        LOG.warn("API PERÚ respondió {} en {} (code={})", r.estado(), endpoint, codigo);
        throw new ClienteException(ClienteException.Codigo.SERVICIO_NO_DISPONIBLE);
    }

    private JsonNode leer(InputStream cuerpo) {
        try {
            return json.readTree(cuerpo);
        } catch (Exception e) {
            return null;
        }
    }
}