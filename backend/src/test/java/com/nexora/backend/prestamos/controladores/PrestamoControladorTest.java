package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.prestamos.dominio.LimiteDiarioAsesor;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
                new BigDecimal("1000.00"), new BigDecimal("10000.00"), 1, 60, "America/Lima", hoy, hoy.plusDays(29)));

        mvc.perform(get("/api/prestamos/condiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fechaDesembolso").value("2026-10-18"))
                .andExpect(jsonPath("$.fechaPrimerVencimiento").value("2026-11-16"))
                .andExpect(jsonPath("$.plazoMaximoMeses").value(60));
    }

    @Test
    void simulacionDevuelveElCronogramaSinRegistrar() throws Exception {
        LocalDate hoy = LocalDate.of(2026, 10, 18);
        when(servicio.simular(any())).thenReturn(new SimulacionRespuesta("PEN", new BigDecimal("1000.00"), 12,
                new BigDecimal("0.300000"), hoy, hoy.plusDays(29), new BigDecimal("95.79"), new BigDecimal("149.43"),
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

    @Test
    void limiteDiarioUsaElAsesorDeLaSesion() throws Exception {
        Perfil asesor = mock(Perfil.class);
        when(servicio.limiteDiario(asesor)).thenReturn(
                LimiteDiarioAsesor.de(LocalDate.of(2026, 10, 19), new BigDecimal("49500.00")));

        mvc.perform(get("/api/prestamos/limite-diario").requestAttr("nexora.perfil", asesor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.limite").value(50000.00))
                .andExpect(jsonPath("$.colocadoHoy").value(49500.00))
                .andExpect(jsonPath("$.disponible").value(500.00))
                .andExpect(jsonPath("$.capitalMinimo").value(1000.00))
                .andExpect(jsonPath("$.fecha").value("2026-10-19"));
    }

    @Test
    void limiteDiarioSinSesionDevuelve403() throws Exception {
        mvc.perform(get("/api/prestamos/limite-diario"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("SIN_PERMISO"));
        verify(servicio, never()).limiteDiario(any());
    }

    @Test
    void limiteDiarioExcedidoDevuelve422ConLosImportes() throws Exception {
        when(servicio.registrar(any(), any())).thenThrow(new PrestamoException(
                PrestamoException.Codigo.LIMITE_DIARIO_EXCEDIDO, "Superarías tu límite diario.",
                Map.of("limite", 50000, "colocadoHoy", 45000, "disponible", 5000, "solicitado", 5000.01)));

        mvc.perform(post("/api/prestamos")
                        .requestAttr("nexora.perfil", mock(Perfil.class))
                        .contentType(MediaType.APPLICATION_JSON).content(JSON_OK))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("LIMITE_DIARIO_EXCEDIDO"))
                .andExpect(jsonPath("$.detalle.colocadoHoy").value(45000))
                .andExpect(jsonPath("$.detalle.disponible").value(5000));
    }
}
