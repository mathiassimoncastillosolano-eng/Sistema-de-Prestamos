package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.Prestamo;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface PrestamoRepositorio extends Repository<Prestamo, UUID> {

    Prestamo save(Prestamo prestamo);
}