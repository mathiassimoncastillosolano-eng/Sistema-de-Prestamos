package com.nexora.backend.prestamos.repositorios;

import com.nexora.backend.prestamos.entidades.ClienteResumen;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface ClienteResumenRepositorio extends Repository<ClienteResumen, UUID> {

    Optional<ClienteResumen> findById(UUID id);
}