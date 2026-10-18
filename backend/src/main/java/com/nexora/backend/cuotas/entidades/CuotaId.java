package com.nexora.backend.cuotas.entidades;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class CuotaId implements Serializable {

    @Column(name = "prestamo_id", nullable = false)
    private UUID prestamoId;

    @Column(name = "numero", nullable = false)
    private int numero;

    protected CuotaId() {
        // requerido por JPA
    }

    public CuotaId(UUID prestamoId, int numero) {
        this.prestamoId = prestamoId;
        this.numero = numero;
    }

    public UUID getPrestamoId() { return prestamoId; }
    public int getNumero() { return numero; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CuotaId otro)) return false;
        return numero == otro.numero && Objects.equals(prestamoId, otro.prestamoId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(prestamoId, numero);
    }
}