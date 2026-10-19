package com.nexora.backend.prestamos.servicios;

import com.nexora.backend.prestamos.dominio.EstadoCliente;
import com.nexora.backend.prestamos.repositorios.EstadoClienteRepositorio;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mantiene al día {@code clientes.estado}. El valor siempre sale de {@link EstadoCliente} con las cuotas guardadas y la
 * fecha de Lima; se recalcula y se guarda:
 * <ul>
 *   <li>al registrar un préstamo (dentro de su transacción, con el cliente bloqueado);</li>
 *   <li>al consultar la lista o la ficha de clientes, para que reflejen cambios hechos directamente en la BD;</li>
 *   <li>cada día a las 00:00 de Lima, cuando las cuotas de ayer pasan a vencidas.</li>
 * </ul>
 */
@Service
public class EstadoClienteServicio {

    private static final Logger LOG = LoggerFactory.getLogger(EstadoClienteServicio.class);

    private final PrestamoConsultaServicio consultas;
    private final EstadoClienteRepositorio repositorio;

    public EstadoClienteServicio(PrestamoConsultaServicio consultas, EstadoClienteRepositorio repositorio) {
        this.consultas = consultas;
        this.repositorio = repositorio;
    }

    /** Recalcula y guarda el estado de un cliente. Devuelve el estado vigente. */
    @Transactional
    public String actualizar(UUID clienteId) {
        String estado = consultas.estadoCliente(clienteId);
        repositorio.guardar(clienteId, estado);
        return estado;
    }

    /** Recalcula y guarda el estado de todos los clientes (los que no tienen préstamos quedan ACTIVO). */
    @Transactional
    public int actualizarTodos() {
        Map<UUID, String> estados = consultas.estadosDeClientes();
        int cambios = 0;
        for (UUID clienteId : repositorio.idsDeClientes()) {
            if (repositorio.guardar(clienteId, estados.getOrDefault(clienteId, EstadoCliente.ACTIVO))) {
                cambios++;
            }
        }
        return cambios;
    }

    @Scheduled(cron = "0 0 0 * * *", zone = "America/Lima")
    @Transactional
    public void actualizarCadaDia() {
        LOG.info("Estado de clientes recalculado: {} cambio(s).", actualizarTodos());
    }
}
