package com.nexora.backend.autenticacion.servicios;

import com.nexora.backend.autenticacion.dto.SesionRespuesta;
import com.nexora.backend.autenticacion.dto.SesionRespuesta.AgenciaDto;
import com.nexora.backend.autenticacion.dto.SesionRespuesta.PerfilDto;
import com.nexora.backend.autenticacion.dto.SesionRespuesta.UbicacionDto;
import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.autenticacion.entidades.Ubicacion;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException.Codigo;
import com.nexora.backend.autenticacion.repositorios.PerfilRepositorio;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifica credenciales contra perfiles.clave_hash (BCrypt) y decide si un perfil puede tener sesion.
 * Las contrasenas nunca se registran ni se devuelven.
 */
@Service
public class AutenticacionServicio {

    private static final Logger LOG = LoggerFactory.getLogger(AutenticacionServicio.class);

    /** Valores EXACTOS del CHECK perfiles_rol_ck. */
    public static final Set<String> ROLES_VALIDOS = Set.of("asesor", "gerencia");

    private final PerfilRepositorio perfiles;
    private final PasswordEncoder encoder;
    private final LimitadorIntentos limitador;
    /** Hash de una clave aleatoria: iguala el tiempo de respuesta cuando el correo no existe. */
    private final String hashSenuelo;

    public AutenticacionServicio(PerfilRepositorio perfiles, PasswordEncoder encoder, LimitadorIntentos limitador) {
        this.perfiles = perfiles;
        this.encoder = encoder;
        this.limitador = limitador;
        this.hashSenuelo = encoder.encode(UUID.randomUUID().toString());
    }

    public static String normalizarCorreo(String correo) {
        return correo == null ? "" : correo.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Comprueba correo + contrasena y, solo si son correctas, que el perfil pueda acceder.
     * El estado de la cuenta (desactivada, agencia inactiva...) solo se revela tras acertar la contrasena,
     * para no permitir averiguar que correos existen.
     */
    @Transactional(readOnly = true)
    public Perfil verificarCredenciales(String correoEntrada, String clave) {
        String correo = normalizarCorreo(correoEntrada);
        limitador.verificarNoBloqueado(correo);

        List<Perfil> encontrados = perfiles.buscarPorCorreo(correo);
        Perfil perfil = encontrados.size() == 1 ? encontrados.get(0) : null;

        boolean coincide = coincide(clave, perfil != null ? perfil.getClaveHash() : hashSenuelo);
        if (perfil == null || !coincide) {
            limitador.registrarFallo(correo);
            throw new AutenticacionException(Codigo.CREDENCIALES_INVALIDAS);
        }
        limitador.reiniciar(correo);

        Codigo bloqueo = motivoDeBloqueo(perfil);
        if (bloqueo != null) {
            if (bloqueo == Codigo.ROL_NO_RECONOCIDO) {
                LOG.warn("Perfil {} con rol no reconocido: acceso denegado", perfil.getId());
            }
            throw new AutenticacionException(bloqueo);
        }
        return perfil;
    }

    /** Perfil que puede seguir usando una sesion ya abierta; vacio si hay que revocarla. */
    @Transactional(readOnly = true)
    public Optional<Perfil> perfilVigente(UUID id, String rolEnSesion) {
        return perfiles.buscarPorId(id)
                .filter(p -> motivoDeBloqueo(p) == null)
                .filter(p -> p.getRol().equals(rolEnSesion));
    }

    /** null = puede acceder. */
    Codigo motivoDeBloqueo(Perfil p) {
        if (!p.isActivo()) return Codigo.CUENTA_DESACTIVADA;
        if (p.getRol() == null || !ROLES_VALIDOS.contains(p.getRol())) return Codigo.ROL_NO_RECONOCIDO;
        Agencia agencia = p.getAgencia();
        if ("asesor".equals(p.getRol())) {
            if (agencia == null) return Codigo.AGENCIA_NO_ASIGNADA;
            if (!agencia.isActiva()) return Codigo.AGENCIA_INACTIVA;
        }
        // gerencia: agencia_id puede ser NULL; si tiene agencia inactiva sigue pudiendo entrar (solo se informa en la interfaz).
        return null;
    }

    public SesionRespuesta aSesion(Perfil p) {
        Agencia a = p.getAgencia();
        PerfilDto perfil = new PerfilDto(p.getId(), p.getNombres(), p.getApellidos(), p.getCorreo(), p.getRol(),
                a != null ? a.getId() : null, p.isActivo());
        AgenciaDto agencia = null;
        if (a != null) {
            Ubicacion u = a.getUbicacion();
            agencia = new AgenciaDto(a.getId(), a.getNombre(), a.isActiva(),
                    new UbicacionDto(u.getDepartamento(), u.getProvincia(), u.getDistrito(), u.getDireccion()));
        }
        return new SesionRespuesta(perfil, agencia);
    }

    private boolean coincide(String clave, String hash) {
        try {
            return clave != null && hash != null && encoder.matches(clave, hash);
        } catch (RuntimeException e) {
            return false; // hash con formato inesperado o clave inadmisible: se trata como credencial incorrecta
        }
    }
}
