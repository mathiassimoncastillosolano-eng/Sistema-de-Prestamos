package com.nexora.backend.prestamos.controladores;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.servicios.PrestamoConsultaServicio;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PrestamoControladorConsultaTest {

    private PrestamoConsultaServicio servicio;
    private MockMvc mvc;

    @BeforeEach
    void preparar() {
        servicio = mock(PrestamoConsultaServicio.class);
        mvc = MockMvcBuilders.standaloneSetup(new PrestamoControlador(mock(PrestamoServicio.class), servicio))
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
        when(servicio.detalle(any())).thenThrow(new PrestamoException(
                PrestamoException.Codigo.PRESTAMO_NO_ENCONTRADO, "El préstamo indicado no existe."));

        mvc.perform(get("/api/prestamos/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("PRESTAMO_NO_ENCONTRADO"));
    }

    @Test
    void listarPorClienteDevuelveLosPrestamosDelCliente() throws Exception {
        UUID clienteId = UUID.randomUUID();
        when(servicio.listarPorCliente(clienteId)).thenReturn(List.of());

        mvc.perform(get("/api/prestamos").param("clienteId", clienteId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void listarConClienteQueNoEsUuidDevuelve400() throws Exception {
        mvc.perform(get("/api/prestamos").param("clienteId", "no-es-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }
}
