package com.nexora.backend.prestamos.repositorios;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Escritura de {@code clientes.estado}. Solo lo usa EstadoClienteServicio; ninguna otra pieza escribe esa columna. */
@Repository
public class EstadoClienteRepositorio {

    private final JdbcTemplate jdbc;

    public EstadoClienteRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Ids de todos los clientes, ordenados: las filas se actualizan siempre en el mismo orden (sin interbloqueos). */
    public List<UUID> idsDeClientes() {
        return jdbc.query("select id from public.clientes order by id", (rs, i) -> rs.getObject("id", UUID.class));
    }

    /** Guarda el estado solo si cambió; devuelve true si se escribió la fila. */
    public boolean guardar(UUID clienteId, String estado) {
        return jdbc.update("update public.clientes set estado = ? where id = ? and estado is distinct from ?",
                estado, clienteId, estado) > 0;
    }
}
