package com.nexora.backend.prestamos.entidades;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;

/** public.prestamos. Se crea una sola vez (BR-PRE-07: sin edición libre), por eso no hay setters. */
@Entity
@Table(name = "prestamos", schema = "public")
public class Prestamo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Identity generado por la BD (arranca en 1001). Solo lectura desde Java. */
    @Column(name = "numero", insertable = false, updatable = false)
    private Long numero;

    @Column(name = "cliente_id", nullable = false, updatable = false)
    private UUID clienteId;

    @Column(name = "agencia_id", nullable = false, updatable = false)
    private UUID agenciaId;

    @Column(name = "asesor_id", nullable = false, updatable = false)
    private UUID asesorId;

    @Column(name = "moneda", nullable = false, updatable = false)
    private String moneda;

    @Column(name = "capital", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal capital;

    @Column(name = "plazo_meses", nullable = false, updatable = false)
    private int plazoMeses;

    @Column(name = "tea", nullable = false, updatable = false, precision = 7, scale = 6)
    private BigDecimal tea;

    @Column(name = "fecha_desembolso", nullable = false, updatable = false)
    private LocalDate fechaDesembolso;

    @Column(name = "estado", nullable = false)
    private String estado;

    @Column(name = "observaciones")
    private String observaciones;

    /** Lo pone la BD (default now()). */
    @Column(name = "creado_en", insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    protected Prestamo() {
        // requerido por JPA
    }

    public Prestamo(UUID clienteId, UUID agenciaId, UUID asesorId, BigDecimal capital,
                    int plazoMeses, BigDecimal tea, LocalDate fechaDesembolso, String observaciones) {
        this.clienteId = clienteId;
        this.agenciaId = agenciaId;
        this.asesorId = asesorId;
        this.moneda = "PEN";
        this.capital = capital;
        this.plazoMeses = plazoMeses;
        this.tea = tea;
        this.fechaDesembolso = fechaDesembolso;
        this.estado = "Vigente";
        this.observaciones = observaciones;
    }

    public UUID getId() { return id; }
    public Long getNumero() { return numero; }
    public UUID getClienteId() { return clienteId; }
    public UUID getAgenciaId() { return agenciaId; }
    public UUID getAsesorId() { return asesorId; }
    public String getMoneda() { return moneda; }
    public BigDecimal getCapital() { return capital; }
    public int getPlazoMeses() { return plazoMeses; }
    public BigDecimal getTea() { return tea; }
    public LocalDate getFechaDesembolso() { return fechaDesembolso; }
    public String getEstado() { return estado; }
    public String getObservaciones() { return observaciones; }
    public OffsetDateTime getCreadoEn() { return creadoEn; }
}