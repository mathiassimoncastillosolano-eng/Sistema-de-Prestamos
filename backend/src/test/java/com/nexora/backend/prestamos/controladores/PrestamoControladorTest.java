package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PrestamoControladorTest {

    private PrestamoServicio servicio;
    private MockMvc mvc;

    private static final String JSON_OK = """
            {"clienteId":"11111111-1111-1111-1111-111111111111","capital":1000,"plazoMeses":12}
            """;

    @BeforeEach
    void preparar() {
        servicio = mock(PrestamoServicio.class);
        mvc = MockMvcBuilders.standaloneSetup(new PrestamoControlador(servicio))
                .setControllerAdvice(new ManejadorErroresPrestamo())
                .build();
    }

    @Test
    void sinPerfilEnLaPeticionDevuelve403() throws Exception {
        mvc.perform(post("/api/prestamos").contentType(MediaType.APPLICATION_JSON).content(JSON_OK))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("SIN_PERMISO"));
    }

    @Test
    void limiteExcedidoDevuelve422ConAcumuladoYExcedente() throws Exception {
        when(servicio.registrar(any(), any())).thenThrow(new PrestamoException(
                PrestamoException.Codigo.LIMITE_EXCEDIDO,
                "El cliente excede el límite de endeudamiento.",
                Map.of("acumulado", 9000, "limite", 10000, "excedente", 1)));

        mvc.perform(post("/api/prestamos")
                        .requestAttr("nexora.perfil", mock(Perfil.class))
                        .contentType(MediaType.APPLICATION_JSON).content(JSON_OK))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("LIMITE_EXCEDIDO"))
                .andExpect(jsonPath("$.detalle.acumulado").value(9000))
                .andExpect(jsonPath("$.detalle.excedente").value(1));
    }

    @Test
    void capitalNoNumericoDevuelve400() throws Exception {
        String malo = "{\"clienteId\":\"11111111-1111-1111-1111-111111111111\",\"capital\":\"abc\",\"plazoMeses\":12}";
        mvc.perform(post("/api/prestamos")
                        .requestAttr("nexora.perfil", mock(Perfil.class))
                        .contentType(MediaType.APPLICATION_JSON).content(malo))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    void jsonMalformadoDevuelve400() throws Exception {
        mvc.perform(post("/api/prestamos")
                        .requestAttr("nexora.perfil", mock(Perfil.class))
                        .contentType(MediaType.APPLICATION_JSON).content("{no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }
}