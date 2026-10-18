package com.nexora.backend.clientes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Celular y correo editables desde el expediente. Mismas reglas que en el registro (RegistroClienteDTO). */
@Getter
@Setter
public class ActualizarContactoDTO {

    @NotBlank(message = "El celular es obligatorio.")
    @Pattern(regexp = "9[0-9]{8}", message = "El celular debe tener 9 dígitos y empezar con 9.")
    private String telefono;

    @NotBlank(message = "El correo electrónico es obligatorio.")
    @Size(max = 120, message = "El correo electrónico es demasiado largo.")
    @Pattern(
            regexp = "[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,}",
            message = "Ingresa un correo electrónico válido (por ejemplo, nombre@dominio.com).")
    private String correo;
}
