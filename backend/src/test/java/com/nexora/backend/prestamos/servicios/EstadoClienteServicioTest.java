package com.nexora.backend.prestamos.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.prestamos.dominio.EstadoCliente;
import com.nexora.backend.prestamos.repositorios.EstadoClienteRepositorio;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EstadoClienteServicioTest {

    private final PrestamoConsultaServicio consultas = mock(PrestamoConsultaServicio.class);
    private final EstadoClienteRepositorio repositorio = mock(EstadoClienteRepositorio.class);
    private final EstadoClienteServicio servicio = new EstadoClienteServicio(consultas, repositorio);

    @Test
    void actualizar_guarda_y_devuelve_el_estado_calculado() {
        UUID id = UUID.randomUUID();
        when(consultas.estadoCliente(id)).thenReturn(EstadoCliente.MOROSO);

        assertEquals(EstadoCliente.MOROSO, servicio.actualizar(id));
        verify(repositorio).guardar(id, EstadoCliente.MOROSO);
    }

    @Test
    void actualizar_todos_deja_activo_a_quien_no_tiene_prestamos_y_cuenta_solo_los_cambios() {
        UUID moroso = UUID.randomUUID();
        UUID extrajudicial = UUID.randomUUID();
        UUID sinPrestamos = UUID.randomUUID();
        when(consultas.estadosDeClientes()).thenReturn(Map.of(
                moroso, EstadoCliente.MOROSO, extrajudicial, EstadoCliente.EXTRAJUDICIAL));
        when(repositorio.idsDeClientes()).thenReturn(List.of(moroso, extrajudicial, sinPrestamos));
        when(repositorio.guardar(any(), any())).thenReturn(true, false, true);

        assertEquals(2, servicio.actualizarTodos());
        verify(repositorio).guardar(moroso, EstadoCliente.MOROSO);
        verify(repositorio).guardar(extrajudicial, EstadoCliente.EXTRAJUDICIAL);
        verify(repositorio).guardar(sinPrestamos, EstadoCliente.ACTIVO);
    }
}
