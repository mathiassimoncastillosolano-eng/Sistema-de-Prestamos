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

/** Solo lectura: public.agencias. */
@Entity
@Immutable
@Table(name = "agencias", schema = "public")
public class Agencia {

    @Id
    private UUID id;

    @Column(name = "nombre", nullable = false)
    private String nombre;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ubicacion_id", nullable = false)
    private Ubicacion ubicacion;

    @Column(name = "activa", nullable = false)
    private boolean activa;

    protected Agencia() {
        // requerido por JPA
    }

    public UUID getId() { return id; }
    public String getNombre() { return nombre; }
    public Ubicacion getUbicacion() { return ubicacion; }
    public boolean isActiva() { return activa; }
}
