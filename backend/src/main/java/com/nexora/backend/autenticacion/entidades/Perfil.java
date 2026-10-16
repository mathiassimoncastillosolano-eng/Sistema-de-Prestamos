package com.nexora.backend.autenticacion.entidades;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/**
 * Solo lectura: public.perfiles. {@code claveHash} nunca sale del servidor: no esta en ningun DTO
 * ni en ningun log (por eso tampoco hay toString()).
 */
@Entity
@Immutable
@Table(name = "perfiles", schema = "public")
public class Perfil {

    @Id
    private UUID id;

    @Column(name = "nombres", nullable = false)
    private String nombres;

    @Column(name = "apellidos", nullable = false)
    private String apellidos;

    @Column(name = "correo", nullable = false)
    private String correo;

    /** Valores persistidos: 'asesor' | 'gerencia' (CHECK perfiles_rol_ck). */
    @Column(name = "rol", nullable = false)
    private String rol;

    /** NULL permitido (gerencia). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agencia_id")
    private Agencia agencia;

    @Column(name = "activo", nullable = false)
    private boolean activo;

    @Column(name = "clave_hash", nullable = false)
    private String claveHash;

    protected Perfil() {
        // requerido por JPA
    }

    public UUID getId() { return id; }
    public String getNombres() { return nombres; }
    public String getApellidos() { return apellidos; }
    public String getCorreo() { return correo; }
    public String getRol() { return rol; }
    public Agencia getAgencia() { return agencia; }
    public boolean isActivo() { return activo; }
    public String getClaveHash() { return claveHash; }
}
