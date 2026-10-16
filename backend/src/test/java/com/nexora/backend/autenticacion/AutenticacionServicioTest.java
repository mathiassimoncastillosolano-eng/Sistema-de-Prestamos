package com.nexora.backend.autenticacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException;
import com.nexora.backend.autenticacion.repositorios.PerfilRepositorio;
import com.nexora.backend.autenticacion.servicios.AutenticacionServicio;
import com.nexora.backend.autenticacion.servicios.LimitadorIntentos;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Sin contexto de Spring ni base de datos: repositorio simulado con Mockito. */
class AutenticacionServicioTest {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private PerfilRepositorio repo;
    private AutenticacionServicio servicio;

    @BeforeEach
    void preparar() {
        repo = mock(PerfilRepositorio.class);
        servicio = new AutenticacionServicio(repo, encoder, new LimitadorIntentos(5, 15, 15));
    }

    private Perfil perfil(String rol, boolean activo, Agencia agencia) {
        Perfil p = mock(Perfil.class);
        when(p.getId()).thenReturn(UUID.randomUUID());
        when(p.getRol()).thenReturn(rol);
        when(p.isActivo()).thenReturn(activo);
        when(p.getAgencia()).thenReturn(agencia);
        when(p.getClaveHash()).thenReturn(encoder.encode("clave-de-prueba"));
        return p;
    }

    private Agencia agencia(boolean activa) {
        Agencia a = mock(Agencia.class);
        when(a.isActiva()).thenReturn(activa);
        return a;
    }

    private String codigo(Throwable t) { return ((AutenticacionException) t).getCodigo().name(); }

    @Test
    void credencialesCorrectasDevuelvenElPerfil() {
        Perfil p = perfil("asesor", true, agencia(true));
        when(repo.buscarPorCorreo("a@b.co")).thenReturn(List.of(p));
        assertThat(servicio.verificarCredenciales("  A@B.co ", "clave-de-prueba")).isSameAs(p);
    }

    @Test
    void claveIncorrectaYCorreoInexistenteDanElMismoError() {
        when(repo.buscarPorCorreo("a@b.co")).thenReturn(List.of(perfil("asesor", true, agencia(true))));
        when(repo.buscarPorCorreo("x@b.co")).thenReturn(List.of());
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "mala")).satisfies(t -> assertThat(codigo(t)).isEqualTo("CREDENCIALES_INVALIDAS"));
        assertThatThrownBy(() -> servicio.verificarCredenciales("x@b.co", "mala")).satisfies(t -> assertThat(codigo(t)).isEqualTo("CREDENCIALES_INVALIDAS"));
    }

    @Test
    void elEstadoDeLaCuentaSoloSeRevelaTrasAcertarLaClave() {
        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(perfil("asesor", false, agencia(true))));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "mala")).satisfies(t -> assertThat(codigo(t)).isEqualTo("CREDENCIALES_INVALIDAS"));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "clave-de-prueba")).satisfies(t -> assertThat(codigo(t)).isEqualTo("CUENTA_DESACTIVADA"));
    }

    @Test
    void reglasDeAcceso() {
        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(perfil("auditor", true, null)));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "clave-de-prueba")).satisfies(t -> assertThat(codigo(t)).isEqualTo("ROL_NO_RECONOCIDO"));

        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(perfil("asesor", true, null)));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "clave-de-prueba")).satisfies(t -> assertThat(codigo(t)).isEqualTo("AGENCIA_NO_ASIGNADA"));

        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(perfil("asesor", true, agencia(false))));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "clave-de-prueba")).satisfies(t -> assertThat(codigo(t)).isEqualTo("AGENCIA_INACTIVA"));

        Perfil gerencia = perfil("gerencia", true, null); // agencia_id NULL es válido para gerencia
        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(gerencia));
        assertThat(servicio.verificarCredenciales("g@b.co", "clave-de-prueba")).isSameAs(gerencia);
    }

    @Test
    void unHashQueNoEsBcryptSeTrataComoCredencialIncorrecta() {
        Perfil p = perfil("asesor", true, agencia(true));
        when(p.getClaveHash()).thenReturn("texto-plano-no-valido");
        when(repo.buscarPorCorreo(anyString())).thenReturn(List.of(p));
        assertThatThrownBy(() -> servicio.verificarCredenciales("a@b.co", "texto-plano-no-valido")).satisfies(t -> assertThat(codigo(t)).isEqualTo("CREDENCIALES_INVALIDAS"));
    }

    @Test
    void laSesionSeRevocaSiCambiaElRolOSeDesactiva() {
        UUID id = UUID.randomUUID();
        when(repo.buscarPorId(id)).thenReturn(java.util.Optional.of(perfil("asesor", true, agencia(true))));
        assertThat(servicio.perfilVigente(id, "asesor")).isPresent();
        assertThat(servicio.perfilVigente(id, "gerencia")).isEmpty();
        when(repo.buscarPorId(id)).thenReturn(java.util.Optional.of(perfil("asesor", false, agencia(true))));
        assertThat(servicio.perfilVigente(id, "asesor")).isEmpty();
    }
}
