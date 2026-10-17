package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.Prestamo;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface PrestamoRepositorio extends Repository<Prestamo, UUID> {

    Prestamo save(Prestamo prestamo);

    /** Capital de los préstamos activos del cliente en TODAS las agencias (vacío si no tiene). */
    @Query("select sum(p.capital) from Prestamo p where p.clienteId = :clienteId and p.estado = 'activo'")
    Optional<BigDecimal> sumarCapitalActivo(@Param("clienteId") UUID clienteId);

    /** El número lo genera la BD (identity); se lee después de insertar. */
    @Query("select p.numero from Prestamo p where p.id = :id")
    Long obtenerNumero(@Param("id") UUID id);
}