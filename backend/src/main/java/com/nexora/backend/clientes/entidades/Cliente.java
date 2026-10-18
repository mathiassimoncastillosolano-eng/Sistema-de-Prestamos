
package com.nexora.backend.clientes.entidades;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "clientes", schema = "public")
@Getter
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "numero", insertable = false, updatable = false)
    private Long numero;

    @Setter
    @Column(name = "tipo_documento", nullable = false)
    private String tipoDocumento;

    @Setter
    @Column(name = "numero_documento", nullable = false)
    private String numeroDocumento;

    @Setter
    @Column(name = "nombre", nullable = false)
    private String nombre;

    @Setter
    @Column(name = "telefono")
    private String telefono;

    @Setter
    @Column(name = "correo")
    private String correo;

    @Setter
    @Column(name = "dni_titular")
    private String dniTitular;

    @Setter
    @Column(name = "domicilio")
    private String domicilio;

    @Setter
    @Column(name = "estado_sunat")
    private String estadoSunat;

    @Setter
    @Column(name = "condicion_sunat")
    private String condicionSunat;

    @Setter
    @Column(name = "representante_nombre")
    private String representanteNombre;

    @Setter
    @Column(name = "representante_dni")
    private String representanteDni;

    @Column(name = "agencia_id", nullable = false)
    private UUID agenciaId;

    @Column(name = "creado_por", nullable = false)
    private UUID creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    // Constructor requerido por JPA
    protected Cliente() {
    }

    // Constructor para registrar un cliente desde el servicio
    public Cliente(
            String tipoDocumento,
            String numeroDocumento,
            String nombre,
            String telefono,
            String correo,
            String dniTitular,
            String domicilio,
            String estadoSunat,
            String condicionSunat,
            String representanteNombre,
            String representanteDni,
            UUID agenciaId,
            UUID creadoPor) {
        this.tipoDocumento = tipoDocumento;
        this.numeroDocumento = numeroDocumento;
        this.nombre = nombre;
        this.telefono = telefono;
        this.correo = correo;
        this.dniTitular = dniTitular;
        this.domicilio = domicilio;
        this.estadoSunat = estadoSunat;
        this.condicionSunat = condicionSunat;
        this.representanteNombre = representanteNombre;
        this.representanteDni = representanteDni;
        this.agenciaId = agenciaId;
        this.creadoPor = creadoPor;
    }
}