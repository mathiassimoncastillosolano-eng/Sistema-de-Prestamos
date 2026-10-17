package com.nexora.backend.clientes.repositorios;

import com.nexora.backend.clientes.entidades.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ClienteRepositorio extends JpaRepository<Cliente, UUID> {

    Optional<Cliente> findByNumeroDocumento(String numeroDocumento);

    boolean existsByNumeroDocumento(String numeroDocumento);
}