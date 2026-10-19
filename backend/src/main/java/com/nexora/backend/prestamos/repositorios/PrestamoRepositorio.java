package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.Prestamo;
import java.math.BigDecimal;
import java.time.LocalDate;
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

    /**
     * Capital que el asesor colocó en esa fecha. Cuentan todos sus préstamos del día, incluso los ya Cancelados
     * (pagados): pagar no devuelve cupo. Un préstamo registrado ya está otorgado; no hay solicitudes pendientes.
     */
    @Query("select coalesce(sum(p.capital), 0) from Prestamo p where p.asesorId = :asesorId and p.fechaDesembolso = :fecha")
    BigDecimal capitalColocado(@Param("asesorId") UUID asesorId, @Param("fecha") LocalDate fecha);

    /**
     * Bloquea la fila del asesor hasta que termine la transacción: dos registros simultáneos del mismo asesor se
     * hacen uno tras otro y el segundo ya ve el capital del primero (límite diario). Debe llamarse dentro de una
     * transacción.
     */
    @Query(value = "select id from public.perfiles where id = :id for update", nativeQuery = true)
    Optional<UUID> bloquearAsesor(@Param("id") UUID asesorId);
}