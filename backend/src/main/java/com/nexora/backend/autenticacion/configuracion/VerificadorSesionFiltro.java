package com.nexora.backend.autenticacion.configuracion;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.autenticacion.servicios.AutenticacionServicio;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * En CADA peticion autenticada vuelve a leer el perfil en la base de datos. Si el perfil se desactivo,
 * cambio de rol, se quedo sin agencia valida o desaparecio, la sesion se revoca en ese momento.
 * El rol que cuenta es siempre el de la base de datos, nunca uno enviado por el cliente.
 * NO es un bean (ver CsrfCookieFiltro).
 */
final class VerificadorSesionFiltro extends OncePerRequestFilter {

    static final String ATRIBUTO_PERFIL = "nexora.perfil";

    private final AutenticacionServicio servicio;

    VerificadorSesionFiltro(AutenticacionServicio servicio) {
        this.servicio = servicio;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion != null && autenticacion.isAuthenticated() && !(autenticacion instanceof AnonymousAuthenticationToken)) {
            Optional<Perfil> vigente = Optional.empty();
            try {
                vigente = servicio.perfilVigente(UUID.fromString(autenticacion.getName()), rolDe(autenticacion));
            } catch (IllegalArgumentException e) {
                // identificador de sesion con formato inesperado: se revoca
            }
            if (vigente.isPresent()) {
                request.setAttribute(ATRIBUTO_PERFIL, vigente.get());
            } else {
                revocar(request);
            }
        }
        chain.doFilter(request, response);
    }

    private static String rolDe(Authentication a) {
        for (GrantedAuthority g : a.getAuthorities()) {
            String s = g.getAuthority();
            if (s != null && s.startsWith("ROLE_")) return s.substring(5).toLowerCase(Locale.ROOT);
        }
        return "";
    }

    private static void revocar(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession sesion = request.getSession(false);
        if (sesion != null) sesion.invalidate();
    }
}
