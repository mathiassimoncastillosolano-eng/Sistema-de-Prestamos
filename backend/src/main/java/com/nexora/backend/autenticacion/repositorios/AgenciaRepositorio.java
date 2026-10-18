package com.nexora.backend.autenticacion.repositorios;

import com.nexora.backend.autenticacion.entidades.Agencia;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/** Solo consultas: esta aplicacion no escribe en agencias. */
public interface AgenciaRepositorio extends Repository<Agencia, UUID> {

    Optional<Agencia> findById(UUID id);
}
