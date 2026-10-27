package com.nexora.backend.caja.servicios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Validaciones de entrada compartidas. Todo se valida en el servidor; nada de lo que llega del navegador se da por bueno. */
final class Validaciones {

    private static final BigDecimal MAXIMO = new BigDecimal("999999999999.99");

    private Validaciones() {
    }

    /** Importe positivo con a lo sumo 2 decimales, normalizado a escala 2. */
    static BigDecimal importePositivo(BigDecimal valor, String campo) {
        if (valor == null) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica " + campo + ".");
        }
        if (valor.stripTrailingZeros().scale() > 2) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, campo.substring(0, 1).toUpperCase() + campo.substring(1)
                    + " admite como máximo 2 decimales.");
        }
        BigDecimal n = valor.setScale(2, RoundingMode.UNNECESSARY);
        if (n.signum() <= 0) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, campo.substring(0, 1).toUpperCase() + campo.substring(1)
                    + " debe ser mayor que cero.");
        }
        if (n.compareTo(MAXIMO) > 0) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "El importe indicado no es válido.");
        }
        return n;
    }

    /** Importe >= 0 con a lo sumo 2 decimales. */
    static BigDecimal importeNoNegativo(BigDecimal valor, String campo) {
        if (valor == null) {
            throw new CajaException(Codigo.DATOS_INVALIDOS, "Indica " + campo + ".");
        }
        if (valor.signum() == 0) return BigDecimal.ZERO.setScale(2);
        return importePositivo(valor, campo);
    }

    /** Texto obligatorio, recortado, con largo mínimo y máximo. */
    static String textoObligatorio(String valor, String campo, int minimo, int maximo) {
        String t = valor == null ? "" : valor.trim();
        if (t.length() < minimo) {
            throw new CajaException(Codigo.DATOS_INVALIDOS,
                    "Escribe " + campo + " (mínimo " + minimo + " caracteres).");
        }
        if (t.length() > maximo) {
            throw new CajaException(Codigo.DATOS_INVALIDOS,
                    "El texto de " + campo + " no puede superar " + maximo + " caracteres.");
        }
        return t;
    }

    /** Texto opcional: null si está vacío; falla si supera el máximo. */
    static String textoOpcional(String valor, String campo, int maximo) {
        if (valor == null || valor.isBlank()) return null;
        String t = valor.trim();
        if (t.length() > maximo) {
            throw new CajaException(Codigo.DATOS_INVALIDOS,
                    "El texto de " + campo + " no puede superar " + maximo + " caracteres.");
        }
        return t;
    }

    static String clave(String valor) {
        if (valor == null || !valor.matches("[A-Za-z0-9_-]{8,64}")) {
            throw new CajaException(Codigo.DATOS_INVALIDOS,
                    "Falta la clave de la operación (se genera sola en la pantalla). Recarga e inténtalo de nuevo.");
        }
        return valor;
    }

    static void exigirAsesor(Perfil p) {
        if (p == null || !"asesor".equals(p.getRol()) || p.getAgencia() == null) {
            throw new CajaException(Codigo.SIN_PERMISO, "Solo un asesor con agencia asignada tiene caja.");
        }
    }

    static void exigirGerencia(Perfil p) {
        if (p == null || !"gerencia".equals(p.getRol())) {
            throw new CajaException(Codigo.SIN_PERMISO, "Solo gerencia puede realizar esta acción.");
        }
    }

    static String soles(BigDecimal importe) {
        return String.format(java.util.Locale.US, "S/ %,.2f", importe);
    }
}
