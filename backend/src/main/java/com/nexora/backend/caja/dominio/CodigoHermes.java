package com.nexora.backend.caja.dominio;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Código de autorización Hermes: exactamente ocho dígitos. Que tenga ocho dígitos NO lo hace válido: solo el verificador
 * oficial de Hermes (puerto HermesVerificador) puede decirlo. Este tipo solo comprueba el formato y calcula la huella con
 * la que se evita aceptar dos veces el mismo código, sin guardar nunca el código.
 */
public final class CodigoHermes {

    private CodigoHermes() {
    }

    public static boolean formatoValido(String codigo) {
        if (codigo == null || codigo.length() != 8) return false;
        for (int i = 0; i < 8; i++) {
            char c = codigo.charAt(i);
            if (c < '0' || c > '9') return false; // solo ASCII 0-9 (no dígitos Unicode)
        }
        return true;
    }

    /** HMAC-SHA256 del código con un secreto del servidor, en hexadecimal (64 caracteres). */
    public static String huella(String codigo, String secreto) {
        if (secreto == null || secreto.isBlank()) {
            throw new IllegalStateException("Falta el secreto para la huella de Hermes.");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(codigo.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("No se pudo calcular la huella de Hermes.", e);
        }
    }
}
