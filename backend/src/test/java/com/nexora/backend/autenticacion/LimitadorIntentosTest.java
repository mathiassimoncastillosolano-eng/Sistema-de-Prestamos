package com.nexora.backend.autenticacion;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nexora.backend.autenticacion.excepciones.AutenticacionException;
import com.nexora.backend.autenticacion.servicios.LimitadorIntentos;
import org.junit.jupiter.api.Test;

class LimitadorIntentosTest {

    @Test
    void bloqueaTrasAlcanzarElMaximoYSeReiniciaConUnAcierto() {
        LimitadorIntentos l = new LimitadorIntentos(3, 15, 15);
        for (int i = 0; i < 2; i++) l.registrarFallo("a@b.co");
        assertThatCode(() -> l.verificarNoBloqueado("a@b.co")).doesNotThrowAnyException();
        l.registrarFallo("a@b.co");
        assertThatThrownBy(() -> l.verificarNoBloqueado("a@b.co"))
                .isInstanceOf(AutenticacionException.class)
                .extracting(e -> ((AutenticacionException) e).getCodigo().name()).isEqualTo("DEMASIADOS_INTENTOS");
        assertThatCode(() -> l.verificarNoBloqueado("otro@b.co")).doesNotThrowAnyException();
        l.reiniciar("a@b.co");
        assertThatCode(() -> l.verificarNoBloqueado("a@b.co")).doesNotThrowAnyException();
    }
}
