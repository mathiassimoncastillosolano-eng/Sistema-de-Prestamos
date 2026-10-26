package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.ClienteResumen;
import java.util.List;
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

    /**
     * Bloquea al cliente Y a todo su grupo crediticio (DNI y sus RUC 10, ver GrupoCrediticioSql) hasta que termine la
     * transacción, siempre en orden de id. Debe llamarse ANTES de leer la deuda y antes que cualquier otro bloqueo de fila
     * de cliente: así dos registros del mismo grupo (por el DNI o por el RUC 10) se hacen uno tras otro y el segundo ya ve la
     * deuda del primero. Devuelve los ids bloqueados (vacío si el cliente no existe).
     */
    @Query(value = GrupoCrediticioSql.BLOQUEAR, nativeQuery = true)
    List<UUID> bloquearGrupo(@Param("id") UUID id);
}
