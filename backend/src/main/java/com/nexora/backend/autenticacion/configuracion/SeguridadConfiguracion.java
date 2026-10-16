package com.nexora.backend.autenticacion.configuracion;

import com.nexora.backend.autenticacion.servicios.AutenticacionServicio;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * Seguridad de la API: sesion en cookie HttpOnly, CSRF por doble envio (cookie XSRF-TOKEN + cabecera X-XSRF-TOKEN),
 * todo requiere sesion salvo el inicio de sesion, y cualquier ruta fuera de /api se deniega.
 */
@Configuration
@EnableWebSecurity
public class SeguridadConfiguracion {

    /** BCrypt: reconoce los prefijos $2a$, $2b$ e $2y$ (p. ej. el hash que genera crypt(clave, gen_salt('bf')) de pgcrypto). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain cadenaDeSeguridad(
            HttpSecurity http,
            SecurityContextRepository contexto,
            AutenticacionServicio servicio,
            @Value("${server.servlet.session.cookie.secure:true}") boolean cookieSegura,
            @Value("${server.servlet.session.cookie.name:NEXORA_SESION}") String nombreCookieSesion) throws Exception {

        CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse(); // el JS del frontend debe poder leerla
        csrf.setCookieCustomizer(c -> c.path("/").sameSite("Lax").secure(cookieSegura));

        http
                .csrf(c -> c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .securityContext(c -> c.securityContextRepository(contexto))
                .sessionManagement(c -> c.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(c -> c
                        .logoutUrl("/api/auth/logout") // solo POST, con CSRF
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies(nombreCookieSesion)
                        .logoutSuccessHandler((req, res, auth) -> res.setStatus(HttpStatus.NO_CONTENT.value())))
                .authorizeHttpRequests(c -> c
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(c -> c.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .headers(Customizer.withDefaults())
                .addFilterAfter(new CsrfCookieFiltro(), BasicAuthenticationFilter.class)
                .addFilterAfter(new VerificadorSesionFiltro(servicio), CsrfCookieFiltro.class);

        return http.build();
    }
}
