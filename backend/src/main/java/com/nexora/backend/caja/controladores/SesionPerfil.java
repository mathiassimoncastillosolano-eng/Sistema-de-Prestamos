package com.nexora.backend.caja.controladores;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import jakarta.servlet.http.HttpServletRequest;

/** Perfil de la sesión, tal como lo dejó el filtro de sesión (releído de la base de datos en cada petición). */
final class SesionPerfil {

    private static final String ATRIBUTO_PERFIL = "nexora.perfil";

    private SesionPerfil() {
    }

    static Perfil de(HttpServletRequest request) {
        Object atributo = request.getAttribute(ATRIBUTO_PERFIL);
        if (!(atributo instanceof Perfil perfil)) {
            throw new CajaException(Codigo.SIN_PERMISO, "No se pudo identificar al usuario de la sesión.");
        }
        return perfil;
    }
}
