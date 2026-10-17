package com.nexora.backend.cuotas.entidades;

import com.nexora.backend.prestamos.dominio.Cronograma;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** public.cuotas. Solo se inserta al registrar el préstamo (cronograma contractual, sin pagos). */
@Entity
@Table(name = "cuotas", schema = "public")
public class Cuota {

    @EmbeddedId
    private CuotaId id;

    @Column(name = "fecha_vencimiento", nullable = false, updatable = false)
    private LocalDate fechaVencimiento;

    @Column(name = "capital", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal capital;

    @Column(name = "interes", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal interes;

    @Column(name = "importe_cuota", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal importeCuota;

    @Column(name = "saldo", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal saldo;

    protected Cuota() {
        // requerido por JPA
    }

    public static Cuota desde(UUID prestamoId, Cronograma.Cuota c) {
        Cuota q = new Cuota();
        q.id = new CuotaId(prestamoId, c.numero());
        q.fechaVencimiento = c.fechaVencimiento();
        q.capital = c.capital();
        q.interes = c.interes();
        q.importeCuota = c.importeCuota();
        q.saldo = c.saldo();
        return q;
    }

    public CuotaId getId() { return id; }
    public LocalDate getFechaVencimiento() { return fechaVencimiento; }
    public BigDecimal getCapital() { return capital; }
    public BigDecimal getInteres() { return interes; }
    public BigDecimal getImporteCuota() { return importeCuota; }
    public BigDecimal getSaldo() { return saldo; }
}