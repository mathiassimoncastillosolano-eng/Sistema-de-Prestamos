package com.nexora.backend.cuotas.repositorios;

import com.nexora.backend.cuotas.entidades.Cuota;
import com.nexora.backend.cuotas.entidades.CuotaId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface CuotaRepositorio extends Repository<Cuota, CuotaId> {

    List<Cuota> saveAll(Iterable<Cuota> cuotas);

    /** Para consultar el cronograma de un préstamo, ordenado por número de cuota. */
    List<Cuota> findByIdPrestamoIdOrderByIdNumeroAsc(UUID prestamoId);
}