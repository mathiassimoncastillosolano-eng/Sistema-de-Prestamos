package com.nexora.backend.clientes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistroClienteDTO {

    @NotBlank(message = "Indica el tipo de documento.")
    @Pattern(regexp = "DNI|RUC 10|RUC 20", message = "Tipo de documento no válido.")
    private String tipoDocumento;

    @NotBlank(message = "Indica el número de documento.")
    @Pattern(regexp = "[0-9]{8}|10[0-9]{9}|20[0-9]{9}", message = "El número de documento no es válido.")
    private String numeroDocumento;

    @NotBlank(message = "El celular es obligatorio.")
    @Pattern(regexp = "9[0-9]{8}", message = "El celular debe tener 9 dígitos y empezar con 9.")
    private String telefono;

    /** Mismo formato que valida el formulario: usuario@dominio.ext (extensión de 2 o más letras). */
    @NotBlank(message = "El correo electrónico es obligatorio.")
    @Size(max = 120, message = "El correo electrónico es demasiado largo.")
    @Pattern(
            regexp = "[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,}",
            message = "Ingresa un correo electrónico válido (por ejemplo, nombre@dominio.com).")
    private String correo;
}