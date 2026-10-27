package com.nexora.backend.caja.dominio;

import java.math.BigDecimal;

/** Reglas fijas de la caja del asesor y de las reposiciones. Un solo lugar para cambiarlas. */
public final class ReglasCaja {

    /** Máximo de efectivo que puede tener la caja de un asesor (también lo impone un CHECK en la base de datos). */
    public static final BigDecimal LIMITE_CAJA = new BigDecimal("50000.00");
    /** Saldo con el que se abre la caja de un asesor la primera vez. Después el saldo se arrastra entre jornadas. */
    public static final BigDecimal SALDO_APERTURA = LIMITE_CAJA;

    public static final int COMENTARIO_MIN = 10;
    public static final int COMENTARIO_MAX = 1000;
    public static final int JUSTIFICACION_MIN = 10;
    public static final int TEXTO_MAX = 1000;
    public static final int REFERENCIA_MAX = 120;

    /** Intentos de código Hermes fallidos permitidos por reposición y gerente dentro de la ventana. */
    public static final int HERMES_MAX_INTENTOS_FALLIDOS = 5;
    public static final int HERMES_VENTANA_MINUTOS = 15;

    public static final int PAGINA_MAX = 100;

    private ReglasCaja() {
    }
}
