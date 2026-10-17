package com.nexora.backend.prestamos.entidades;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/**
 * Solo lectura: public.clientes. Únicamente lo que necesita el registro de préstamos.
 * La regla de "cliente validado" (PQ-09) está pendiente de definir con el equipo:
 * ya no existe estado_validacion; hoy la tabla trae estado_sunat y condicion_sunat.
 */
@Entity
@Immutable
@Table(name = "clientes", schema = "public")
public class ClienteResumen {

    @Id
    private UUID id;

    @Column(name = "nombre", nullable = false)
    private String nombre;

    /** 'DNI' | 'RUC 10' | 'RUC 20'. */
    @Column(name = "tipo_documento", nullable = false)
    private String tipoDocumento;

    @Column(name = "estado_sunat")
    private String estadoSunat;

    @Column(name = "condicion_sunat")
    private String condicionSunat;

    protected ClienteResumen() {
        // requerido por JPA
    }

    public UUID getId() { return id; }
    public String getNombre() { return nombre; }
    public String getTipoDocumento() { return tipoDocumento; }
    public String getEstadoSunat() { return estadoSunat; }
    public String getCondicionSunat() { return condicionSunat; }
}