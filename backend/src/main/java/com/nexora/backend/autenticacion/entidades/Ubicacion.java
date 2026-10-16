package com.nexora.backend.autenticacion.entidades;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Solo lectura: public.ubicaciones. */
@Entity
@Immutable
@Table(name = "ubicaciones", schema = "public")
public class Ubicacion {

    @Id
    private UUID id;

    @Column(name = "departamento", nullable = false)
    private String departamento;

    @Column(name = "provincia", nullable = false)
    private String provincia;

    @Column(name = "distrito", nullable = false)
    private String distrito;

    /** La columna admite NULL. */
    @Column(name = "direccion")
    private String direccion;

    protected Ubicacion() {
        // requerido por JPA
    }

    public UUID getId() { return id; }
    public String getDepartamento() { return departamento; }
    public String getProvincia() { return provincia; }
    public String getDistrito() { return distrito; }
    public String getDireccion() { return direccion; }
}
