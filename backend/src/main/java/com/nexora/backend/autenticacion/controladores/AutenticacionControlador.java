package com.nexora.backend.autenticacion.controladores;

import com.nexora.backend.autenticacion.dto.LoginSolicitud;
import com.nexora.backend.autenticacion.dto.SesionRespuesta;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException.Codigo;
import com.nexora.backend.autenticacion.servicios.AutenticacionServicio;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Locale;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** POST /api/auth/login · GET /api/auth/me · POST /api/auth/logout (este ultimo lo gestiona Spring Security). */
@RestController
@RequestMapping("/api/auth")
public class AutenticacionControlador {

    /** Mismo nombre que usa VerificadorSesionFiltro para dejar el perfil ya validado en la peticion. */
    private static final String ATRIBUTO_PERFIL = "nexora.perfil";

    private final AutenticacionServicio servicio;
    private final SecurityContextRepository contexto;

    public AutenticacionControlador(AutenticacionServicio servicio, SecurityContextRepository contexto) {
        this.servicio = servicio;
        this.contexto = contexto;
    }

    @PostMapping("/login")
    public ResponseEntity<SesionRespuesta> login(
            @Valid @RequestBody LoginSolicitud solicitud, HttpServletRequest request, HttpServletResponse response) {

        Perfil perfil = servicio.verificarCredenciales(solicitud.correo(), solicitud.clave());

        // Anti fijacion de sesion: si el navegador ya traia una sesion, se le cambia el identificador.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }

        List<GrantedAuthority> permisos = List.of(new SimpleGrantedAuthority("ROLE_" + perfil.getRol().toUpperCase(Locale.ROOT)));
        Authentication autenticacion = UsernamePasswordAuthenticationToken.authenticated(perfil.getId().toString(), null, permisos);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(autenticacion);
        SecurityContextHolder.setContext(ctx);
        contexto.saveContext(ctx, request, response); // crea la sesion y emite la cookie HttpOnly

        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.aSesion(perfil));
    }

    /** Sesion vigente. El filtro de verificacion ya reconsulto el perfil en esta misma peticion. */
    @GetMapping("/me")
    public ResponseEntity<SesionRespuesta> me(HttpServletRequest request) {
        Object perfil = request.getAttribute(ATRIBUTO_PERFIL);
        if (!(perfil instanceof Perfil p)) {
            throw new AutenticacionException(Codigo.NO_AUTENTICADO);
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.aSesion(p));
    }
}
