package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import com.nexora.backend.prestamos.dto.CondicionesRespuesta;
import com.nexora.backend.prestamos.dto.SimulacionRespuesta;
import com.nexora.backend.prestamos.servicios.PrestamoConsultaServicio;
import com.nexora.backend.prestamos.servicios.PrestamoServicio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
        mvc = MockMvcBuilders.standaloneSetup(new PrestamoControlador(servicio, mock(PrestamoConsultaServicio.class)))
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

    @Test
    void condicionesDevuelveFechasYReglasDelServidor() throws Exception {
        LocalDate hoy = LocalDate.of(2026, 10, 18);
        when(servicio.condiciones()).thenReturn(new CondicionesRespuesta("PEN", new BigDecimal("0.300000"),
                new BigDecimal("1000.00"), new BigDecimal("10000.00"), 1, 60, "America/Lima", hoy, hoy.plusMonths(1)));

        mvc.perform(get("/api/prestamos/condiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fechaDesembolso").value("2026-10-18"))
                .andExpect(jsonPath("$.fechaPrimerVencimiento").value("2026-11-18"))
                .andExpect(jsonPath("$.plazoMaximoMeses").value(60));
    }

    @Test
    void simulacionDevuelveElCronogramaSinRegistrar() throws Exception {
        LocalDate hoy = LocalDate.of(2026, 10, 18);
        when(servicio.simular(any())).thenReturn(new SimulacionRespuesta("PEN", new BigDecimal("1000.00"), 12,
                new BigDecimal("0.300000"), hoy, hoy.plusMonths(1), new BigDecimal("95.79"), new BigDecimal("149.43"),
                new BigDecimal("1149.43"), List.of()));

        mvc.perform(post("/api/prestamos/simulacion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"capital\":1000,\"plazoMeses\":12}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cuotaMensual").value(95.79))
                .andExpect(jsonPath("$.totalContractual").value(1149.43));
    }

    @Test
    void condicionesDesactualizadasDevuelve409() throws Exception {
        when(servicio.registrar(any(), any())).thenThrow(new PrestamoException(
                PrestamoException.Codigo.CONDICIONES_DESACTUALIZADAS, "Las condiciones cambiaron."));

        mvc.perform(post("/api/prestamos")
                        .requestAttr("nexora.perfil", mock(Perfil.class))
                        .contentType(MediaType.APPLICATION_JSON).content(JSON_OK))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONDICIONES_DESACTUALIZADAS"));
    }
}
