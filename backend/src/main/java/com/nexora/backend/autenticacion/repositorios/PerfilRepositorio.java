package com.nexora.backend.autenticacion.repositorios;

import com.nexora.backend.autenticacion.entidades.Perfil;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Solo consultas: esta aplicacion no escribe en perfiles. La agencia y su ubicacion se traen en la misma consulta. */
public interface PerfilRepositorio extends Repository<Perfil, UUID> {

    @Query("""
            select p from Perfil p
            left join fetch p.agencia a
            left join fetch a.ubicacion
            where lower(p.correo) = :correo
            """)
    List<Perfil> buscarPorCorreo(@Param("correo") String correoEnMinusculas);

    @Query("""
            select p from Perfil p
            left join fetch p.agencia a
            left join fetch a.ubicacion
            where p.id = :id
            """)
    Optional<Perfil> buscarPorId(@Param("id") UUID id);
}
