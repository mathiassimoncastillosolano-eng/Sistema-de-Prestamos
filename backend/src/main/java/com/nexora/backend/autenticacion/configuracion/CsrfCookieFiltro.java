package com.nexora.backend.autenticacion.configuracion;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fuerza la emision de la cookie XSRF-TOKEN en cada peticion (incluso las que terminan en 401),
 * para que el frontend siempre pueda enviarla de vuelta en la cabecera X-XSRF-TOKEN.
 * NO es un bean: se registra solo dentro de la cadena de Spring Security (si fuera @Component,
 * Spring Boot lo registraria tambien como filtro del contenedor y OncePerRequestFilter lo saltaria aqui).
 */
final class CsrfCookieFiltro extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token != null) {
            token.getToken(); // materializa el token diferido y escribe la cookie
        }
        chain.doFilter(request, response);
    }
}
