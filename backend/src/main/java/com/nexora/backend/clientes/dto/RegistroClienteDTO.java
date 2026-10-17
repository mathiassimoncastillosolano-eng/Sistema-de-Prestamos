
package com.nexora.backend.clientes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegistroClienteDTO {

    @NotBlank
    @Pattern(regexp = "DNI|RUC 10|RUC 20")
    private String tipoDocumento;

    @NotBlank
    @Pattern(regexp = "[0-9]{8}|10[0-9]{9}|20[0-9]{9}")
    private String numeroDocumento;

    @NotBlank
    @Size(min = 3, max = 200)
    private String nombre;

    @Pattern(regexp = "9[0-9]{8}")
    private String telefono;

    private String dniTitular;

    private String domicilio;

    private String estadoSunat;

    private String condicionSunat;

    private String representanteNombre;

    @Pattern(regexp = "[0-9]{8}")
    private String representanteDni;
}
