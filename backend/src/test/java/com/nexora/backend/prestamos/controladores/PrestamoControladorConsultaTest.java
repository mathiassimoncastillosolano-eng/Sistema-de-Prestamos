package com.nexora.backend.prestamos.controladores;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PrestamoControladorConsultaTest {

    private PrestamoServicio servicio;
    private MockMvc mvc;

    @BeforeEach
    void preparar() {
        servicio = mock(PrestamoServicio.class);
        mvc = MockMvcBuilders.standaloneSetup(new PrestamoControlador(servicio))
                .setControllerAdvice(new ManejadorErroresPrestamo())
                .build();
    }

    @Test
    void idQueNoEsUuidDevuelve400() throws Exception {
        mvc.perform(get("/api/prestamos/no-es-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    void prestamoInexistenteDevuelve404() throws Exception {
        when(servicio.consultar(any())).thenThrow(new PrestamoException(
                PrestamoException.Codigo.PRESTAMO_NO_ENCONTRADO, "El préstamo indicado no existe."));

        mvc.perform(get("/api/prestamos/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("PRESTAMO_NO_ENCONTRADO"));
    }
}