package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.ClienteResumen;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface ClienteResumenRepositorio extends Repository<ClienteResumen, UUID> {

    Optional<ClienteResumen> findById(UUID id);

    /**
     * Bloquea la fila del cliente hasta que termine la transacción. Así, dos registros simultáneos
     * del mismo cliente se ejecutan uno tras otro y el límite no se puede eludir (US-05-CA05).
     * Debe llamarse dentro de una transacción.
     */
    @Query(value = "select * from public.clientes where id = :id for update", nativeQuery = true)
    Optional<ClienteResumen> buscarBloqueando(@Param("id") UUID id);
}