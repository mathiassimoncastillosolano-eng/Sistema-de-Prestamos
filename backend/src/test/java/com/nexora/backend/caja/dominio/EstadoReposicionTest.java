package com.nexora.backend.caja.dominio;

import static com.nexora.backend.caja.dominio.EstadoReposicion.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class EstadoReposicionTest {

    @Test
    void el_camino_feliz_es_valido() {
        assertTrue(PENDIENTE_APROBACION.puedePasarA(APROBADA));
        assertTrue(APROBADA.puedePasarA(EN_TRANSITO));
        assertTrue(EN_TRANSITO.puedePasarA(RECEPCION_PARCIAL));
        assertTrue(RECEPCION_PARCIAL.puedePasarA(RECEPCION_PARCIAL));
        assertTrue(RECEPCION_PARCIAL.puedePasarA(RECIBIDA));
        assertTrue(RECIBIDA.puedePasarA(COMPLETADA));
    }

    @Test
    void los_estados_finales_no_salen() {
        for (EstadoReposicion final_ : new EstadoReposicion[] {COMPLETADA, RECHAZADA, CANCELADA}) {
            assertTrue(final_.esFinal());
            for (EstadoReposicion destino : values()) {
                assertFalse(final_.puedePasarA(destino), final_ + " -> " + destino);
            }
        }
    }

    @Test
    void no_se_puede_conciliar_ni_recibir_sin_aprobar() {
        assertFalse(PENDIENTE_APROBACION.puedePasarA(RECIBIDA));
        assertFalse(PENDIENTE_APROBACION.puedePasarA(COMPLETADA));
        assertFalse(OBSERVADA.puedePasarA(APROBADA));          // una observada vuelve a pendiente antes de aprobarse
        assertFalse(APROBADA.puedePasarA(COMPLETADA));
        assertFalse(EN_TRANSITO.puedePasarA(COMPLETADA));
        assertFalse(RECEPCION_PARCIAL.puedePasarA(CANCELADA));  // ya entró dinero: no se cancela
    }

    @Test
    void solo_aprobadas_en_transito_y_parciales_admiten_recepcion_y_reservan_capacidad() {
        for (EstadoReposicion e : values()) {
            boolean esperado = e == APROBADA || e == EN_TRANSITO || e == RECEPCION_PARCIAL;
            assertEquals(esperado, e.admiteRecepcion(), e.name());
            assertEquals(esperado, e.reservaCapacidad(), e.name());
        }
    }

    @Test
    void abiertas_son_las_que_bloquean_una_nueva_solicitud() {
        assertTrue(PENDIENTE_APROBACION.abierta());
        assertTrue(OBSERVADA.abierta());
        assertTrue(RECEPCION_PARCIAL.abierta());
        assertFalse(RECIBIDA.abierta());
        assertFalse(COMPLETADA.abierta());
        assertFalse(RECHAZADA.abierta());
        assertFalse(CANCELADA.abierta());
    }

    @Test
    void de_acepta_solo_nombres_exactos() {
        assertEquals(Optional.of(APROBADA), EstadoReposicion.de(" APROBADA "));
        assertEquals(Optional.empty(), EstadoReposicion.de("aprobada"));
        assertEquals(Optional.empty(), EstadoReposicion.de(null));
        assertEquals(Optional.empty(), EstadoReposicion.de("OTRO"));
    }
}
