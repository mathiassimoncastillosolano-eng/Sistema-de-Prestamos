package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.Prestamo;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface PrestamoRepositorio extends Repository<Prestamo, UUID> {

    Prestamo save(Prestamo prestamo);
    Optional<Prestamo> findById(UUID id);

    /** Préstamos del cliente en todas las agencias, del más reciente al más antiguo. */
    List<Prestamo> findByClienteIdOrderByFechaDesembolsoDescNumeroDesc(UUID clienteId);

    /** El número lo genera la BD (identity); se lee después de insertar. */
    @Query("select p.numero from Prestamo p where p.id = :id")
    Long obtenerNumero(@Param("id") UUID id);
}